"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isPrivileged } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function getManagerIds(supabase: Supabase): Promise<string[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["manager", "superuser"])
    .eq("is_active", true);
  return (data ?? []).map((p) => p.id);
}

// Người lập HONG liên kết (để gửi thông báo trạng thái phiếu Đổi Mới).
async function linkedReporterId(supabase: Supabase, exchangeId: string): Promise<string | null> {
  const { data } = await supabase
    .from("exchange_notes")
    .select("linked_defect_id, defect:defect_notes!exchange_notes_linked_defect_id_fkey(reported_by)")
    .eq("id", exchangeId)
    .single();
  const reportedBy = (data?.defect as { reported_by?: string | null } | null)?.reported_by ?? null;
  return reportedBy;
}

async function exchangeMeta(supabase: Supabase, exchangeId: string) {
  const { data } = await supabase
    .from("exchange_notes")
    .select("code")
    .eq("id", exchangeId)
    .single();
  return data;
}

// Gửi thông báo (bỏ qua lỗi — không làm hỏng thao tác chính).
async function safeNotify(
  userIds: (string | null | undefined)[],
  type: string,
  title: string,
  body?: string | null,
  link?: string,
) {
  try {
    const supabase = await createClient();
    const unique = [...new Set(userIds.filter((u): u is string => Boolean(u)))];
    await Promise.all(
      unique.map((uid) =>
        supabase.rpc("create_notification", {
          p_user_id: uid,
          p_type: type,
          p_title: title,
          p_body: body ?? undefined,
          p_link: link ?? undefined,
        }),
      ),
    );
  } catch {
    // Im lặng — thông báo là phụ.
  }
}

export async function createExchange(noteId: string): Promise<{ id: string; code: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: id, error } = await supabase.rpc("create_exchange", {
    p_defect_id: noteId,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  if (!id) throw new Error("Không tạo được phiếu Đổi Mới");

  const meta = await exchangeMeta(supabase, id as string);
  const code = meta?.code ?? "DM-????";

  // Người tạo là requester → báo manager duyệt; là manager tạo dùm → báo người lập HONG.
  const reporterId = await linkedReporterId(supabase, id as string);
  const managers = await getManagerIds(supabase);
  if (isPrivileged(profile.role)) {
    await safeNotify(
      [reporterId],
      "exchange",
      `Phiếu Đổi Mới ${code} đã được tạo`,
      "Quản lý đã tạo phiếu Đổi Mới cho phiếu hỏng của bạn.",
      `/defects/exchange/${id}`,
    );
  } else {
    await safeNotify(
      managers,
      "exchange",
      `Phiếu Đổi Mới ${code} chờ xử lý`,
      "Có phiếu Đổi Mới mới cần duyệt.",
      `/defects/exchange/${id}`,
    );
  }

  revalidatePath("/defects");
  revalidatePath("/defects/exchange");
  return { id: id as string, code };
}

export async function approveExchange(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_exchange", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await exchangeMeta(supabase, id);
  await safeNotify(
    [await linkedReporterId(supabase, id)],
    "exchange",
    `Phiếu Đổi Mới ${meta?.code ?? ""} đã được duyệt`,
    "Vật tư mới đang chờ cấp phát.",
    `/defects/exchange/${id}`,
  );
  revalidatePath("/defects");
  revalidatePath(`/defects/exchange/${id}`);
}

export async function rejectExchange(id: string, reason: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_exchange", {
    p_id: id,
    p_by: profile.id,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);

  const meta = await exchangeMeta(supabase, id);
  await safeNotify(
    [await linkedReporterId(supabase, id)],
    "exchange",
    `Phiếu Đổi Mới ${meta?.code ?? ""} bị từ chối`,
    reason || undefined,
    `/defects/exchange/${id}`,
  );
  revalidatePath("/defects");
  revalidatePath(`/defects/exchange/${id}`);
}

export async function issueExchange(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_exchange", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await exchangeMeta(supabase, id);
  await safeNotify(
    [await linkedReporterId(supabase, id)],
    "exchange",
    `Phiếu Đổi Mới ${meta?.code ?? ""} đã cấp phát`,
    "Vật tư mới đã được cấp.",
    `/defects/exchange/${id}`,
  );
  revalidatePath("/defects");
  revalidatePath(`/defects/exchange/${id}`);
  revalidatePath("/products");
}

export async function receiveExchange(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_exchange", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await exchangeMeta(supabase, id);
  await safeNotify(
    [await linkedReporterId(supabase, id)],
    "exchange",
    `Phiếu Đổi Mới ${meta?.code ?? ""} đã hoàn tất`,
    "Bạn đã nhận vật tư mới thay thế.",
    `/defects/exchange/${id}`,
  );
  revalidatePath("/defects");
  revalidatePath(`/defects/exchange/${id}`);
}

export async function cancelExchange(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_exchange", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  revalidatePath("/defects");
  revalidatePath(`/defects/exchange/${id}`);
}
