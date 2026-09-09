import * as XLSX from "xlsx";
import { formatDate, formatDateTime } from "@/lib/format";
import type {
  GeneralReportData,
  PartnersReportData,
  RequisitionReportRow,
  StockCardData,
  VehicleReportData,
  ZoneCostReportData,
} from "../types";

export const BRAND_EXCEL_TITLE = "TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG - MINH TÂN PHÁT";

/**
 * Formats report period subtitle string.
 */
export function formatReportPeriod(range: { from: string; to: string }): string {
  return `Kỳ báo cáo: Từ ngày ${formatDate(range.from)} đến ngày ${formatDate(range.to)}`;
}

/**
 * Calculates auto-fitted column widths for a sheet given rows of data.
 */
export function calculateColumnWidths(
  rows: (string | number | null | undefined)[][]
): { wch: number }[] {
  if (rows.length === 0) return [];
  const colCount = Math.max(...rows.map((r) => r?.length ?? 0));
  const colWidths: number[] = new Array(colCount).fill(10);

  for (const row of rows) {
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      const str = val == null ? "" : String(val);
      // Give padding to cell content, bound between 10 and 60 chars
      const len = Math.min(Math.max(str.length + 3, 10), 60);
      if (len > colWidths[c]) {
        colWidths[c] = len;
      }
    }
  }

  return colWidths.map((w) => ({ wch: w }));
}

/**
 * Formats number cells with standard thousands separators in worksheet.
 */
export function applyNumberFormats(ws: XLSX.WorkSheet): void {
  for (const cellAddress in ws) {
    if (cellAddress.startsWith("!")) continue;
    const cell = ws[cellAddress];
    if (cell && cell.t === "n") {
      if (Number.isInteger(cell.v)) {
        cell.z = "#,##0";
      } else {
        cell.z = "#,##0.##";
      }
    }
  }
}

/**
 * Helper to create and configure a formatted worksheet from an array of rows.
 */
function createFormattedSheet(
  rows: (string | number | null | undefined)[][]
): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = calculateColumnWidths(rows);
  applyNumberFormats(ws);
  return ws;
}

/**
 * Converts a SheetJS workbook to an immutable Uint8Array binary buffer.
 */
