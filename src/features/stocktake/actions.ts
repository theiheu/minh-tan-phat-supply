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
  items: {
    itemId: string;
    actualQty: number;
    notes: string;
    transactionUnitId?: string | null;
    enteredQuantity?: number | null;
    conversionFactorSnapshot?: number | null;
  }[],
) {
  const profile = await requireProfile();
  const supabase = await createClient();
  // Chỉ các dòng ĐÃ KIỂM được gửi lên (client lọc sẵn); RPC post_stocktake cũng
  // chỉ xử lý checked = true nên dòng chưa kiểm không bao giờ đụng tồn kho.
  for (const it of items) {
    const patch: {
      actual_qty: number;
      notes: string;
      transaction_unit_id?: string | null;
      entered_quantity?: number | null;
      conversion_factor_snapshot?: number | null;
    } = {
      actual_qty: it.actualQty,
      notes: it.notes,
    };
    if (it.transactionUnitId !== undefined) patch.transaction_unit_id = it.transactionUnitId;
    if (it.enteredQuantity !== undefined) patch.entered_quantity = it.enteredQuantity;
    if (it.conversionFactorSnapshot !== undefined) patch.conversion_factor_snapshot = it.conversionFactorSnapshot;

    const { error } = await supabase
      .from("stocktake_items")
      .update(patch)
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

export async function reopenStocktake(sessionId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revert_stocktake", { p_session_id: sessionId, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/stocktake");
  revalidatePath("/products");
}

export async function deleteStocktake(sessionId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_stocktake", { p_session_id: sessionId, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/stocktake");
  revalidatePath("/products");
}