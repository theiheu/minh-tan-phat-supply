import { LiquidationManager } from "@/features/liquidations/components/liquidation-manager";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LiquidationsPage() {
  const supabase = await createClient();
  const { data: hong } = await supabase.from("stock_locations").select("id").eq("code", "KHO_HONG").single();

  const [{ data: notes }, { data: balances }] = await Promise.all([
    supabase
      .from("liquidation_notes")
      .select("id, code, status, reason, liquidation_items(id, quantity, method, variants(attributes, unit, products(name)))")
      .order("created_at", { ascending: false })
      .limit(100),
    hong
      ? supabase
          .from("stock_balances")
          .select("quantity, variants(id, attributes, unit, products(name))")
          .eq("location_id", hong.id)
          .gt("quantity", 0)
      : Promise.resolve({ data: [] }),
  ]);

  const variants = (balances ?? []).map((b) => ({
    id: b.variants!.id,
    label: `${b.variants!.products?.name ?? "Vật tư"} — ${variantLabel(b.variants!.attributes, b.variants!.unit)}`,
    stock: b.quantity,
  }));

  const noteRows = (notes ?? []).map((n) => ({
    id: n.id,
    code: n.code,
    status: n.status,
    reason: n.reason,
    items: (n.liquidation_items ?? []).map((i) => ({
      id: i.id,
      label: `${i.variants?.products?.name ?? "Vật tư"} — ${variantLabel(i.variants?.attributes, i.variants?.unit)}`,
      quantity: i.quantity,
      method: i.method,
    })),
  }));

  return <LiquidationManager notes={noteRows} variants={variants} />;
}
