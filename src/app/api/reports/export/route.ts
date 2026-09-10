import { NextResponse, type NextRequest } from "next/server";
import { getDateRangeFromPreset } from "@/features/reports/lib/calculations";
import {
  buildPartnersExcel,
  buildRequisitionsExcel,
  buildStockCardExcel,
  buildStockLedgerExcel,
  buildVehicleExcel,
  buildZoneCostExcel,
} from "@/features/reports/lib/excel-export";
import {
  fetchGeneralReportData,
  fetchPartnersReportData,
  fetchRequisitionsReportData,
  fetchStockCardData,
  fetchVehicleReportData,
  fetchZoneCostReportData,
} from "@/features/reports/queries";
import { requireManager } from "@/lib/auth";
import { REQUISITION_STATUS } from "@/lib/labels";
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
    const status = searchParams.get("status") || undefined;
    const zone = searchParams.get("zone") || undefined;
    const q = searchParams.get("q") || undefined;

    // Fallback date range to current month if not specified (except requisitions which can filter all-time if not specified)
    if (type !== "requisitions" && (!from || !to)) {
      const defaultRange = getDateRangeFromPreset("this_month");
      from = from || defaultRange.from;
      to = to || defaultRange.to;
    }

    const fromStr = from || "";
    const toStr = to || "";
    const range = { from: fromStr, to: toStr };
    let buffer: Uint8Array;
    let filename: string;

    switch (type) {
      case "requisitions": {
        let zoneName: string | undefined;
        if (zone && zone !== "all") {
          const supabase = await createClient();
          const { data: z } = await supabase
            .from("zones")
            .select("name")
            .eq("id", zone)
            .maybeSingle();
          if (z?.name) zoneName = z.name;
        }

        const data = await fetchRequisitionsReportData({
          status,
          zoneId: zone,
          q,
          from: from || null,
          to: to || null,
        });

        buffer = await buildRequisitionsExcel(data, { from, to }, {
          status: status ? REQUISITION_STATUS[status] || status : undefined,
          zoneName,
        });
        filename = `bao-cao-yeu-cau-vat-tu-${from || "tat-ca"}-den-${to || "tat-ca"}.xlsx`;
        break;
      }

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

        const data = await fetchGeneralReportData({ locationId: location, from: fromStr, to: toStr });
        buffer = await buildStockLedgerExcel(data, range, locationName);
        filename = `bao-cao-xnt-${fromStr}-den-${toStr}.xlsx`;
        break;
      }

      case "zone_cost": {
        const data = await fetchZoneCostReportData({ from: fromStr, to: toStr });
        buffer = await buildZoneCostExcel(data, range);
        filename = `chi-phi-chuong-${fromStr}-den-${toStr}.xlsx`;
        break;
      }

      case "vehicles": {
        const data = await fetchVehicleReportData({ from: fromStr, to: toStr });
        buffer = await buildVehicleExcel(data, range);
        filename = `nhien-lieu-xe-${fromStr}-den-${toStr}.xlsx`;
        break;
      }

      case "partners": {
        const data = await fetchPartnersReportData({ from: fromStr, to: toStr });
        buffer = await buildPartnersExcel(data, range);
        filename = `doi-tac-${fromStr}-den-${toStr}.xlsx`;
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
          from: fromStr,
          to: toStr,
        });
        buffer = await buildStockCardExcel(data, range);
        filename = `the-kho-${fromStr}-den-${toStr}.xlsx`;
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
