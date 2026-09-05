"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requisitionSchema, type RequisitionInput } from "./schema";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function getManagerIds(supabase: Supabase): Promise<string[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["manager", "superuser"])
    .eq("is_active", true);
  return (data ?? []).map((p) => p.id);
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

async function requisitionMeta(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("requisitions")
    .select("code, requester_id")
    .eq("id", id)
    .single();
  return data;
}

export async function createRequisition(input: RequisitionInput) {
  const profile = await requireProfile();
  const parsed = requisitionSchema.parse(input);

  const supabase = await createClient();
  const items = parsed.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity }));

  // Manager có thể tạo dùm cho người yêu cầu khác; RPC kiểm tra quyền (is_manager).
  const requesterId = parsed.requesterId ?? profile.id;

  const { data, error } = await supabase.rpc("create_requisition", {
    p_items: items,
    p_zone_id: parsed.zoneId,
    p_purpose: parsed.purpose,
    p_type: parsed.requisitionType,
    p_linked_defect_id: parsed.linkedDefectId ?? (null as unknown as string),
    p_requester_id: requesterId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/requisitions");
  return data as string;
}

export async function submitRequisition(id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_requisition", { p_id: id });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(id);
  await safeNotify(
    await getManagerIds(supabase),
    "requisition",
    `Phiếu ${meta?.code ?? "yêu cầu"} chờ duyệt`,
    "Có phiếu yêu cầu vật tư mới cần xử lý.",
    `/requisitions/${id}`,
  );

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function approveRequisition(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_requisition", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(id);
  await safeNotify(
    [meta?.requester_id],
    "requisition",
    `Phiếu ${meta?.code ?? "yêu cầu"} đã được duyệt`,
    "Phiếu của bạn đã được duyệt, chờ cấp phát.",
    `/requisitions/${id}`,
  );

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function fulfillRequisition(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("fulfill_requisition", { p_id: id, p_by: profile.id, p_notes: "" });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(id);
  await safeNotify(
    [meta?.requester_id],
    "requisition",
    `Phiếu ${meta?.code ?? "yêu cầu"} đã cấp phát`,
    "Vật tư đã được cấp, hãy xác nhận đã nhận.",
    `/requisitions/${id}`,
  );

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function receiveRequisition(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_requisition", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(id);
  await safeNotify(
    await getManagerIds(supabase),
    "requisition",
    `Phiếu ${meta?.code ?? "yêu cầu"} đã nhận hàng`,
    "Người yêu cầu đã xác nhận nhận đủ vật tư.",
    `/requisitions/${id}`,
  );

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function rejectRequisition(id: string, reason: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_requisition", { p_id: id, p_by: profile.id, p_reason: reason });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(id);
  await safeNotify(
    [meta?.requester_id],
    "requisition",
    `Phiếu ${meta?.code ?? "yêu cầu"} bị từ chối`,
    reason || undefined,
    `/requisitions/${id}`,
  );

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function cancelRequisition(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_requisition", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(id);
  const isOwner = meta?.requester_id === profile.id;
  const managers = await getManagerIds(supabase);
  await safeNotify(
    isOwner ? managers : [meta?.requester_id],
    "requisition",
    `Phiếu ${meta?.code ?? "yêu cầu"} đã hủy`,
    undefined,
    `/requisitions/${id}`,
  );

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function returnRequisitionItems(requisitionId: string, items: { variantId: string; quantity: number }[]) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("return_requisition_items", {
    p_requisition_id: requisitionId,
    p_items: items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(requisitionId);
  await safeNotify(
    await getManagerIds(supabase),
    "requisition",
    `Phiếu ${meta?.code ?? "yêu cầu"} trả lại vật tư`,
    "Có vật tư được trả lại kho.",
    `/requisitions/${requisitionId}`,
  );

  revalidatePath(`/requisitions/${requisitionId}`);
  revalidatePath("/products");
}
