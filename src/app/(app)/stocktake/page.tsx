import { StocktakeManager } from "@/features/stocktake/components/stocktake-manager";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StocktakePage() {
  const supabase = await createClient();
  const [{ data: locations }, { data: sessions }] = await Promise.all([
    supabase.from("stock_locations").select("id, name").eq("is_active", true).order("code"),
    supabase
      .from("stocktake_sessions")
      .select(
        "id, code, status, posted_at, location:stock_locations!stocktake_sessions_location_id_fkey(name), stocktake_items(id, system_qty, actual_qty, variants(attributes, unit, products(name)))",
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const rows = (sessions ?? []).map((s) => ({
    id: s.id,
    code: s.code,
    locationName: s.location?.name ?? "—",
    status: s.status,
    postedAt: s.posted_at,
    items: (s.stocktake_items ?? []).map((i) => ({
      id: i.id,
      label: `${i.variants?.products?.name ?? "Vật tư"} — ${variantLabel(i.variants?.attributes, i.variants?.unit)}`,
      systemQty: i.system_qty,
      actualQty: i.actual_qty,
    })),
  }));

  return <StocktakeManager sessions={rows} locations={locations ?? []} />;
}
