"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchBusinessEvent } from "@/features/notifications/server/dispatch-business-event";
import { receiptSchema, type ReceiptInput } from "./schema";

async function receiptMeta(id: string) {
  try {
    const supabase = await createClient();
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("receipts")
      .select(`
        code,
        created_by,
        notes,
        supplier:suppliers(name),
        items:receipt_items(
          quantity,
          entered_quantity,
          unit_cost,
          batch_no,
          expiry_date,
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

function formatReceiptItems(items?: any[] | null) {
  if (!items || items.length === 0) return undefined;
  return items.map((i) => {
    const batchInfo = [i.batch_no ? `Lô: ${i.batch_no}` : null, i.expiry_date ? `HSD: ${i.expiry_date}` : null]
      .filter(Boolean)
      .join(" - ");
    return {
      name: i.sku_name_snapshot || i.skus?.products?.name || "Vật tư",
      quantity: i.entered_quantity ?? i.quantity,
      unit: i.uom_name_snapshot || i.skus?.units?.name || i.skus?.units?.symbol || "",
      note: batchInfo || undefined,
    };
  });
}

export async function createReceipt(input: ReceiptInput) {
  const profile = await requireProfile();
  const parsed = receiptSchema.parse(input);

  const supabase = await createClient();
  const items = parsed.items.map((i) => ({
    sku_id: i.skuId,
    transaction_unit_id: i.transactionUnitId ?? null,
    entered_quantity: i.enteredQuantity,
    unit_cost: i.unitCost,
    allocations: i.allocations ?? []
  }));

  const { data, error } = await supabase.rpc("create_receipt", {
    p_items: items,
    p_supplier_id: parsed.supplierId ?? (null as unknown as string),
    p_by: profile.id,
    ...(parsed.notes != null ? { p_notes: parsed.notes } : {}),
    p_invoice_images: parsed.invoiceImages ?? [],
    p_linked_requisition_ids: parsed.linkedRequisitionIds ?? [],
  });

  if (error) throw new Error(error.message);

  const receiptId = data as string;
  if (receiptId) {
    const meta = await receiptMeta(receiptId);
    const code = meta?.code ?? "PNK";
    const supplierName = (meta?.supplier as { name?: string } | null)?.name;

    await dispatchBusinessEvent({
      supabase,
      input: {
        event: "receipt.created",
        actorId: profile.id,
        subject: { type: "receipt", id: receiptId },
        payload: {
          code,
          supplierName: supplierName ?? undefined,
          receiverName: profile.name,
          items: formatReceiptItems((meta as any)?.items),
          notes: parsed.notes ?? undefined,
        },
      },
    });

    try {
      if (parsed.linkedRequisitionIds && parsed.linkedRequisitionIds.length > 0) {
        const { data: linkedReqs } = await supabase
          .from("requisitions")
          .select("id, code, requester_id")
          .in("id", parsed.linkedRequisitionIds);

        if (linkedReqs && linkedReqs.length > 0) {
          await supabase.from("notifications").insert(
            linkedReqs.map((r) => ({
              user_id: r.requester_id,
              type: "requisition",
              title: `[Yêu cầu cấp phát] ${r.code} - Đã đặt hàng vật tư`,
              body: `Quản kho ${profile.name} đã tạo phiếu đặt hàng ${code}${supplierName ? ` từ nhà cung cấp ${supplierName}` : ""}. Bạn có thể theo dõi tiến độ hoặc nhận hàng trực tiếp tại nơi cung cấp.`,
              link: `/requisitions/${r.id}`,
            }))
          );
          for (const r of linkedReqs) {
            revalidatePath(`/requisitions/${r.id}`);
          }
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "test") console.warn("[createReceipt] Linked requisitions notification error:", err);
    }
  }

  revalidatePath("/receipts");
  return data as string;
}

export async function updateReceipt(id: string, input: ReceiptInput) {
  const profile = await requireProfile();
  const parsed = receiptSchema.parse(input);

  const supabase = await createClient();
  const items = parsed.items.map((i) => ({
    sku_id: i.skuId,
    transaction_unit_id: i.transactionUnitId ?? null,
    entered_quantity: i.enteredQuantity,
    unit_cost: i.unitCost,
    allocations: i.allocations ?? []
  }));

  const { error } = await supabase.rpc("update_receipt", {
    p_id: id,
    p_items: items,
    p_supplier_id: parsed.supplierId ?? (null as unknown as string),
    p_by: profile.id,
    ...(parsed.notes != null ? { p_notes: parsed.notes } : {}),
    p_invoice_images: parsed.invoiceImages ?? [],
    p_linked_requisition_ids: parsed.linkedRequisitionIds ?? null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/receipts");
  revalidatePath(`/receipts/${id}`);
}

export async function updateReceiptInvoiceImages(id: string, invoiceImages: string[]) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_receipt_invoice_images", {
    p_id: id,
    p_invoice_images: invoiceImages,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);

  try {
    const adminClient = createAdminClient();
    const { data: rec } = await adminClient
      .from("receipts")
      .select("linked_requisition_ids")
      .eq("id", id)
      .single();
    const linkedIds = rec?.linked_requisition_ids ?? [];
    for (const reqId of linkedIds) {
      const { data: req } = await adminClient
        .from("requisitions")
        .select("invoice_images")
        .eq("id", reqId)
        .single();
      const merged = Array.from(new Set([...(req?.invoice_images ?? []), ...invoiceImages])).filter(Boolean);
      await adminClient
        .from("requisitions")
        .update({ invoice_images: merged, updated_at: new Date().toISOString() })
        .eq("id", reqId);
      revalidatePath(`/requisitions/${reqId}`);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.warn("[updateReceiptInvoiceImages] Sync reqs error:", err);
  }

  revalidatePath("/receipts");
  revalidatePath(`/receipts/${id}`);
}

export async function approveReceipt(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_receipt", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await receiptMeta(id);
  const code = meta?.code ?? "PNK";
  const _supplierName = (meta?.supplier as { name?: string } | null)?.name;
  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "receipt.approved",
      actorId: profile.id,
      subject: { type: "receipt", id },
      payload: {
        code,
        supplierName: (meta?.supplier as { name?: string } | null)?.name ?? undefined,
        receiverName: profile.name,
        items: formatReceiptItems((meta as any)?.items),
        notes: meta?.notes ?? undefined,
      },
    },
  });

  revalidatePath("/receipts");
  revalidatePath(`/receipts/${id}`);
}

export async function postReceipt(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_receipt", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await receiptMeta(id);
  const code = meta?.code ?? "PNK";
  const supplierName = (meta?.supplier as { name?: string } | null)?.name;
  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "receipt.posted",
      actorId: profile.id,
      subject: { type: "receipt", id },
      payload: {
        code,
        supplierName: supplierName ?? undefined,
        receiverName: profile.name,
        items: formatReceiptItems((meta as any)?.items),
        notes: meta?.notes ?? undefined,
      },
    },
  });

  try {
    const adminClient = createAdminClient();
    const { data: rec } = await adminClient
      .from("receipts")
      .select("linked_requisition_ids, invoice_images")
      .eq("id", id)
      .single();
    const linkedIds = rec?.linked_requisition_ids ?? [];
    const allImages = [...(rec?.invoice_images ?? [])];
    for (const reqId of linkedIds) {
      const { data: req } = await adminClient
        .from("requisitions")
        .select("invoice_images")
        .eq("id", reqId)
        .single();
      if (req?.invoice_images) allImages.push(...req.invoice_images);
    }
    const finalImages = Array.from(new Set(allImages)).filter(Boolean);
    if (finalImages.length > (rec?.invoice_images?.length ?? 0)) {
      await adminClient
        .from("receipts")
        .update({ invoice_images: finalImages, updated_at: new Date().toISOString() })
        .eq("id", id);
    }
    for (const reqId of linkedIds) {
      await adminClient
        .from("requisitions")
        .update({ invoice_images: finalImages, updated_at: new Date().toISOString() })
        .eq("id", reqId);
      revalidatePath(`/requisitions/${reqId}`);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.warn("[postReceipt] Sync invoice images error:", err);
  }

  revalidatePath("/receipts");
  revalidatePath(`/receipts/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/products");
  return data;
}

export async function cancelReceipt(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const meta = await receiptMeta(id);
  const code = meta?.code ?? "PNK";
  const supplierName = (meta?.supplier as { name?: string } | null)?.name;

  const { error } = await supabase.rpc("cancel_receipt", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "receipt.cancelled_or_reversed",
      actorId: profile.id,
      subject: { type: "receipt", id },
      payload: {
        code,
        supplierName,
        receiverName: profile.name,
        items: formatReceiptItems((meta as any)?.items),
      },
    },
  });

  revalidatePath("/receipts");
}