import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { TransfersManager } from "@/features/transfers/components/transfers-manager";
import { getCachedCompositeVariantIds, getCachedStockLocations, getCachedVariantOptions } from "@/lib/cached-metadata";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const [locationsData, variants, compositeIdsArr] = await Promise.all([
    getCachedStockLocations(),
    getCachedVariantOptions(),
    getCachedCompositeVariantIds(),
  ]);

  const compositeIds = new Set(compositeIdsArr);
  const locations = locationsData.map((l) => ({ id: l.id, name: l.name }));

  // Chuyển kho chuyển tồn vật lý — dòng bộ không có tồn vật lý riêng nên loại khỏi danh sách.
  const variantOptions = variants
    .filter((v) => !compositeIds.has(v.id))
    .map((v) => ({
      id: v.id,
      label: `${v.productName} — ${v.detail}`,
    }));

  return (
    <div className="space-y-4">
      <SubnavTabs group="warehouse" />
      <TransfersManager locations={locations} variants={variantOptions} />
    </div>
  );
}
