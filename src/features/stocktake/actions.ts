"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getManagerIds, notifyUsers } from "@/lib/notifications";

async function stocktakeMeta(id: string) {
  try {
    const supabase = await createClient();
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("stocktake_sessions")
      .select("code, name, location:stock_locations(name)")
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function createStocktake(locationId: string, name: string) {
  const profile = await requireProfile();
  if (!name.trim()) throw new Error("Phải nhập tên phiếu kiểm kê");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_stocktake", {
    p_location_id: locationId,
    p_name: name.trim(),
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);

  const sessionId = data as string;
  let code = "PKK";
  let locName: string | undefined;
  if (sessionId) {
    const meta = await stocktakeMeta(sessionId);
    if (meta?.code) code = meta.code;
    locName = (meta?.location as { name?: string } | null)?.name;
  }

  await notifyUsers({
    userIds: await getManagerIds(supabase),
    type: "stocktake",
    title: `[Kiểm kê kho] ${code} - Khởi tạo kỳ kiểm kê kho`,
    body: `Kỳ kiểm kê kho "${name.trim()}" đã được khởi tạo bởi ${profile.name}${locName ? ` tại ${locName}` : ""}.`,
    link: "/stocktake",
    document: {
      code,
      type: "Phiếu kiểm kê kho",
      status: "Đang kiểm kê",
      statusVariant: "info",
      creatorName: profile.name,
      locationName: locName,
      notes: name.trim(),
    },
  });

  revalidatePath("/stocktake");
  return data as string;
}

export async function postStocktake(
  sessionId: string,
  items: { itemId: string; actualQty: number; notes: string }[],
) {
  const profile = await requireProfile();
  const supabase = await createClient();
  // Chỉ các dòng ĐÃ KIỂM được gửi lên (client lọc sẵn); RPC post_stocktake cũng
  // chỉ xử lý checked = true nên dòng chưa kiểm không bao giờ đụng tồn kho.
  for (const it of items) {
    const { error } = await supabase
      .from("stocktake_items")
      .update({ actual_qty: it.actualQty, notes: it.notes })
      .eq("id", it.itemId);
    if (error) throw new Error(error.message);
  }
  const { error } = await supabase.rpc("post_stocktake", { p_session_id: sessionId, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await stocktakeMeta(sessionId);
  const code = meta?.code ?? "PKK";
  const sessionName = meta?.name || code;

  await notifyUsers({
    userIds: await getManagerIds(supabase),
    type: "stocktake",
    title: `[Kiểm kê kho] ${code} - Đã chốt số liệu kiểm kê kho`,
    body: `Thủ kho ${profile.name} đã chốt số liệu kỳ kiểm kê "${sessionName}" và cập nhật cân bằng sổ kho MTP-ERN.`,
    link: "/stocktake",
    document: {
      code,
      type: "Phiếu kiểm kê kho",
      status: "Đã chốt sổ",
      statusVariant: "success",
      handlerName: profile.name,
      notes: sessionName,
    },
  });

  revalidatePath("/stocktake");
  revalidatePath("/products");
}

export async function toggleStocktakeItemChecked(itemId: string, checked: boolean) {
  await requireProfile();
  const supabase = await createClient();
  // Chỉ dòng thuộc phiếu draft mới được đánh dấu (posted đã đóng, chỉ xem).
  const { data: item } = await supabase.from("stocktake_items").select("session_id").eq("id", itemId).single();
  if (!item) throw new Error("Không tìm thấy dòng kiểm kê");
  const { data: session } = await supabase
    .from("stocktake_sessions")
    .select("status")
    .eq("id", item.session_id)
    .single();
  if (!session || session.status !== "draft") throw new Error("Phiếu đã chốt, không sửa được");
  const { error } = await supabase.from("stocktake_items").update({ checked }).eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/stocktake");
}

// ---- Công cụ DEV (chỉ superuser) — RPC phía DB tự kiểm is_superuser() ----

/** Mở lại phiếu đã chốt về nháp (đảo bút toán) để dev sửa số liệu rồi chốt lại. */
export async function reopenStocktake(sessionId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revert_stocktake", { p_session_id: sessionId, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/stocktake");
  revalidatePath("/products");
}

/** Xoá phiếu kiểm kê (đã chốt sẽ đảo bút toán trước khi xoá). */
export async function deleteStocktake(sessionId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_stocktake", { p_session_id: sessionId, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/stocktake");
  revalidatePath("/products");
}