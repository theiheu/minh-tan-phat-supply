import { DefectForm } from "@/features/defects/components/defect-form";
import { getCachedCompositeVariantIds, getCachedStockLocations, getCachedVariantOptions } from "@/lib/cached-metadata";

export const dynamic = "force-dynamic";

export default async function NewDefectPage() {
  const [locations, variants, compositeIdsArr] = await Promise.all([
    getCachedStockLocations(),
    getCachedVariantOptions(),
    getCachedCompositeVariantIds(),
  ]);

  const compositeIds = new Set(compositeIdsArr);
  const main = locations.filter((l) => l.type === "main");
  const sourceLocationId =
    main.find((l) => l.code === "KHO_CHINH")?.id ?? main[0]?.id ?? "";

  // Dòng bộ không có tồn vật lý riêng (tồn bộ = min linh kiện) → không lập phiếu hỏng cho dòng bộ.
  const variantOptions = variants
    .filter((v) => !compositeIds.has(v.id))
    .map((v) => ({
      id: v.id,
      name: v.productName,
      detail: v.detail,
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
