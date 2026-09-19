"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dispatchBusinessEvent } from "@/features/notifications/server/dispatch-business-event";

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
      .select(`
        code,
        items:exchange_note_items(
          quantity,
          skus(
            products(name),
            units(name, symbol)
          )
        )
      `)
      .eq("id", exchangeId)
      .single();
    return data;
  } catch {
    return null;
  }
}

function formatExchangeItems(items?: any[] | null) {
  if (!items || items.length === 0) return undefined;
  return items.map((i) => ({
    name: i.skus?.products?.name || "Vật tư đổi mới",
    quantity: i.quantity,
    unit: i.skus?.units?.name || i.skus?.units?.symbol || "",
  }));
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
  const reporterId = await linkedReporterId(supabase, id as string);

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "exchange.created",
      actorId: profile.id,
      subject: { type: "exchange", id: id as string },
      participants: { requesterId: reporterId },
      payload: {
        code,
        items: formatExchangeItems((meta as any)?.items),
        handlerName: profile.name,
      },
    },
  });

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

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "exchange.approved",
      actorId: profile.id,
      subject: { type: "exchange", id },
      participants: { requesterId: reporterId },
      payload: {
        code,
        items: formatExchangeItems((meta as any)?.items),
        handlerName: profile.name,
      },
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

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "exchange.rejected",
      actorId: profile.id,
      subject: { type: "exchange", id },
      participants: { requesterId: reporterId },
      payload: {
        code,
        reason,
        items: formatExchangeItems((meta as any)?.items),
        handlerName: profile.name,
      },
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

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "exchange.issued",
      actorId: profile.id,
      subject: { type: "exchange", id },
      participants: { requesterId: reporterId },
      payload: {
        code,
        handlerName: profile.name,
      },
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

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "exchange.received",
      actorId: profile.id,
      subject: { type: "exchange", id },
      participants: { requesterId: reporterId },
      payload: {
        code,
        items: formatExchangeItems((meta as any)?.items),
        handlerName: profile.name,
      },
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
  const { error } = await supabase.rpc("cancel_exchange", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  try {
    const userIds = [...new Set([reporterId].filter(Boolean))];
    if (userIds.length > 0) {
      await supabase.from("notifications").insert(
        userIds.map((uid) => ({
          user_id: uid!,
          type: "exchange",
          title: `[Đổi mới vật tư] ${code} - Đã hủy phiếu đổi mới`,
          body: `Phiếu đổi mới vật tư đã được hủy bỏ bởi ${profile.name}.`,
          link: "/defects",
        }))
      );
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.warn("[cancelExchange] In-app notification error:", err);
  }

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

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "exchange.received",
      actorId: profile.id,
      subject: { type: "exchange", id: exchangeId },
      participants: { requesterId: reporterId },
      payload: {
        code,
        handlerName: profile.name,
      },
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

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "exchange.received",
      actorId: profile.id,
      subject: { type: "exchange", id: exchangeId },
      participants: { requesterId: reporterId },
      payload: {
        code,
        handlerName: profile.name,
      },
    },
  });

  revalidatePath("/defects");
  revalidatePath("/products");
}