import { ReceiptForm } from "@/features/receipts/components/receipt-form";
import { fetchCompositeVariantIds } from "@/features/products/data";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewReceiptPage() {
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

  return <ReceiptForm suppliers={suppliers ?? []} variants={variantOptions} />;
}
