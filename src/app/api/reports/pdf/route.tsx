import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { SlipDocument, type SlipColumn, type SlipField, type SlipTotals } from "@/features/pdf/slip";
import { getDateRangeFromPreset } from "@/features/reports/lib/calculations";
import {
  fetchGeneralReportData,
  fetchPartnersReportData,
  fetchStockCardData,
  fetchVehicleReportData,
  fetchZoneCostReportData,
} from "@/features/reports/queries";
import { requireManager } from "@/lib/auth";
import { formatDate, formatDateTime, formatNumber, formatVnd } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const REPORT_SIGNERS = ["Người lập báo cáo", "Kế toán trại", "Quản lý / Chủ trại duyệt"];

export async function GET(req: NextRequest) {
  try {
    await requireManager();
    ensurePdfFonts();

    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type") || "stock_ledger";
    let from = searchParams.get("from");
    let to = searchParams.get("to");
    const location = searchParams.get("location") || undefined;
    const variantId = searchParams.get("variantId") || undefined;

    // Fallback date range to current month if not provided
    if (!from || !to) {
      const defaultRange = getDateRangeFromPreset("this_month");
      from = from || defaultRange.from;
      to = to || defaultRange.to;
    }

    const nowIso = new Date().toISOString();
    let title = "";
    let filename = "";
    let fields: SlipField[] = [];
    let columns: SlipColumn[] = [];
    let rows: (string | number | null | undefined)[][] = [];
    let totals: SlipTotals[] = [];

    switch (type) {
      case "stock_ledger": {
        title = "BÁO CÁO XUẤT - NHẬP - TỒN KHO";
        filename = `bao-cao-xnt-${from}-den-${to}.pdf`;

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

        fields = [
          {
            label: "Kỳ báo cáo",
            value: `Từ ngày ${formatDate(from)} đến ngày ${formatDate(to)}`,
          },
          ...(locationName ? [{ label: "Kho", value: locationName }] : []),
        ];

        columns = [
          { label: "Tên vật tư", flex: 2.2 },
          { label: "Biến thể", flex: 1.2 },
          { label: "ĐVT", flex: 0.6, align: "center" },
          { label: "Tồn đầu", flex: 0.8, align: "right" },
          { label: "Nhập", flex: 0.8, align: "right" },
          { label: "Xuất", flex: 0.8, align: "right" },
          { label: "Tồn cuối", flex: 0.8, align: "right" },
          { label: "Giá trị tồn", flex: 1.2, align: "right" },
        ];

        rows = data.stockLedger.map((r) => [
          r.productName,
          r.variantLabel,
          r.unit,
          formatNumber(r.openingQty),
          formatNumber(r.inQty),
          formatNumber(r.outQty),
          formatNumber(r.closingQty),
          formatVnd(r.closingValue),
        ]);

        totals = [
          {
            left: "TỔNG GIÁ TRỊ TỒN KHO",
            right: formatVnd(data.totalInventoryValue),
          },
        ];
        break;
      }

      case "zone_cost": {
        title = "BÁO CÁO CHI PHÍ VẬT TƯ THEO KHU VỰC";
        filename = `chi-phi-chuong-${from}-den-${to}.pdf`;

        const data = await fetchZoneCostReportData({ from, to });

        fields = [
          {
            label: "Kỳ báo cáo",
            value: `Từ ngày ${formatDate(from)} đến ngày ${formatDate(to)}`,
          },
        ];

        columns = [
          { label: "Khu vực / Chuồng", flex: 2.5 },
          { label: "Số phiếu xuất", flex: 1.0, align: "right" },
          { label: "Số BB hỏng", flex: 1.0, align: "right" },
          { label: "Tổng chi phí", flex: 1.5, align: "right" },
          { label: "Tỷ trọng", flex: 1.0, align: "right" },
        ];

        rows = data.zones.map((z) => [
          z.zoneName,
          formatNumber(z.issueCount),
          formatNumber(z.defectCount),
          formatVnd(z.totalCost),
          `${z.percentage}%`,
        ]);

        totals = [
          {
            left: "TỔNG CHI PHÍ TẤT CẢ KHU VỰC",
            right: formatVnd(data.grandTotalCost),
          },
        ];
        break;
      }

      case "vehicles": {
        title = "BÁO CÁO TIÊU THỤ NHIÊN LIỆU PHƯƠNG TIỆN";
        filename = `nhien-lieu-xe-${from}-den-${to}.pdf`;

        const data = await fetchVehicleReportData({ from, to });

        fields = [
          {
            label: "Kỳ báo cáo",
            value: `Từ ngày ${formatDate(from)} đến ngày ${formatDate(to)}`,
          },
        ];

        columns = [
          { label: "Mã xe", flex: 1.0 },
          { label: "Tên phương tiện", flex: 2.0 },
          { label: "Đơn vị", flex: 0.7, align: "center" },
          { label: "Định mức", flex: 1.0, align: "right" },
          { label: "Đã cấp (lít)", flex: 1.0, align: "right" },
          { label: "Số lần", flex: 0.8, align: "right" },
          { label: "Tiêu hao TB", flex: 1.0, align: "right" },
          { label: "Trạng thái", flex: 1.2, align: "center" },
        ];

        rows = data.vehicles.map((v) => [
          v.code,
          v.name,
          v.odoUnit === "hours" ? "Giờ" : "Km",
          v.fuelNorm != null ? String(v.fuelNorm) : "—",
          formatNumber(v.totalLiters),
          formatNumber(v.dispenseCount),
          v.avgRate != null ? `${v.avgRate}` : "—",
          v.isOverNorm ? "Vượt định mức" : "Bình thường",
        ]);

        totals = [
          {
            left: "TỔNG TIÊU THỤ NHIÊN LIỆU",
            right: `${formatNumber(data.totalLitersAllVehicles)} Lít`,
          },
        ];
        break;
      }

      case "partners": {
        title = "BÁO CÁO ĐỐI TÁC CUNG CẤP & KHÁCH HÀNG";
        filename = `doi-tac-${from}-den-${to}.pdf`;

        const data = await fetchPartnersReportData({ from, to });

        fields = [
          {
            label: "Kỳ báo cáo",
            value: `Từ ngày ${formatDate(from)} đến ngày ${formatDate(to)}`,
          },
        ];

        columns = [
          { label: "Đối tác", flex: 2.4 },
          { label: "Phân loại", flex: 1.1, align: "center" },
          { label: "Số ĐT", flex: 1.2 },
          { label: "Số giao dịch", flex: 1.0, align: "right" },
          { label: "Tổng SL", flex: 1.0, align: "right" },
          { label: "Tổng giá trị", flex: 1.5, align: "right" },
        ];

        const supplierRows = data.suppliers.map((s) => [
          s.supplierName,
          "Nhà cung cấp",
          s.phone || "—",
          formatNumber(s.receiptCount),
          formatNumber(s.totalQuantity),
          formatVnd(s.totalAmount),
        ]);

        const customerRows = data.customers.map((c) => [
          c.customerName,
          "Khách hàng",
          c.phone || "—",
          formatNumber(c.issueCount),
          formatNumber(c.totalQuantity),
          formatVnd(c.totalRevenue),
        ]);

        rows = [...supplierRows, ...customerRows];

        const totalSupplierAmt = data.suppliers.reduce((sum, s) => sum + s.totalAmount, 0);
        const totalCustomerRevenue = data.customers.reduce((sum, c) => sum + c.totalRevenue, 0);

        totals = [
          {
            left: "Tổng mua từ Nhà cung cấp",
            right: formatVnd(totalSupplierAmt),
          },
          {
            left: "Tổng bán cho Khách hàng",
            right: formatVnd(totalCustomerRevenue),
          },
        ];
        break;
      }

      case "stock_card": {
        if (!variantId) {
          return new NextResponse("Thiếu mã biến thể (variantId) cho in thẻ kho PDF", {
            status: 400,
          });
        }

        const data = await fetchStockCardData({
          variantId,
          locationId: location,
          from,
          to,
        });

        title = "THẺ KHO (SỔ KHO CHI TIẾT)";
        filename = `the-kho-${from}-den-${to}.pdf`;

        fields = [
          {
            label: "Kỳ báo cáo",
            value: `Từ ngày ${formatDate(from)} đến ngày ${formatDate(to)}`,
          },
          {
            label: "Vật tư",
            value: `${data.productName} (${data.variantLabel})`,
          },
          {
            label: "Đơn vị tính",
            value: data.unit,
          },
          {
            label: "Kho",
            value: data.locationName,
          },
          {
            label: "Tồn đầu kỳ",
            value: formatNumber(data.openingStock),
          },
          {
            label: "Tồn cuối kỳ",
            value: formatNumber(data.closingStock),
          },
        ];

        columns = [
          { label: "Ngày ghi sổ", flex: 1.3 },
          { label: "Mã CT", flex: 1.1 },
          { label: "Loại biến động", flex: 1.5 },
          { label: "Người thực hiện", flex: 1.4 },
          { label: "Nhập", flex: 0.9, align: "right" },
          { label: "Xuất", flex: 0.9, align: "right" },
          { label: "Tồn", flex: 1.0, align: "right" },
        ];

        rows = data.entries.map((e) => [
          formatDateTime(e.createdAt),
          e.refCode || "—",
          e.movementLabel,
          e.actorName,
          e.inQty > 0 ? formatNumber(e.inQty) : "—",
          e.outQty > 0 ? formatNumber(e.outQty) : "—",
          formatNumber(e.runningBalance),
        ]);

        totals = [
          { left: "Tổng nhập trong kỳ", right: formatNumber(data.totalIn) },
          { left: "Tổng xuất trong kỳ", right: formatNumber(data.totalOut) },
          { left: "Tồn cuối kỳ", right: formatNumber(data.closingStock) },
        ];
        break;
      }

      default:
        return new NextResponse(`Loại báo cáo không hợp lệ: ${type}`, { status: 400 });
    }

    const buffer = await renderToBuffer(
      <SlipDocument
        title={title}
        createdAt={nowIso}
        fields={fields}
        columns={columns}
        rows={rows}
        totals={totals}
        signers={REPORT_SIGNERS}
      />
    );

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi in báo cáo PDF";
    return new NextResponse(message, { status: 500 });
  }
}
