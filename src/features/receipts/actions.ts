"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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

    try {
      const { data: whUsers } = await supabase.from("profiles").select("id").in("role", ["warehouse", "owner"]).eq("is_active", true);
      if (whUsers && whUsers.length > 0) {
        await supabase.from("notifications").insert(
          whUsers.map((u) => ({
            user_id: u.id,
            type: "receipt",
            title: `[Nhập kho] ${code} - Tạo mới phiếu nhập kho`,
            body: `Người lập ${profile.name} đã tạo phiếu nhập kho từ nhà cung cấp ${supplierName || "N/A"}.`,
            link: `/receipts/${receiptId}`,
          }))
        );
      }

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
      if (process.env.NODE_ENV !== "test") console.warn("[createReceipt] In-app notification error:", err);
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
  try {
    const userIds = [...new Set([meta?.created_by].filter(Boolean))];
    if (userIds.length > 0) {
      await supabase.from("notifications").insert(
        userIds.map((uid) => ({
          user_id: uid!,
          type: "receipt",
          title: `[Nhập kho] ${code} - Đã phê duyệt nhập kho`,
          body: `Phiếu nhập kho đã được phê duyệt bởi ${profile.name}.`,
          link: `/receipts/${id}`,
        }))
      );
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.warn("[approveReceipt] In-app notification error:", err);
  }

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

  revalidatePath("/receipts");
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