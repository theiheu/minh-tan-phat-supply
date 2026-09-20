import { getPresetRange } from "@/features/reports/lib/date-utils";
import { ReportsHub } from "@/features/reports/components/reports-hub";
import type { StockVariantOption } from "@/features/reports/components/stock-card-tab";
import { fetchManagementOverviewData } from "@/features/reports/queries";
import type { OperationalReportKey, ReportSection } from "@/features/reports/types";
import { requireManager } from "@/lib/auth";
import { getCachedStockLocations, getCachedVariantOptions } from "@/lib/cached-metadata";

export const dynamic = "force-dynamic";
const reports = new Set<OperationalReportKey>(["xnt","zones","vehicles","partners","stock_card"]);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ section?:string; report?:string }> }) {
  await requireManager();
  const sp = await searchParams;
  const requestedSection = sp.section === "operations" || sp.section === "bi" ? sp.section : "overview";
  const hasValidReport = !sp.report || reports.has(sp.report as OperationalReportKey);
  const initialSection: ReportSection = requestedSection === "operations" && !hasValidReport ? "overview" : requestedSection;
  const initialReport: OperationalReportKey = sp.report && reports.has(sp.report as OperationalReportKey) ? sp.report as OperationalReportKey : "xnt";
  const defaultRange = getPresetRange("this_month");
  const initialDateRange = {
    from: defaultRange.from,
    to: defaultRange.to,
    preset: "this_month" as const,
    locationId: undefined,
  };

  let locationsData: { id: string; code: string; name: string }[] = [];
  let skusData: StockVariantOption[] = [];
  let initialOverviewData = null;

  try {
    const [rawLocations, rawSkus, overviewData] = await Promise.all([
      getCachedStockLocations().catch(() => []),
      getCachedVariantOptions().catch(() => []),
      initialSection === "overview"
        ? fetchManagementOverviewData({ from: defaultRange.from, to: defaultRange.to }).catch((err) => {
            console.error("[ReportsPage] fetchManagementOverviewData failed:", err);
            return null;
          })
        : Promise.resolve(null),
    ]);

    locationsData = (rawLocations ?? []).map((l) => ({ id: l.id, code: l.code, name: l.name }));
    skusData = (rawSkus ?? []).map((v) => ({
      id: v.id,
      productName: v.productName,
      variantLabel: v.detail,
      unit: v.unit || "",
    }));
    initialOverviewData = overviewData;
  } catch (err) {
    console.error("[ReportsPage] SSR preload error:", err);
  }

  return (
    <ReportsHub
      initialOverviewData={initialOverviewData}
      initialGeneralData={initialOverviewData?.general ?? null}
      locations={locationsData}
      variants={skusData}
      initialDateRange={initialDateRange}
      initialSection={initialSection}
      initialReport={initialReport}
    />
  );
}
