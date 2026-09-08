import { NextResponse, type NextRequest } from "next/server";
import { getDateRangeFromPreset } from "@/features/reports/lib/calculations";
import {
  buildPartnersExcel,
  buildStockCardExcel,
  buildStockLedgerExcel,
  buildVehicleExcel,
  buildZoneCostExcel,
} from "@/features/reports/lib/excel-export";
import {
  fetchGeneralReportData,
  fetchPartnersReportData,
  fetchStockCardData,
  fetchVehicleReportData,
  fetchZoneCostReportData,
} from "@/features/reports/queries";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireManager();
    const { searchParams } = req.nextUrl;

    const type = searchParams.get("type") || "stock_ledger";
    let from = searchParams.get("from");
    let to = searchParams.get("to");
    const location = searchParams.get("location") || undefined;
    const variantId = searchParams.get("variantId") || undefined;

    // Fallback date range to current month if not specified
    if (!from || !to) {
      const defaultRange = getDateRangeFromPreset("this_month");
      from = from || defaultRange.from;
      to = to || defaultRange.to;
    }

    const range = { from, to };
    let buffer: Uint8Array;
    let filename: string;

    switch (type) {
      case "stock_ledger": {
        let locationName: string | undefined;
        if (location && location !== "all") {
          const supabase = await createClient();
          const { data: loc } = await supabase
            .from("stock_locations")
            .select("name")
            .eq("id", location)
            .maybeSingle();
          if (loc?.name) locationName = loc.name;
        }

        const data = await fetchGeneralReportData({ locationId: location, from, to });
        buffer = buildStockLedgerExcel(data, range, locationName);
        filename = `bao-cao-xnt-${from}-den-${to}.xlsx`;
        break;
      }

      case "zone_cost": {
        const data = await fetchZoneCostReportData({ from, to });
        buffer = buildZoneCostExcel(data, range);
        filename = `chi-phi-chuong-${from}-den-${to}.xlsx`;
        break;
      }

      case "vehicles": {
        const data = await fetchVehicleReportData({ from, to });
        buffer = buildVehicleExcel(data, range);
        filename = `nhien-lieu-xe-${from}-den-${to}.xlsx`;
        break;
      }

      case "partners": {
        const data = await fetchPartnersReportData({ from, to });
        buffer = buildPartnersExcel(data, range);
        filename = `doi-tac-${from}-den-${to}.xlsx`;
        break;
      }

      case "stock_card": {
        if (!variantId) {
          return new NextResponse("Thiếu mã biến thể (variantId) cho báo cáo thẻ kho", {
            status: 400,
          });
        }
        const data = await fetchStockCardData({
          variantId,
          locationId: location,
          from,
          to,
        });
        buffer = buildStockCardExcel(data, range);
        filename = `the-kho-${from}-den-${to}.xlsx`;
        break;
      }

      default:
        return new NextResponse(`Loại báo cáo không hợp lệ: ${type}`, { status: 400 });
    }

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi xuất báo cáo Excel";
    return new NextResponse(message, { status: 500 });
  }
}
