import { ReceiptForm, type ItemDraft } from "@/features/receipts/components/receipt-form";
import { fetchCompositeVariantIds } from "@/features/products/data";
import { variantLabel } from "@/lib/labels";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewReceiptPage({
  searchParams,
}: {
  searchParams?: Promise<{ requisition_id?: string }>;
}) {
  const profile = await getCurrentProfile();
  const sp = searchParams ? await searchParams : undefined;
  const requisitionId = sp?.requisition_id;
  const supabase = await createClient();

  const [{ data: suppliers }, { data: variants }, compositeIds] = await Promise.all([
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
    supabase
      .from("variants")
      .select("id, attributes, unit, is_trackable_lot, products(name)")
      .order("id"),
    fetchCompositeVariantIds(supabase),
  ]);

  // Loại dòng "bộ" khỏi phiếu nhập: bộ không nhập thẳng (tồn bộ tự theo linh kiện) —
  // nhập kho theo từng linh kiện.
  const variantOptions = (variants ?? [])
    .filter((v) => !compositeIds.has(v.id))
    .map((v) => ({
      id: v.id,
      name: v.products?.name ?? "Vật tư",
      detail: variantLabel(v.attributes, v.unit),
      isTrackableLot: v.is_trackable_lot,
    }));

  let initialItems: ItemDraft[] | undefined;
  let initialNotes = "";

  if (requisitionId) {
    const [{ data: req }, { data: reqItems }] = await Promise.all([
      supabase.from("requisitions").select("code, purpose").eq("id", requisitionId).single(),
      supabase
        .from("requisition_items")
        .select("variant_id, quantity")
        .eq("requisition_id", requisitionId),
    ]);

    if (reqItems && reqItems.length > 0) {
      initialItems = reqItems
        .filter((it) => !compositeIds.has(it.variant_id))
        .map((it) => ({
          variantId: it.variant_id,
          quantity: String(it.quantity),
          unitCost: "",
          batchNo: "",
          expiryDate: "",
        }));
    }
    if (req) {
      initialNotes = `Đặt hàng bổ sung cho phiếu yêu cầu ${req.code}${req.purpose ? ` (${req.purpose})` : ""}`;
    }
  }

  return (
    <ReceiptForm
      suppliers={suppliers ?? []}
      variants={variantOptions}
      initialItems={initialItems}
      initialNotes={initialNotes}
      currentUser={profile ? { id: profile.id, role: profile.role, name: profile.name } : null}
    />
  );
}
