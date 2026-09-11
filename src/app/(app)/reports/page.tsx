import { getPresetRange } from "@/features/reports/lib/date-utils";
import { ReportsHub } from "@/features/reports/components/reports-hub";
import type { StockVariantOption } from "@/features/reports/components/stock-card-tab";
import { fetchGeneralReportData } from "@/features/reports/queries";
import { requireManager } from "@/lib/auth";
import { getCachedStockLocations, getCachedVariantOptions } from "@/lib/cached-metadata";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireManager();

  const defaultRange = getPresetRange("this_month");
  const initialDateRange = {
    from: defaultRange.from,
    to: defaultRange.to,
    preset: "this_month" as const,
    locationId: undefined,
  };

  const [locationsData, variantsData, initialGeneralData] = await Promise.all([
    getCachedStockLocations(),
    getCachedVariantOptions(),
    fetchGeneralReportData({
      from: defaultRange.from,
      to: defaultRange.to,
    }),
  ]);

  const locations = locationsData.map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
  }));

  const variants: StockVariantOption[] = variantsData.map((v) => ({
    id: v.id,
    productName: v.productName,
    variantLabel: v.detail,
    unit: v.unit || "",
  }));

  return (
    <ReportsHub
      initialGeneralData={initialGeneralData}
      locations={locations}
      variants={variants}
      initialDateRange={initialDateRange}
    />
  );
}
