import { DefectForm } from "@/features/defects/components/defect-form";
import { fetchCompositeVariantIds } from "@/features/products/data";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewDefectPage() {
  const supabase = await createClient();
  const [{ data: locations }, { data: variants }, compositeIds] = await Promise.all([
    supabase.from("stock_locations").select("id, name").eq("type", "main").eq("is_active", true).order("code"),
    supabase.from("variants").select("id, attributes, unit, products(name)").order("id"),
    fetchCompositeVariantIds(supabase),
  ]);

  // Dòng bộ không có tồn vật lý riêng (tồn bộ = min linh kiện) → không lập phiếu hỏng cho dòng bộ.
  const variantOptions = (variants ?? [])
    .filter((v) => !compositeIds.has(v.id))
    .map((v) => ({
      id: v.id,
      label: `${v.products?.name ?? "Vật tư"} — ${variantLabel(v.attributes, v.unit)}`,
    }));

  return <DefectForm locations={locations ?? []} variants={variantOptions} />;
}
