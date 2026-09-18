import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ReceiptForm, type ItemDraft } from "@/features/receipts/components/receipt-form";
import { getCurrentProfile } from "@/lib/auth";
import { getCachedCategories, getCachedCompositeVariantIds, getCachedSuppliers, getCachedVariantOptions } from "@/lib/cached-metadata";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: receipt },
    { data: receiptItems },
    suppliers,
    variants,
    compositeIdsArr,
    categories,
  ] = await Promise.all([
    supabase.from("receipts").select("*").eq("id", id).single(),
    supabase.from("receipt_items").select("*").eq("receipt_id", id).order("created_at", { ascending: true }),
    getCachedSuppliers(),
    getCachedVariantOptions(),
    getCachedCompositeVariantIds(),
    getCachedCategories(),
  ]);

  if (!receipt || (receipt.status !== "draft" && receipt.status !== "approved")) {
    notFound();
  }

  const compositeIds = new Set(compositeIdsArr);
  const variantOptions = variants
    .filter((v) => !compositeIds.has(v.id))
    .map((v) => ({
      id: v.id,
      name: v.productName,
      detail: v.detail,
      isTrackableLot: v.isTrackableLot,
    }));

  const initialItems: ItemDraft[] = (receiptItems ?? []).map((it) => {
    const rec = it as typeof it & { transaction_unit_id?: string | null; entered_quantity?: number | null; trackingPolicy?: string };
    return {
      skuId: rec.variant_id,
      transactionUnitId: rec.transaction_unit_id ?? "",
      enteredQuantity: rec.entered_quantity !== null && rec.entered_quantity !== undefined ? String(rec.entered_quantity) : String(rec.quantity),
      unitCost: rec.unit_cost != null ? String(rec.unit_cost) : "",
      batchNo: rec.batch_no ?? "",
      expiryDate: rec.expiry_date ?? "",
      trackingPolicy: rec.trackingPolicy ?? "none"
    };
  });

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href={"/receipts/" + receipt.id} className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="size-3.5" />
          {receipt.code}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="text-foreground font-medium">Chỉnh sửa</span>
      </nav>

      <ReceiptForm
      receiptId={receipt.id}
      receiptCode={receipt.code}
      receiptStatus={receipt.status}
      initialSupplierId={receipt.supplier_id}
      initialNotes={receipt.notes ?? ""}
      initialInvoiceImages={receipt.invoice_images ?? []}
      initialItems={initialItems}
      suppliers={suppliers ?? []}

      categories={categories ?? []}
      currentUser={profile ? { id: profile.id, role: profile.role, name: profile.name } : null}
      creatorId={receipt.created_by}
      />
    </div>
  );
}