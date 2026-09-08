"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireProfile } from "@/lib/auth";
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

/**
 * Xuất đổi mới nhanh (1 chạm) cho Quản lý kho:
 * Tự động tạo phiếu -> duyệt -> cấp phát (trừ kho chính + thu đồ hỏng) -> hoàn tất nhận hàng.
 */
export async function quickExchange(defectId: string): Promise<{ id: string; code: string }> {
  const profile = await requireManager();
  const supabase = await createClient();

  // 1. Tạo phiếu đổi mới
  const { data: id, error: createErr } = await supabase.rpc("create_exchange", {
    p_defect_id: defectId,
    p_by: profile.id,
  });
  if (createErr) throw new Error(createErr.message);
  if (!id) throw new Error("Không tạo được phiếu Đổi Mới");

  const exchangeId = id as string;

  // 2. Duyệt phiếu
  const { error: approveErr } = await supabase.rpc("approve_exchange", {
    p_id: exchangeId,
    p_by: profile.id,
  });
  if (approveErr) throw new Error(approveErr.message);

  // 3. Cấp phát (xuất kho & thu hồi đồ hỏng)
  const { error: issueErr } = await supabase.rpc("issue_exchange", {
    p_id: exchangeId,
    p_by: profile.id,
  });
  if (issueErr) throw new Error(issueErr.message);

  // 4. Hoàn tất nhận hàng
  const { error: receiveErr } = await supabase.rpc("receive_exchange", {
    p_id: exchangeId,
    p_by: profile.id,
  });
  if (receiveErr) throw new Error(receiveErr.message);

  const meta = await exchangeMeta(supabase, exchangeId);
  const code = meta?.code ?? "DM-????";

  const reporterId = await linkedReporterId(supabase, exchangeId);
  await safeNotify(
    [reporterId],
    "exchange",
    `Phiếu Đổi Mới ${code} đã hoàn tất`,
    "Quản lý đã xuất cấp đổi mới vật tư cho bạn.",
    `/defects/exchange/${exchangeId}`,
  );

  revalidatePath("/defects");
  revalidatePath("/products");
  return { id: exchangeId, code };
}

/**
 * Xử lý & hoàn tất nhanh phiếu đổi mới đã tồn tại (pending / approved / issued).
 */
export async function quickFulfillExistingExchange(exchangeId: string): Promise<void> {
  const profile = await requireManager();
  const supabase = await createClient();

  const { data: note } = await supabase
    .from("exchange_notes")
    .select("status")
    .eq("id", exchangeId)
    .single();
  if (!note) throw new Error("Không tìm thấy phiếu Đổi Mới");

  if (note.status === "pending") {
    const { error: approveErr } = await supabase.rpc("approve_exchange", {
      p_id: exchangeId,
      p_by: profile.id,
    });
    if (approveErr) throw new Error(approveErr.message);
  }

  if (note.status === "pending" || note.status === "approved") {
    const { error: issueErr } = await supabase.rpc("issue_exchange", {
      p_id: exchangeId,
      p_by: profile.id,
    });
    if (issueErr) throw new Error(issueErr.message);
  }

  if (note.status === "pending" || note.status === "approved" || note.status === "issued") {
    const { error: receiveErr } = await supabase.rpc("receive_exchange", {
      p_id: exchangeId,
      p_by: profile.id,
    });
    if (receiveErr) throw new Error(receiveErr.message);
  }

  const meta = await exchangeMeta(supabase, exchangeId);
  const reporterId = await linkedReporterId(supabase, exchangeId);
  await safeNotify(
    [reporterId],
    "exchange",
    `Phiếu Đổi Mới ${meta?.code ?? ""} đã hoàn tất`,
    "Quản lý đã xuất cấp đổi mới vật tư cho bạn.",
    `/defects/exchange/${exchangeId}`,
  );

  revalidatePath("/defects");
  revalidatePath("/products");
}
