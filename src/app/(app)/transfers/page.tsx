import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { TransfersManager } from "@/features/transfers/components/transfers-manager";
import { fetchCompositeVariantIds } from "@/features/products/data";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const supabase = await createClient();
  const [{ data: locations }, { data: variants }, compositeIds] = await Promise.all([
    supabase.from("stock_locations").select("id, name").eq("is_active", true).order("code"),
    supabase.from("variants").select("id, attributes, unit, products(name)").order("id"),
    fetchCompositeVariantIds(supabase),
  ]);

  // Chuyển kho chuyển tồn vật lý — dòng bộ không có tồn vật lý riêng nên loại khỏi danh sách.
  const variantOptions = (variants ?? [])
    .filter((v) => !compositeIds.has(v.id))
    .map((v) => ({
      id: v.id,
      label: `${v.products?.name ?? "Vật tư"} — ${variantLabel(v.attributes, v.unit)}`,
    }));

  return (
    <div className="space-y-4">
      <SubnavTabs group="warehouse" />
      <TransfersManager locations={locations ?? []} variants={variantOptions} />
    </div>
  );
}
