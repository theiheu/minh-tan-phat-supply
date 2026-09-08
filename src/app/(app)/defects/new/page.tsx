import { DefectForm } from "@/features/defects/components/defect-form";
import { fetchCompositeVariantIds } from "@/features/products/data";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewDefectPage() {
  const supabase = await createClient();

  const [mainLocations, { data: variants }, compositeIds] = await Promise.all([
    supabase.from("stock_locations").select("id, code, name").eq("type", "main").eq("is_active", true).order("code"),
    supabase.from("variants").select("id, attributes, unit, products(name)").order("id"),
    fetchCompositeVariantIds(supabase),
  ]);

  // Kho nguồn mặc định = Kho chính (bỏ bước chọn kho cho người yêu cầu).
  const main = mainLocations.data ?? [];
  const sourceLocationId =
    main.find((l) => l.code === "KHO_CHINH")?.id ?? main[0]?.id ?? "";

  // Dòng bộ không có tồn vật lý riêng (tồn bộ = min linh kiện) → không lập phiếu hỏng cho dòng bộ.
  const variantOptions = (variants ?? [])
    .filter((v) => !compositeIds.has(v.id))
    .map((v) => ({
      id: v.id,
      name: v.products?.name ?? "Vật tư",
      detail: variantLabel(v.attributes, v.unit),
    }));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-1">
      <DefectForm
        sourceLocationId={sourceLocationId}
        variants={variantOptions}
      />
    </div>
  );
}
