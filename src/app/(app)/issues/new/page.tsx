import { IssueForm } from "@/features/issues/components/issue-form";
import { requireManager } from "@/lib/auth";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewIssuePage() {
  await requireManager();
  const supabase = await createClient();
  const [{ data: zones }, { data: customers }, { data: variants }] = await Promise.all([
    supabase.from("zones").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("customers").select("id, name").is("deleted_at", null).order("name"),
    supabase
      .from("variants")
      .select("id, attributes, unit, is_trackable_lot, price, products(name)")
      .order("id"),
  ]);

  const variantOptions = (variants ?? []).map((v) => ({
    id: v.id,
    name: v.products?.name ?? "Vật tư",
    detail: variantLabel(v.attributes, v.unit),
    isTrackableLot: v.is_trackable_lot,
    price: v.price,
  }));

  return <IssueForm zones={zones ?? []} customers={customers ?? []} variants={variantOptions} />;
}
