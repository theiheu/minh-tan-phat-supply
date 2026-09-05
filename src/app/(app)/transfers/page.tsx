import { TransfersManager } from "@/features/transfers/components/transfers-manager";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const supabase = await createClient();
  const [{ data: locations }, { data: variants }] = await Promise.all([
    supabase.from("stock_locations").select("id, name").eq("is_active", true).order("code"),
    supabase.from("variants").select("id, attributes, unit, products(name)").order("id"),
  ]);

  const variantOptions = (variants ?? []).map((v) => ({
    id: v.id,
    label: `${v.products?.name ?? "Vật tư"} — ${variantLabel(v.attributes, v.unit)}`,
  }));

  return <TransfersManager locations={locations ?? []} variants={variantOptions} />;
}
