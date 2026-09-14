"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireProfile } from "@/lib/auth";
import { isPrivileged } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { getManagerIds, notifyUsers, type NotifyOptions } from "@/lib/notifications";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Người lập HONG liên kết (để gửi thông báo trạng thái phiếu Đổi Mới).
async function linkedReporterId(supabase: Supabase, exchangeId: string): Promise<string | null> {
  try {
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("exchange_notes")
      .select("linked_defect_id, defect:defect_notes!exchange_notes_linked_defect_id_fkey(reported_by)")
      .eq("id", exchangeId)
      .single();
    const reportedBy = (data?.defect as { reported_by?: string | null } | null)?.reported_by ?? null;
    return reportedBy;
  } catch {
    return null;
  }
}

async function exchangeMeta(supabase: Supabase, exchangeId: string) {
  try {
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("exchange_notes")
      .select("code")
      .eq("id", exchangeId)
      .single();
    return data;
  } catch {
    return null;
  }
}

// Gửi thông báo in-app và email chuẩn ERP (bỏ qua lỗi — không làm hỏng thao tác chính).
async function safeNotify(options: NotifyOptions) {
  await notifyUsers(options);
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
  const code = meta?.code ?? "PDM";

  // Người tạo là requester → báo manager duyệt; là manager tạo dùm → báo người lập HONG.
  const reporterId = await linkedReporterId(supabase, id as string);
  const managers = await getManagerIds(supabase);
  if (isPrivileged(profile.role)) {
    await safeNotify({
      userIds: [reporterId],
      type: "exchange",
      title: `[Đổi mới vật tư] ${code} - Đã tạo phiếu đổi mới`,
      body: `Quản lý ${profile.name} đã lập phiếu đổi mới vật tư thay thế cho biên bản báo hỏng của bạn.`,
      link: `/defects/exchange/${id}`,
      document: {
        code,
        type: "Phiếu đổi mới vật tư",
        status: "Chờ cấp phát",
        statusVariant: "warning",
        creatorName: profile.name,
      },
    });
  } else {
    await safeNotify({
      userIds: managers,
      type: "exchange",
      title: `[Đổi mới vật tư] ${code} - Chờ phê duyệt đổi mới`,
      body: `Có phiếu đổi mới vật tư mới từ biên bản báo hỏng cần xem xét và phê duyệt.`,
      link: `/defects/exchange/${id}`,
      document: {
        code,
        type: "Phiếu đổi mới vật tư",
        status: "Chờ phê duyệt",
        statusVariant: "warning",
        creatorName: profile.name,
      },
    });
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
  const code = meta?.code ?? "PDM";
  const reporterId = await linkedReporterId(supabase, id);

  await safeNotify({
    userIds: [reporterId],
    type: "exchange",
    title: `[Đổi mới vật tư] ${code} - Đã được phê duyệt`,
    body: `Phiếu đổi mới vật tư đã được phê duyệt bởi ${profile.name}, đang chờ thủ kho chuẩn bị và xuất cấp.`,
    link: `/defects/exchange/${id}`,
    document: {
      code,
      type: "Phiếu đổi mới vật tư",
      status: "Đã phê duyệt",
      statusVariant: "success",
      handlerName: profile.name,
    },
  });

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
  const code = meta?.code ?? "PDM";
  const reporterId = await linkedReporterId(supabase, id);

  await safeNotify({
    userIds: [reporterId],
    type: "exchange",
    title: `[Đổi mới vật tư] ${code} - Bị từ chối phê duyệt`,
    body: `Phiếu đổi mới bị từ chối phê duyệt bởi ${profile.name}.${reason ? ` Lý do: ${reason}` : ""}`,
    link: `/defects/exchange/${id}`,
    document: {
      code,
      type: "Phiếu đổi mới vật tư",
      status: "Bị từ chối",
      statusVariant: "danger",
      handlerName: profile.name,
      notes: reason,
    },
  });

  revalidatePath("/defects");
  revalidatePath(`/defects/exchange/${id}`);
}

export async function issueExchange(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_exchange", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await exchangeMeta(supabase, id);
  const code = meta?.code ?? "PDM";
  const reporterId = await linkedReporterId(supabase, id);

  await safeNotify({
    userIds: [reporterId],
    type: "exchange",
    title: `[Đổi mới vật tư] ${code} - Đã xuất cấp đổi mới`,
    body: `Thủ kho ${profile.name} đã xuất cấp vật tư mới thay thế và thu hồi vật tư hỏng. Vui lòng kiểm tra và xác nhận nhận hàng.`,
    link: `/defects/exchange/${id}`,
    document: {
      code,
      type: "Phiếu đổi mới vật tư",
      status: "Đã cấp phát",
      statusVariant: "info",
      handlerName: profile.name,
    },
  });

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
  const code = meta?.code ?? "PDM";
  const reporterId = await linkedReporterId(supabase, id);
  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([reporterId, ...managers])];

  await safeNotify({
    userIds,
    type: "exchange",
    title: `[Đổi mới vật tư] ${code} - Đã hoàn tất đổi mới`,
    body: `Người yêu cầu ${profile.name} đã xác nhận nhận đủ vật tư mới thay thế bàn giao.`,
    link: `/defects/exchange/${id}`,
    document: {
      code,
      type: "Phiếu đổi mới vật tư",
      status: "Đã hoàn tất",
      statusVariant: "success",
      handlerName: profile.name,
    },
  });

  revalidatePath("/defects");
  revalidatePath(`/defects/exchange/${id}`);
}

