"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { receiptSchema, type ReceiptInput } from "./schema";

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

export async function approveReceipt(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_receipt", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/receipts");
  revalidatePath(`/receipts/${id}`);
}

export async function postReceipt(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_receipt", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/receipts");
  revalidatePath("/dashboard");
  revalidatePath("/products");
  return data;
}

export async function cancelReceipt(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_receipt", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/receipts");
}
