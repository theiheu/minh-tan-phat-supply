"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getManagerIds, notifyUsers, type NotifyOptions } from "@/lib/notifications";
import { requisitionSchema, type RequisitionInput } from "./schema";

// Gửi thông báo in-app và email chuẩn ERP (bỏ qua lỗi — không làm hỏng thao tác chính).
async function safeNotify(options: NotifyOptions) {
  await notifyUsers(options);
}

async function requisitionMeta(id: string) {
  try {
    const supabase = await createClient();
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("requisitions")
      .select("code, requester_id, purpose, zone:zones(name), sub_zone:sub_zones(name)")
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function createRequisition(input: RequisitionInput) {
  const profile = await requireProfile();
  const parsed = requisitionSchema.parse(input);

  const supabase = await createClient();
  const items = parsed.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity }));

  // Kiểm tra tính hợp lệ của variant_id (tránh lỗi khóa ngoại do giỏ hàng cũ lưu trong localStorage trên máy người dùng)
  const variantIds = items.map((i) => i.variant_id);
  const { data: validVariants, error: checkError } = await supabase
    .from("variants")
    .select("id")
    .in("id", variantIds);

  if (checkError) throw new Error(checkError.message);

  const validIds = new Set((validVariants ?? []).map((v) => v.id));
  const invalid = variantIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    throw new Error(
      "Một số vật tư trong giỏ hàng không còn tồn tại trong hệ thống (do giỏ hàng cũ trên máy). Vui lòng xóa giỏ hàng và chọn lại vật tư từ Kho."
    );
  }

  // Manager có thể tạo dùm cho người yêu cầu khác; RPC kiểm tra quyền (is_manager).
  const requesterId = parsed.requesterId ?? profile.id;

  const { data, error } = await supabase.rpc("create_requisition", {
    p_items: items,
    p_zone_id: parsed.zoneId,
    p_purpose: parsed.purpose,
    p_type: "new_supply",
    p_linked_defect_id: null as unknown as string,
    p_requester_id: requesterId,
    p_sub_zone_id: parsed.subZoneId ?? null,
  });

  if (error) {
    if (error.message.includes("requisition_items_variant_id_fkey")) {
      throw new Error(
        "Vật tư trong giỏ hàng không tồn tại trong cơ sở dữ liệu. Vui lòng xóa giỏ hàng và chọn lại từ Kho vật tư."
      );
    }
    throw new Error(error.message);
  }
  revalidatePath("/requisitions");
  return data as string;
}

