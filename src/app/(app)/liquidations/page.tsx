import { LiquidationManager } from "@/features/liquidations/components/liquidation-manager";
import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { getCurrentProfile } from "@/lib/auth";
import { variantLabel } from "@/lib/labels";
import { isSuperuser } from "@/lib/types";
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
  const isDev = isSuperuser(profile?.role);

  const supabase = await createClient();
  const { data: hong } = await supabase.from("stock_locations").select("id").eq("code", "KHO_HONG").single();

  const [{ data: notes, count }, { data: balances }] = await Promise.all([
    supabase
      .from("liquidation_notes")
      .select("id, code, status, reason, liquidation_items(id, quantity, method, variants(attributes, unit, products(name)))", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    hong
      ? supabase
          .from("stock_balances")
          .select("quantity, variants(id, attributes, unit, products(name))")
          .eq("location_id", hong.id)
          .gt("quantity", 0)
      : Promise.resolve({ data: [] }),
  ]);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

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

  return (
    <div className="space-y-4">
      <SubnavTabs group="defects" />
      <LiquidationManager
        notes={noteRows}
        variants={variants}
        page={page}
        totalPages={totalPages}
        isDev={isDev}
      />
    </div>
  );
}