export async function cancelExchange(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const meta = await exchangeMeta(supabase, id);
  const code = meta?.code ?? "PDM";
  const reporterId = await linkedReporterId(supabase, id);
  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([reporterId, ...managers])];

  const { error } = await supabase.rpc("cancel_exchange", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  await safeNotify({
    userIds,
    type: "exchange",
    title: `[Đổi mới vật tư] ${code} - Đã hủy phiếu đổi mới`,
    body: `Phiếu đổi mới vật tư đã được hủy bỏ trên hệ thống bởi ${profile.name}.`,
    link: "/defects",
    document: {
      code,
      type: "Phiếu đổi mới vật tư",
      status: "Đã hủy",
      statusVariant: "neutral",
      handlerName: profile.name,
    },
  });

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
  const code = meta?.code ?? "PDM";

  const reporterId = await linkedReporterId(supabase, exchangeId);
  await safeNotify({
    userIds: [reporterId],
    type: "exchange",
    title: `[Đổi mới vật tư] ${code} - Đã hoàn tất xuất cấp đổi mới`,
    body: `Quản lý kho ${profile.name} đã hoàn tất thủ tục xuất cấp đổi mới vật tư thay thế cho bạn.`,
    link: `/defects/exchange/${exchangeId}`,
    document: {
      code,
      type: "Phiếu đổi mới vật tư",
      status: "Đã hoàn tất",
      statusVariant: "success",
      handlerName: profile.name,
    },
  });

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
  const code = meta?.code ?? "PDM";
  const reporterId = await linkedReporterId(supabase, exchangeId);

  await safeNotify({
    userIds: [reporterId],
    type: "exchange",
    title: `[Đổi mới vật tư] ${code} - Đã hoàn tất xuất cấp đổi mới`,
    body: `Quản lý kho ${profile.name} đã hoàn tất thủ tục xuất cấp đổi mới vật tư thay thế cho bạn.`,
    link: `/defects/exchange/${exchangeId}`,
    document: {
      code,
      type: "Phiếu đổi mới vật tư",
      status: "Đã hoàn tất",
      statusVariant: "success",
      handlerName: profile.name,
    },
  });

  revalidatePath("/defects");
  revalidatePath("/products");
}