export async function submitRequisition(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_requisition", { p_id: id });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(id);
  const code = meta?.code ?? "YCCP";
  const zoneName = (meta?.zone as { name?: string } | null)?.name;

  await safeNotify({
    userIds: await getManagerIds(supabase),
    type: "requisition",
    title: `[Yêu cầu cấp phát] ${code} - Chờ phê duyệt`,
    body: `Người yêu cầu ${profile.name} đã gửi phiếu yêu cầu cấp phát vật tư${zoneName ? ` cho khu vực ${zoneName}` : ""}, cần được xem xét và phê duyệt.`,
    link: `/requisitions/${id}`,
    document: {
      code,
      type: "Phiếu yêu cầu cấp phát",
      status: "Chờ phê duyệt",
      statusVariant: "warning",
      creatorName: profile.name,
      locationName: zoneName,
      notes: meta?.purpose,
    },
  });

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function approveRequisition(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_requisition", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(id);
  const code = meta?.code ?? "YCCP";
  const zoneName = (meta?.zone as { name?: string } | null)?.name;

  await safeNotify({
    userIds: [meta?.requester_id],
    type: "requisition",
    title: `[Yêu cầu cấp phát] ${code} - Đã được phê duyệt`,
    body: `Phiếu yêu cầu cấp phát vật tư đã được phê duyệt bởi ${profile.name}, đang chờ thủ kho chuẩn bị và xuất cấp.`,
    link: `/requisitions/${id}`,
    document: {
      code,
      type: "Phiếu yêu cầu cấp phát",
      status: "Đã phê duyệt",
      statusVariant: "success",
      handlerName: profile.name,
      locationName: zoneName,
    },
  });

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function fulfillRequisition(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  // Kiểm tra tồn kho trước khi cấp phát để báo lỗi rõ ràng nếu thiếu hàng
  const { data: reqItems } = await supabase
    .from("requisition_items")
    .select("variant_id, quantity, variants(attributes, unit, products(name))")
    .eq("requisition_id", id);

  if (reqItems && reqItems.length > 0) {
    const variantIds = reqItems.map((i) => i.variant_id);
    const { data: stockRows } = await supabase
      .from("variant_stock")
      .select("variant_id, quantity")
      .in("variant_id", variantIds);

    const stockMap = new Map((stockRows ?? []).map((s) => [s.variant_id, s.quantity]));
    const insufficient = reqItems.filter((i) => (stockMap.get(i.variant_id) ?? 0) < i.quantity);

    if (insufficient.length > 0) {
      const names = insufficient
        .map((i) => {
          const v = i.variants as { unit?: string | null; products?: { name?: string | null } | null } | null;
          const name = v?.products?.name ?? "Vật tư";
          const currentStock = stockMap.get(i.variant_id) ?? 0;
          return `"${name}" (cần ${i.quantity}, tồn hiện có ${currentStock})`;
        })
        .join(", ");
      throw new Error(
        `Không đủ tồn kho để cấp phát: ${names}. Vui lòng tạo phiếu đặt hàng nhập kho bổ sung trước khi cấp phát.`
      );
    }
  }

  const { error } = await supabase.rpc("fulfill_requisition", { p_id: id, p_by: profile.id, p_notes: "" });
  if (error) {
    if (error.message.includes("Không đủ tồn") || error.message.includes("không đủ tồn")) {
      throw new Error(
        "Không đủ tồn kho để cấp phát! Phiếu có vật tư đang hết hoặc thiếu số lượng trong Kho chính. Vui lòng tạo phiếu đặt hàng nhập kho bổ sung trước."
      );
    }
    throw new Error(error.message);
  }

  const meta = await requisitionMeta(id);
  const code = meta?.code ?? "YCCP";
  const zoneName = (meta?.zone as { name?: string } | null)?.name;

  await safeNotify({
    userIds: [meta?.requester_id],
    type: "requisition",
    title: `[Yêu cầu cấp phát] ${code} - Đã xuất cấp phát kho`,
    body: `Thủ kho ${profile.name} đã hoàn tất xuất cấp vật tư. Vui lòng kiểm tra và xác nhận nhận hàng trên hệ thống.`,
    link: `/requisitions/${id}`,
    document: {
      code,
      type: "Phiếu yêu cầu cấp phát",
      status: "Đã xuất cấp phát",
      statusVariant: "info",
      handlerName: profile.name,
      locationName: zoneName,
    },
  });

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function receiveRequisition(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_requisition", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(id);
  const code = meta?.code ?? "YCCP";
  const zoneName = (meta?.zone as { name?: string } | null)?.name;

  await safeNotify({
    userIds: await getManagerIds(supabase),
    type: "requisition",
    title: `[Yêu cầu cấp phát] ${code} - Đã hoàn tất nhận hàng`,
    body: `Người nhận ${profile.name} đã xác nhận nhận đủ toàn bộ số lượng vật tư bàn giao.`,
    link: `/requisitions/${id}`,
    document: {
      code,
      type: "Phiếu yêu cầu cấp phát",
      status: "Đã hoàn tất",
      statusVariant: "success",
      handlerName: profile.name,
      locationName: zoneName,
    },
  });

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function rejectRequisition(id: string, reason: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_requisition", { p_id: id, p_by: profile.id, p_reason: reason });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(id);
  const code = meta?.code ?? "YCCP";

  await safeNotify({
    userIds: [meta?.requester_id],
    type: "requisition",
    title: `[Yêu cầu cấp phát] ${code} - Bị từ chối phê duyệt`,
    body: `Phiếu yêu cầu cấp phát bị từ chối phê duyệt bởi ${profile.name}.${reason ? ` Lý do: ${reason}` : ""}`,
    link: `/requisitions/${id}`,
    document: {
      code,
      type: "Phiếu yêu cầu cấp phát",
      status: "Bị từ chối",
      statusVariant: "danger",
      handlerName: profile.name,
      notes: reason,
    },
  });

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function cancelRequisition(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_requisition", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(id);
  const code = meta?.code ?? "YCCP";
  const isOwner = meta?.requester_id === profile.id;
  const managers = await getManagerIds(supabase);

  await safeNotify({
    userIds: isOwner ? managers : [meta?.requester_id],
    type: "requisition",
    title: `[Yêu cầu cấp phát] ${code} - Đã hủy phiếu`,
    body: `Phiếu yêu cầu cấp phát vật tư đã được hủy bỏ trên hệ thống bởi ${profile.name}.`,
    link: `/requisitions/${id}`,
    document: {
      code,
      type: "Phiếu yêu cầu cấp phát",
      status: "Đã hủy",
      statusVariant: "neutral",
      handlerName: profile.name,
    },
  });

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
  const code = meta?.code ?? "YCCP";

  await safeNotify({
    userIds: await getManagerIds(supabase),
    type: "requisition",
    title: `[Yêu cầu cấp phát] ${code} - Hoàn trả vật tư về kho`,
    body: `Nhân sự ${profile.name} đã hoàn trả lại ${items.length} mặt hàng vật tư về kho lưu trữ.`,
    link: `/requisitions/${requisitionId}`,
    document: {
      code,
      type: "Hoàn trả vật tư",
      status: "Đã hoàn trả",
      statusVariant: "info",
      handlerName: profile.name,
    },
  });

  revalidatePath(`/requisitions/${requisitionId}`);
  revalidatePath("/products");
}