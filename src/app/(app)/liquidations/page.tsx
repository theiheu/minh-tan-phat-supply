import { LiquidationManager } from "@/features/liquidations/components/liquidation-manager";
import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { getCurrentProfile } from "@/lib/auth";
import { variantLabel } from "@/lib/labels";
import { canDeleteDoc } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function LiquidationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const profile = await getCurrentProfile();
  const isDev = canDeleteDoc(profile?.role);

  const supabase = await createClient();
  const { data: hong } = await supabase.from("stock_locations").select("id").eq("code", "KHO_HONG").single();

  const [{ data: notes, count }, { data: balances }] = await Promise.all([
    supabase
      .from("liquidation_notes")
      .select("id, code, status, reason, liquidation_items(id, quantity, method, skus(id, sku_code, products(name), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol))))", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    hong
      ? supabase
          .from("stock_balances")
          .select("quantity, skus(id, sku_code, products(name), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol)))")
          .eq("location_id", hong.id)
          .gt("quantity", 0)
      : Promise.resolve({ data: [] }),
  ]);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const skus = (balances ?? []).map((b) => {
    const v = b.skus;
    const pName = v?.products?.name ?? "Vật tư";
    const uSymbol = v?.units?.symbol || v?.units?.name || "—";
    const attrVals = (v?.sku_attribute_values ?? []).map(av => av.text_value || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : null)).filter(Boolean);
    const detail = attrVals.length > 0 ? attrVals.join(" · ") : uSymbol;
    return {
      id: v!.id,
      label: `${pName} — ${detail}`,
      stock: b.quantity,
    };
  });

  const noteRows = (notes ?? []).map((n) => ({
    id: n.id,
    code: n.code,
    status: n.status,
    reason: n.reason,
    items: (n.liquidation_items ?? []).map((i) => {
      const v = i.skus;
      const pName = v?.products?.name ?? "Vật tư";
      const uSymbol = v?.units?.symbol || v?.units?.name || "—";
      const attrVals = (v?.sku_attribute_values ?? []).map(av => av.text_value || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : null)).filter(Boolean);
      const detail = attrVals.length > 0 ? attrVals.join(" · ") : uSymbol;
      return {
        id: i.id,
        label: `${pName} — ${detail}`,
        quantity: i.quantity,
        method: i.method,
      };
    }),
  }));

  return (
    <div className="space-y-4">
      <SubnavTabs group="defects" />
      <LiquidationManager
        notes={noteRows}
        skus={skus}
        page={page}
        totalPages={totalPages}
        isDev={isDev}
      />
    </div>
  );
}
