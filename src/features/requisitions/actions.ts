"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchBusinessEvent } from "@/features/notifications/server/dispatch-business-event";
import { requisitionSchema, type RequisitionInput } from "./schema";

async function requisitionMeta(id: string) {
  try {
    const supabase = await createClient();
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("requisitions")
      .select(`
        code,
        requester_id,
        purpose,
        zone:zones(name),
        sub_zone:sub_zones(name),
        items:requisition_items(
          quantity,
          entered_quantity,
          sku_name_snapshot,
          uom_name_snapshot,
          skus(
            products(name),
            units(name, symbol)
          )
        )
      `)
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

function formatRequisitionItems(items?: any[] | null) {
  if (!items || items.length === 0) return undefined;
  return items.map((i) => ({
    name: i.sku_name_snapshot || i.skus?.products?.name || "Vật tư",
    quantity: i.entered_quantity ?? i.quantity,
    unit: i.uom_name_snapshot || i.skus?.units?.name || i.skus?.units?.symbol || "",
  }));
}

export async function createRequisition(input: RequisitionInput) {
  const profile = await requireProfile();
  const parsed = requisitionSchema.parse(input);

  const supabase = await createClient();
  const items = parsed.items.map((i) => ({
    sku_id: i.skuId,
    transaction_unit_id: i.transactionUnitId ?? null,
    entered_quantity: i.enteredQuantity
  }));

  // Kiểm tra tính hợp lệ của sku_id (tránh lỗi khóa ngoại do giỏ hàng cũ lưu trong localStorage trên máy người dùng)
  const skuIds = items.map((i) => i.sku_id);
  const { data: validSkus, error: checkError } = await supabase
    .from("skus")
    .select("id")
    .in("id", skuIds);

  if (checkError) throw new Error(checkError.message);

  const validIds = new Set((validSkus ?? []).map((v) => v.id));
  const invalid = skuIds.filter((id) => !validIds.has(id));
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
    p_sub_zone_id: (parsed.subZoneId ?? null) as unknown as string,
  });

  if (error) {
    if (error.message.includes("requisition_items_sku_id_fkey")) {
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

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "requisition.submitted",
      actorId: profile.id,
      subject: { type: "requisition", id },
      participants: { requesterId: meta?.requester_id },
      payload: {
        code,
        requesterName: profile.name,
        zoneName,
        purpose: meta?.purpose,
        items: formatRequisitionItems((meta as any)?.items),
        handlerName: profile.name,
      },
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

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "requisition.approved",
      actorId: profile.id,
      subject: { type: "requisition", id },
      participants: { requesterId: meta?.requester_id },
      payload: {
        code,
        requesterName: undefined,
        zoneName,
        purpose: meta?.purpose,
        items: formatRequisitionItems((meta as any)?.items),
        handlerName: profile.name,
      },
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
    .select("sku_id, quantity, skus(products(name), units(name, symbol))")
    .eq("requisition_id", id);

  if (reqItems && reqItems.length > 0) {
    const variantIds = reqItems.map((i) => i.sku_id);
    const { data: stockRows } = await supabase
      .from("sku_stock")
      .select("sku_id, quantity")
      .in("sku_id", variantIds);

    const stockMap = new Map((stockRows ?? []).map((s) => [s.sku_id, s.quantity]));
    const insufficient = reqItems.filter((i) => (stockMap.get(i.sku_id) ?? 0) < i.quantity);

    if (insufficient.length > 0) {
      const names = insufficient
        .map((i) => {
          const v = i.skus as { unit?: string | null; products?: { name?: string | null } | null } | null;
          const name = v?.products?.name ?? "Vật tư";
          const currentStock = stockMap.get(i.sku_id) ?? 0;
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
  const _zoneName = (meta?.zone as { name?: string } | null)?.name;

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "requisition.fulfilled",
      actorId: profile.id,
      subject: { type: "requisition", id },
      participants: { requesterId: meta?.requester_id },
      payload: {
        code,
        items: formatRequisitionItems((meta as any)?.items),
        handlerName: profile.name,
      },
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

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "requisition.received",
      actorId: profile.id,
      subject: { type: "requisition", id },
      participants: { requesterId: meta?.requester_id },
      payload: {
        code,
        requesterName: profile.name,
        zoneName,
        purpose: meta?.purpose,
        items: formatRequisitionItems((meta as any)?.items),
        handlerName: profile.name,
      },
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

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "requisition.rejected",
      actorId: profile.id,
      subject: { type: "requisition", id },
      participants: { requesterId: meta?.requester_id },
      payload: {
        code,
        reason,
        items: formatRequisitionItems((meta as any)?.items),
        handlerName: profile.name,
      },
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
  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "requisition.cancelled",
      actorId: profile.id,
      subject: { type: "requisition", id },
      participants: { requesterId: meta?.requester_id },
      payload: {
        code,
        items: formatRequisitionItems((meta as any)?.items),
        handlerName: profile.name,
      },
    },
  });

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function returnRequisitionItems(requisitionId: string, items: { skuId: string; transactionUnitId?: string; enteredQuantity: number }[], operationKey: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("return_requisition_items", {
    p_operation_key: operationKey,
    p_requisition_id: requisitionId,
    p_items: items.map((i) => ({ sku_id: i.skuId, transaction_unit_id: i.transactionUnitId ?? null, entered_quantity: i.enteredQuantity, quantity: i.enteredQuantity })),
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(requisitionId);
  const code = meta?.code ?? "YCCP";

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "requisition.returned",
      actorId: profile.id,
      subject: { type: "requisition", id: requisitionId },
      participants: { requesterId: meta?.requester_id },
      payload: {
        code,
        requesterName: profile.name,
        itemSummary: `${items.length} mặt hàng`,
        items: formatRequisitionItems((meta as any)?.items),
        handlerName: profile.name,
      },
    },
  });

  revalidatePath(`/requisitions/${requisitionId}`);
  revalidatePath("/products");
}

export async function updateRequisitionInvoiceImages(id: string, invoiceImages: string[]) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_requisition_invoice_images", {
    p_id: id,
    p_invoice_images: invoiceImages,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(id);
  const code = meta?.code ?? "YCCP";

  try {
    // Nếu người tải là người yêu cầu hoặc nhân viên, thông báo cho quản kho kiểm tra
    const { data: whUsers } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["warehouse", "owner"])
      .eq("is_active", true);

    if (whUsers && whUsers.length > 0) {
      const filteredRecipients = whUsers.filter((u) => u.id !== profile.id);
      if (filteredRecipients.length > 0) {
        await supabase.from("notifications").insert(
          filteredRecipients.map((u) => ({
            user_id: u.id,
            type: "requisition",
            title: `[Yêu cầu cấp phát] ${code} - Đã tải hóa đơn nhận hàng`,
            body: `${profile.name} đã tải lên ${invoiceImages.length} ảnh hóa đơn / chứng từ nhận hàng từ NCC. Quản kho vui lòng kiểm tra và duyệt hoàn tất phiếu.`,
            link: `/requisitions/${id}`,
          }))
        );
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.warn("[updateRequisitionInvoiceImages] In-app notification error:", err);
  }

  try {
    const adminClient = createAdminClient();
    const { data: linkedRecs } = await adminClient
      .from("receipts")
      .select("id, invoice_images")
      .contains("linked_requisition_ids", [id]);
    for (const rec of linkedRecs ?? []) {
      const merged = Array.from(new Set([...(rec.invoice_images ?? []), ...invoiceImages])).filter(Boolean);
      await adminClient
        .from("receipts")
        .update({ invoice_images: merged, updated_at: new Date().toISOString() })
        .eq("id", rec.id);
      revalidatePath(`/receipts/${rec.id}`);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.warn("[updateRequisitionInvoiceImages] Sync receipts error:", err);
  }

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
  revalidatePath("/receipts");
}

export async function completeRequisitionDirect(id: string, notes?: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("complete_requisition_direct", {
    p_id: id,
    p_by: profile.id,
    p_notes: notes || "Duyệt nhận hàng trực tiếp qua hóa đơn NCC",
  });
  if (error) throw new Error(error.message);

  const meta = await requisitionMeta(id);
  const code = meta?.code ?? "YCCP";

  try {
    if (meta?.requester_id && meta.requester_id !== profile.id) {
      await supabase.from("notifications").insert({
        user_id: meta.requester_id,
        type: "requisition",
        title: `[Yêu cầu cấp phát] ${code} - Đã duyệt nhận hàng theo hóa đơn`,
        body: `Quản kho ${profile.name} đã kiểm tra hóa đơn và duyệt hoàn tất phiếu yêu cầu cấp phát của bạn.`,
        link: `/requisitions/${id}`,
      });
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.warn("[completeRequisitionDirect] In-app notification error:", err);
  }

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "requisition.received",
      actorId: profile.id,
      subject: { type: "requisition", id },
      participants: { requesterId: meta?.requester_id },
      payload: {
        code,
        items: formatRequisitionItems((meta as any)?.items),
        handlerName: profile.name,
      },
    },
  });

  try {
    const adminClient = createAdminClient();
    const { data: reqData } = await adminClient
      .from("requisitions")
      .select("invoice_images")
      .eq("id", id)
      .single();
    const reqImages = reqData?.invoice_images ?? [];
    if (reqImages.length > 0) {
      const { data: linkedRecs } = await adminClient
        .from("receipts")
        .select("id, invoice_images")
        .contains("linked_requisition_ids", [id]);
      for (const rec of linkedRecs ?? []) {
        const merged = Array.from(new Set([...(rec.invoice_images ?? []), ...reqImages])).filter(Boolean);
        await adminClient
          .from("receipts")
          .update({ invoice_images: merged, updated_at: new Date().toISOString() })
          .eq("id", rec.id);
        revalidatePath(`/receipts/${rec.id}`);
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.warn("[completeRequisitionDirect] Sync receipts error:", err);
  }

  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
  revalidatePath("/receipts");
  revalidatePath("/dashboard");
  revalidatePath("/products");
}