function workbookToBinaryBuffer(wb: XLSX.WorkBook): Uint8Array {
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * 1. Stock Ledger (Xuất - Nhập - Tồn kho) Excel workbook.
 */
export function buildStockLedgerExcel(
  data: GeneralReportData,
  range: { from: string; to: string },
  locationName?: string
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Báo cáo xuất nhập tồn
  const periodText = formatReportPeriod(range) + (locationName ? ` - Kho: ${locationName}` : "");

  let totalOpening = 0;
  let totalIn = 0;
  let totalOut = 0;
  let totalClosing = 0;
  let totalClosingValue = 0;

  const dataRows: (string | number | null | undefined)[][] = data.stockLedger.map((r, idx) => {
    totalOpening += r.openingQty;
    totalIn += r.inQty;
    totalOut += r.outQty;
    totalClosing += r.closingQty;
    totalClosingValue += r.closingValue;

    return [
      idx + 1,
      r.productName,
      r.variantLabel,
      r.unit,
      r.categoryName,
      r.openingQty,
      r.inQty,
      r.outQty,
      r.closingQty,
      r.unitPrice,
      r.closingValue,
    ];
  });

  const sheet1Rows: (string | number | null | undefined)[][] = [
    [BRAND_EXCEL_TITLE],
    ["BÁO CÁO XUẤT - NHẬP - TỒN KHO"],
    [periodText],
    [],
    [
      "STT",
      "Tên vật tư",
      "Quy cách / Biến thể",
      "ĐVT",
      "Danh mục",
      "Tồn đầu kỳ",
      "Nhập trong kỳ",
      "Xuất trong kỳ",
      "Tồn cuối kỳ",
      "Đơn giá (VNĐ)",
      "Giá trị tồn (VNĐ)",
    ],
    ...dataRows,
    [
      "TỔNG CỘNG",
      "",
      "",
      "",
      "",
      totalOpening,
      totalIn,
      totalOut,
      totalClosing,
      "",
      data.totalInventoryValue || totalClosingValue,
    ],
  ];

  const wsLedger = createFormattedSheet(sheet1Rows);
  XLSX.utils.book_append_sheet(wb, wsLedger, "Xuat_Nhap_Ton");

  // Sheet 2: Cơ cấu theo danh mục
  if (data.categoryBreakdown && data.categoryBreakdown.length > 0) {
    let totalCatCost = 0;
    const catRows = data.categoryBreakdown.map((c, idx) => {
      totalCatCost += c.cost;
      return [idx + 1, c.categoryName, c.cost, c.percentage];
    });

    const sheet2Rows: (string | number | null | undefined)[][] = [
      [BRAND_EXCEL_TITLE],
      ["CƠ CẤU GIÁ TRỊ TỒN KHO THEO DANH MỤC"],
      [formatReportPeriod(range)],
      [],
      ["STT", "Tên danh mục", "Giá trị tồn (VNĐ)", "Tỷ trọng (%)"],
      ...catRows,
      ["TỔNG CỘNG", "", totalCatCost, 100],
    ];

    const wsCat = createFormattedSheet(sheet2Rows);
    XLSX.utils.book_append_sheet(wb, wsCat, "Co_Cau_Danh_Muc");
  }

  return workbookToBinaryBuffer(wb);
}

/**
 * 2. Zone Cost (Chi phí vật tư theo khu vực) Excel workbook.
 */
export function buildZoneCostExcel(
  data: ZoneCostReportData,
  range: { from: string; to: string }
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Tổng hợp chi phí theo khu vực
  let totalIssues = 0;
  let totalDefects = 0;

  const zoneRows = data.zones.map((z, idx) => {
    totalIssues += z.issueCount;
    totalDefects += z.defectCount;
    return [idx + 1, z.zoneName, z.issueCount, z.defectCount, z.totalCost, z.percentage];
  });

  const sheet1Rows: (string | number | null | undefined)[][] = [
    [BRAND_EXCEL_TITLE],
    ["BÁO CÁO CHI PHÍ VẬT TƯ THEO KHU VỰC"],
    [formatReportPeriod(range)],
    [],
    [
      "STT",
      "Khu vực / Chuồng",
      "Số phiếu xuất",
      "Số biên bản hỏng",
      "Tổng chi phí (VNĐ)",
      "Tỷ trọng (%)",
    ],
    ...zoneRows,
    ["TỔNG CỘNG", "", totalIssues, totalDefects, data.grandTotalCost, 100],
  ];

  const wsSummary = createFormattedSheet(sheet1Rows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Chi_Phi_Khu_Vuc");

  // Sheet 2: Chi tiết vật tư xuất theo khu vực
  const itemRows: (string | number | null | undefined)[][] = [];
  let itemStt = 1;
  let sumItemQty = 0;

  for (const zone of data.zones) {
    for (const item of zone.items) {
      sumItemQty += item.quantity;
      itemRows.push([
        itemStt++,
        zone.zoneName,
        item.productName,
        item.variantLabel,
        item.unit,
        item.quantity,
        item.unitPrice,
        item.totalAmount,
      ]);
    }
  }

  if (itemRows.length > 0) {
    const sheet2Rows: (string | number | null | undefined)[][] = [
      [BRAND_EXCEL_TITLE],
      ["CHI TIẾT VẬT TƯ XUẤT THEO KHU VỰC"],
      [formatReportPeriod(range)],
      [],
      [
        "STT",
        "Khu vực / Chuồng",
        "Tên vật tư",
        "Quy cách / Biến thể",
        "ĐVT",
        "Số lượng",
        "Đơn giá (VNĐ)",
        "Thành tiền (VNĐ)",
      ],
      ...itemRows,
      ["TỔNG CỘNG", "", "", "", "", sumItemQty, "", data.grandTotalCost],
    ];

    const wsDetail = createFormattedSheet(sheet2Rows);
    XLSX.utils.book_append_sheet(wb, wsDetail, "Chi_Tiet_Vat_Tu");
  }

  return workbookToBinaryBuffer(wb);
}

/**
 * 3. Vehicle & Equipment Fuel (Tiêu thụ nhiên liệu phương tiện) Excel workbook.
 */
export function buildVehicleExcel(
  data: VehicleReportData,
  range: { from: string; to: string }
): Uint8Array {
  const wb = XLSX.utils.book_new();

  let totalDispenses = 0;
  let totalUsageDiff = 0;

  const vehicleRows = data.vehicles.map((v, idx) => {
    totalDispenses += v.dispenseCount;
    totalUsageDiff += v.totalUsageDiff;

    return [
      idx + 1,
      v.code,
      v.name,
      v.odoUnit === "hours" ? "Giờ" : "Km",
      v.fuelNorm != null ? v.fuelNorm : "—",
      v.totalLiters,
      v.dispenseCount,
      v.totalUsageDiff,
      v.avgRate != null ? v.avgRate : "—",
      v.normDiff != null ? v.normDiff : "—",
      v.isOverNorm ? "Vượt định mức" : "Bình thường",
    ];
  });

  const sheet1Rows: (string | number | null | undefined)[][] = [
    [BRAND_EXCEL_TITLE],
    ["BÁO CÁO TIÊU THỤ NHIÊN LIỆU PHƯƠNG TIỆN & MÁY MÓC"],
    [formatReportPeriod(range)],
    [],
    [
      "STT",
      "Mã phương tiện",
      "Tên phương tiện / Biển số",
      "Đơn vị đo",
      "Định mức",
      "Tổng cấp (Lít)",
      "Số lần cấp",
      "Mức sử dụng (km/h)",
      "Tiêu hao TB",
      "Chênh lệch định mức",
      "Trạng thái định mức",
    ],
    ...vehicleRows,
    [
      "TỔNG CỘNG",
      "",
      "",
      "",
      "",
      data.totalLitersAllVehicles,
      totalDispenses,
      totalUsageDiff,
      "",
      "",
      "",
    ],
  ];

  const wsVehicles = createFormattedSheet(sheet1Rows);
  XLSX.utils.book_append_sheet(wb, wsVehicles, "Nhien_Lieu_Phuong_Tien");

  return workbookToBinaryBuffer(wb);
}

/**
 * 4. Partners (Nhà cung cấp & Khách hàng) Excel workbook.
 */
export function buildPartnersExcel(
  data: PartnersReportData,
  range: { from: string; to: string }
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Nhà cung cấp
  let totalReceiptCount = 0;
  let totalSupplierQty = 0;
  let totalSupplierAmt = 0;

  const supplierRows = data.suppliers.map((s, idx) => {
    totalReceiptCount += s.receiptCount;
    totalSupplierQty += s.totalQuantity;
    totalSupplierAmt += s.totalAmount;

    return [
      idx + 1,
      s.supplierName,
      s.phone || "—",
      s.receiptCount,
      s.totalQuantity,
      s.totalAmount,
    ];
  });

  const sheet1Rows: (string | number | null | undefined)[][] = [
    [BRAND_EXCEL_TITLE],
    ["BÁO CÁO NHÀ CUNG CẤP VẬT TƯ"],
    [formatReportPeriod(range)],
    [],
    [
      "STT",
      "Tên nhà cung cấp",
      "Số điện thoại",
      "Số phiếu nhập",
      "Tổng số lượng",
      "Tổng giá trị nhập (VNĐ)",
    ],
    ...supplierRows,
    ["TỔNG CỘNG", "", "", totalReceiptCount, totalSupplierQty, totalSupplierAmt],
  ];

  const wsSuppliers = createFormattedSheet(sheet1Rows);
  XLSX.utils.book_append_sheet(wb, wsSuppliers, "Nha_Cung_Cap");

  // Sheet 2: Khách hàng
  let totalIssueCount = 0;
  let totalCustomerQty = 0;
  let totalCustomerRevenue = 0;

  const customerRows = data.customers.map((c, idx) => {
    totalIssueCount += c.issueCount;
    totalCustomerQty += c.totalQuantity;
    totalCustomerRevenue += c.totalRevenue;

    return [
      idx + 1,
      c.customerName,
      c.phone || "—",
      c.issueCount,
      c.totalQuantity,
      c.totalRevenue,
    ];
  });

  const sheet2Rows: (string | number | null | undefined)[][] = [
    [BRAND_EXCEL_TITLE],
    ["BÁO CÁO KHÁCH HÀNG MUA VẬT TƯ / HÀNG HOÁ"],
    [formatReportPeriod(range)],
    [],
    [
      "STT",
      "Tên khách hàng",
      "Số điện thoại",
      "Số phiếu xuất",
      "Tổng số lượng",
      "Tổng doanh thu (VNĐ)",
    ],
    ...customerRows,
    ["TỔNG CỘNG", "", "", totalIssueCount, totalCustomerQty, totalCustomerRevenue],
  ];

  const wsCustomers = createFormattedSheet(sheet2Rows);
  XLSX.utils.book_append_sheet(wb, wsCustomers, "Khach_Hang");

  return workbookToBinaryBuffer(wb);
}

/**
 * 5. Stock Card (Thẻ kho / Sổ chi tiết vật tư) Excel workbook.
 */
export function buildStockCardExcel(
  data: StockCardData,
  range: { from: string; to: string }
): Uint8Array {
  const wb = XLSX.utils.book_new();

  const entryRows = data.entries.map((e, idx) => [
    idx + 1,
    formatDateTime(e.createdAt),
    e.refCode || "—",
    e.movementLabel,
    e.actorName,
    e.inQty > 0 ? e.inQty : 0,
    e.outQty > 0 ? e.outQty : 0,
    e.runningBalance,
    e.notes || "",
  ]);

  const sheetRows: (string | number | null | undefined)[][] = [
    [BRAND_EXCEL_TITLE],
    ["THẺ KHO (SỔ KHO CHI TIẾT VẬT TƯ)"],
    [formatReportPeriod(range)],
    [`Vật tư: ${data.productName} - ${data.variantLabel} | ĐVT: ${data.unit} | Kho: ${data.locationName}`],
    [
      `Tồn đầu kỳ: ${data.openingStock} | Tổng nhập: ${data.totalIn} | Tổng xuất: ${data.totalOut} | Tồn cuối kỳ: ${data.closingStock}`,
    ],
    [],
    [
      "STT",
      "Thời gian ghi sổ",
      "Mã chứng từ",
      "Loại biến động",
      "Người thực hiện",
      "Số lượng nhập",
      "Số lượng xuất",
      "Tồn sau biến động",
      "Ghi chú",
    ],
    ...entryRows,
    ["TỔNG CỘNG", "", "", "", "", data.totalIn, data.totalOut, data.closingStock, ""],
  ];

  const wsCard = createFormattedSheet(sheetRows);
  XLSX.utils.book_append_sheet(wb, wsCard, "The_Kho");

  return workbookToBinaryBuffer(wb);
}

/**
 * 6. Requisitions Report (Báo cáo yêu cầu vật tư) Excel workbook.
 */
export function buildRequisitionsExcel(
  requisitions: RequisitionReportRow[],
  range?: { from?: string | null; to?: string | null },
  filterInfo?: { status?: string | null; zoneName?: string | null }
): Uint8Array {
  const wb = XLSX.utils.book_new();

  const periodText =
    (range?.from && range?.to
      ? `Kỳ báo cáo: Từ ngày ${formatDate(range.from)} đến ngày ${formatDate(range.to)}`
      : "Tất cả thời gian") +
    (filterInfo?.status ? ` - Trạng thái: ${filterInfo.status}` : "") +
    (filterInfo?.zoneName ? ` - Khu vực: ${filterInfo.zoneName}` : "");

  const rows: (string | number | null | undefined)[][] = [
    [BRAND_EXCEL_TITLE],
    ["BÁO CÁO TỔNG HỢP PHIẾU YÊU CẦU VẬT TƯ"],
    [periodText],
    [],
    [
      "STT",
      "Mã phiếu",
      "Ngày yêu cầu",
      "Người yêu cầu",
      "Khu vực / Chuồng",
      "Mục đích sử dụng",
      "Loại yêu cầu",
      "Trạng thái",
      "Danh sách vật tư yêu cầu",
    ],
  ];

  requisitions.forEach((req, idx) => {
    const itemsSummary = req.items
      .map((it) => `${it.productName}${it.variantLabel ? ` (${it.variantLabel})` : ""}: ${it.quantity} ${it.unit}`)
      .join("; ");

    rows.push([
      idx + 1,
      req.code,
      formatDate(req.createdAt),
      req.requesterName || "—",
      req.zoneName || "—",
      req.purpose,
      req.requisitionType === "replacement" ? "Thay thế đổi mới" : "Cấp mới định kỳ",
      req.statusLabel,
      itemsSummary || "—",
    ]);
  });

  const ws = createFormattedSheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Yeu_Cau_Vat_Tu");

  // Sheet 2: Chi tiết từng dòng vật tư
  const detailRows: (string | number | null | undefined)[][] = [
    [BRAND_EXCEL_TITLE],
    ["CHI TIẾT VẬT TƯ YÊU CẦU THEO PHIẾU"],
    [periodText],
    [],
    [
      "STT",
      "Mã phiếu",
      "Ngày yêu cầu",
      "Người yêu cầu",
      "Khu vực / Chuồng",
      "Trạng thái",
      "Tên vật tư",
      "Biến thể",
      "Đơn vị tính",
      "Số lượng yêu cầu",
    ],
  ];

  let detailIdx = 1;
  requisitions.forEach((req) => {
    req.items.forEach((item) => {
      detailRows.push([
        detailIdx++,
        req.code,
        formatDate(req.createdAt),
        req.requesterName || "—",
        req.zoneName || "—",
        req.statusLabel,
        item.productName,
        item.variantLabel || "—",
        item.unit || "—",
        item.quantity,
      ]);
    });
  });

  const detailWs = createFormattedSheet(detailRows);
  XLSX.utils.book_append_sheet(wb, detailWs, "Chi_Tiet_Vat_Tu");

  return workbookToBinaryBuffer(wb);
}
