import { notFound } from "next/navigation";
import { ReceiptForm, type ItemDraft } from "@/features/receipts/components/receipt-form";
import { fetchCompositeVariantIds } from "@/features/products/data";
import { variantLabel } from "@/lib/labels";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: receipt },
    { data: receiptItems },
    { data: suppliers },
    { data: variants },
    compositeIds,
  ] = await Promise.all([
    supabase.from("receipts").select("*").eq("id", id).single(),
    supabase.from("receipt_items").select("*").eq("receipt_id", id).order("created_at", { ascending: true }),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("variants").select("id, attributes, unit, is_trackable_lot, products(name)").order("id"),
    fetchCompositeVariantIds(supabase),
  ]);

  if (!receipt || (receipt.status !== "draft" && receipt.status !== "approved")) {
    notFound();
  }

  const variantOptions = (variants ?? [])
    .filter((v) => !compositeIds.has(v.id))
    .map((v) => ({
      id: v.id,
      name: v.products?.name ?? "Vật tư",
      detail: variantLabel(v.attributes, v.unit),
      isTrackableLot: v.is_trackable_lot,
    }));

  const initialItems: ItemDraft[] = (receiptItems ?? []).map((it) => ({
    variantId: it.variant_id,
    quantity: String(it.quantity),
    unitCost: it.unit_cost != null ? String(it.unit_cost) : "",
    batchNo: it.batch_no ?? "",
    expiryDate: it.expiry_date ?? "",
  }));

  return (
    <ReceiptForm
      receiptId={receipt.id}
      receiptCode={receipt.code}
      receiptStatus={receipt.status}
      initialSupplierId={receipt.supplier_id}
      initialNotes={receipt.notes ?? ""}
      initialInvoiceImages={receipt.invoice_images ?? []}
      initialItems={initialItems}
      suppliers={suppliers ?? []}
      variants={variantOptions}
      currentUser={profile ? { id: profile.id, role: profile.role, name: profile.name } : null}
      creatorId={receipt.created_by}
    />
  );
}
