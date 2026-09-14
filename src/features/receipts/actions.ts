"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getManagerIds, notifyUsers } from "@/lib/notifications";
import { receiptSchema, type ReceiptInput } from "./schema";

async function receiptMeta(id: string) {
  try {
    const supabase = await createClient();
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("receipts")
      .select("code, created_by, notes, supplier:suppliers(name)")
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function createReceipt(input: ReceiptInput) {
  const profile = await requireProfile();
  const parsed = receiptSchema.parse(input);

  const supabase = await createClient();
  const items = parsed.items.map((i) => ({
    variant_id: i.variantId,
    quantity: i.quantity,
    unit_cost: i.unitCost,
    batch_no: i.batchNo ?? null,
    expiry_date: i.expiryDate ?? null,
  }));

  const { data, error } = await supabase.rpc("create_receipt", {
    p_items: items,
    p_supplier_id: parsed.supplierId ?? (null as unknown as string),
    p_by: profile.id,
    ...(parsed.notes != null ? { p_notes: parsed.notes } : {}),
    p_invoice_images: parsed.invoiceImages ?? [],
  });

  if (error) throw new Error(error.message);

  const receiptId = data as string;
  if (receiptId) {
    const meta = await receiptMeta(receiptId);
    const code = meta?.code ?? "PNK";
    const supplierName = (meta?.supplier as { name?: string } | null)?.name;

    await notifyUsers({
      userIds: await getManagerIds(supabase),
      type: "receipt",
      title: `[Nhập kho] ${code} - Tạo mới phiếu nhập kho`,
      body: `Người lập ${profile.name} đã tạo phiếu nhập kho từ nhà cung cấp ${supplierName || "N/A"}, chờ kiểm đếm và phê duyệt.`,
      link: `/receipts/${receiptId}`,
      document: {
        code,
        type: "Phiếu nhập kho",
        status: "Chờ phê duyệt",
        statusVariant: "warning",
        creatorName: profile.name,
        locationName: supplierName,
        notes: parsed.notes,
      },
    });
  }

  revalidatePath("/receipts");
  return data as string;
}

export async function updateReceipt(id: string, input: ReceiptInput) {
  const profile = await requireProfile();
  const parsed = receiptSchema.parse(input);

  const supabase = await createClient();
  const items = parsed.items.map((i) => ({
    variant_id: i.variantId,
    quantity: i.quantity,
    unit_cost: i.unitCost,
    batch_no: i.batchNo ?? null,
    expiry_date: i.expiryDate ?? null,
  }));

  const { error } = await supabase.rpc("update_receipt", {
    p_id: id,
    p_items: items,
    p_supplier_id: parsed.supplierId ?? (null as unknown as string),
    p_by: profile.id,
    ...(parsed.notes != null ? { p_notes: parsed.notes } : {}),
    p_invoice_images: parsed.invoiceImages ?? [],
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
  const supplierName = (meta?.supplier as { name?: string } | null)?.name;
  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([meta?.created_by, ...managers])];

  await notifyUsers({
    userIds,
    type: "receipt",
    title: `[Nhập kho] ${code} - Đã phê duyệt nhập kho`,
    body: `Phiếu nhập kho đã được phê duyệt bởi ${profile.name}, sẵn sàng hoàn tất ghi nhận sổ kho.`,
    link: `/receipts/${id}`,
    document: {
      code,
      type: "Phiếu nhập kho",
      status: "Đã phê duyệt",
      statusVariant: "success",
      handlerName: profile.name,
      locationName: supplierName,
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
  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([meta?.created_by, ...managers])];

  await notifyUsers({
    userIds,
    type: "receipt",
    title: `[Nhập kho] ${code} - Hoàn tất nhập kho (Ghi nhận sổ kho)`,
    body: `Thủ kho ${profile.name} đã hoàn tất nhập kho. Tồn kho và giá vốn đã được cập nhật thành công vào hệ thống MTP-ERN.`,
    link: `/receipts/${id}`,
    document: {
      code,
      type: "Phiếu nhập kho",
      status: "Đã nhập kho",
      statusVariant: "success",
      handlerName: profile.name,
      locationName: supplierName,
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

  const { error } = await supabase.rpc("cancel_receipt", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([meta?.created_by, ...managers])];

  await notifyUsers({
    userIds,
    type: "receipt",
    title: `[Nhập kho] ${code} - Đã hủy phiếu nhập kho`,
    body: `Phiếu nhập kho đã được hủy bỏ trên hệ thống bởi ${profile.name}.`,
    link: "/receipts",
    document: {
      code,
      type: "Phiếu nhập kho",
      status: "Đã hủy",
      statusVariant: "neutral",
      handlerName: profile.name,
    },
  });

  revalidatePath("/receipts");
}