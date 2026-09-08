import { getPresetRange } from "@/features/reports/lib/date-utils";
import { ReportsHub } from "@/features/reports/components/reports-hub";
import type { StockVariantOption } from "@/features/reports/components/stock-card-tab";
import { fetchGeneralReportData } from "@/features/reports/queries";
import { requireManager } from "@/lib/auth";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireManager();

  const supabase = await createClient();

  const [locationsRes, variantsRes] = await Promise.all([
    supabase.from("stock_locations").select("id, code, name").order("code", { ascending: true }),
    supabase
      .from("variants")
      .select("id, attributes, unit, price, products(name)")
      .order("id", { ascending: true }),
  ]);

  const defaultRange = getPresetRange("this_month");
  const initialDateRange = {
    from: defaultRange.from,
    to: defaultRange.to,
    preset: "this_month" as const,
    locationId: undefined,
  };

  const initialGeneralData = await fetchGeneralReportData({
    from: defaultRange.from,
    to: defaultRange.to,
  });

  const locations = locationsRes.data ?? [];
  const variants: StockVariantOption[] = (variantsRes.data ?? []).map((v) => ({
    id: v.id,
    productName: (v.products as { name?: string } | null)?.name || "Vật tư",
    variantLabel: variantLabel(v.attributes, v.unit),
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
