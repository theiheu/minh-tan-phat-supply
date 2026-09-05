import { ReceiptForm } from "@/features/receipts/components/receipt-form";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewReceiptPage() {
  const supabase = await createClient();
  const [{ data: suppliers }, { data: variants }] = await Promise.all([
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
    supabase
      .from("variants")
      .select("id, attributes, unit, is_trackable_lot, products(name)")
      .order("id"),
  ]);

  const variantOptions = (variants ?? []).map((v) => ({
    id: v.id,
    name: v.products?.name ?? "Vật tư",
    detail: variantLabel(v.attributes, v.unit),
    isTrackableLot: v.is_trackable_lot,
  }));

  return <ReceiptForm suppliers={suppliers ?? []} variants={variantOptions} />;
}
