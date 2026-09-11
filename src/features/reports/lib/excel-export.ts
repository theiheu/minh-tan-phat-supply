import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs";
import { BRAND } from "@/features/pdf/brand";
import { formatDate, formatDateLong, formatDateTime, formatNumber, formatVnd } from "@/lib/format";
import type {
  GeneralReportData,
  PartnersReportData,
  RequisitionReportRow,
  StockCardData,
  VehicleReportData,
  ZoneCostReportData,
} from "../types";

export const BRAND_EXCEL_TITLE = "TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG - MINH TÂN PHÁT";
export const REPORT_SIGNERS = ["Người lập báo cáo", "Kế toán trại", "Quản lý / Chủ trại duyệt"];

/**
 * Formats report period subtitle string.
 */
export function formatReportPeriod(range: { from: string; to: string }): string {
  return `Kỳ báo cáo: Từ ngày ${formatDate(range.from)} đến ngày ${formatDate(range.to)}`;
}

export interface ExcelReportColumn {
  header: string;
  width?: number;
  align?: "left" | "center" | "right";
  numFmt?: string;
  colSpan?: number; // defaults to 1. E.g. 2 means spans 2 physical Excel columns (e.g. B & C)
}

export interface ExcelReportField {
  label: string;
  value?: string | number | null;
}

export interface ExcelReportTotal {
  left: string;
  right: string;
}

export interface GenerateExcelReportOptions {
  title: string;
  sheetName: string;
  fields?: ExcelReportField[];
  columns: ExcelReportColumn[];
  rows: (string | number | null | undefined)[][];
  totals?: ExcelReportTotal[];
  merges?: { startRow: number; endRow: number; cols: number[] }[];
  signers?: string[];
  orientation?: "portrait" | "landscape";
  secondarySheet?: {
    sheetName: string;
    title: string;
    periodText?: string;
    columns: ExcelReportColumn[];
    rows: (string | number | null | undefined)[][];
  };
}

/**
 * Creates a fully styled Excel workbook matching the exact PDF template
 * with support for colSpan (e.g. Tên vật tư merger cột B & C), Logo, Header, Borders, Totals, Signatures.
 */
export async function generateStyledExcelReport(options: GenerateExcelReportOptions): Promise<Uint8Array> {
  const {
    title,
    sheetName,
    fields = [],
    columns,
    rows,
    totals = [],
    merges = [],
    signers = REPORT_SIGNERS,
    orientation = "landscape",
    secondarySheet,
  } = options;

  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND.name;

  const ws = wb.addWorksheet(sheetName, {
    pageSetup: {
      orientation,
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: true }],
  });

  // Calculate physical column mapping and spans
  let currentPhysicalCol = 1;
  const colPositions = columns.map((c) => {
    const span = c.colSpan || 1;
    const startCol = currentPhysicalCol;
    const endCol = startCol + span - 1;
    currentPhysicalCol += span;
    return { ...c, startCol, endCol, span };
  });
  const totalPhysicalCols = currentPhysicalCol - 1;

  // Set physical column widths (Thu hẹp cột B bằng đúng cột A, dãn cột C rộng rãi cho tên vật tư)
  const physicalColWidths: { width: number }[] = [];
  colPositions.forEach((c) => {
    if (c.span > 1) {
      if (c.startCol === 2 && c.endCol === 3) {
        physicalColWidths.push({ width: 7 }); // Cột B: bằng đúng chiều rộng cột A (7)
        physicalColWidths.push({ width: Math.max(34, (c.width || 44) - 7) }); // Cột C: dãn rộng cho tên vật tư
      } else {
        const partWidth = Math.round((c.width || 30) / c.span);
        for (let i = 0; i < c.span; i++) {
          physicalColWidths.push({ width: partWidth });
        }
      }
    } else {
      physicalColWidths.push({ width: c.width || 15 });
    }
  });
  ws.columns = physicalColWidths;

  // 1. Logo thương hiệu ở góc trái trên cùng (Merge cột A:B, dòng 1-3, kích thước 72x72 chuẩn)
  ws.mergeCells(1, 1, 3, 2);
  const logoPngPath = path.join(process.cwd(), "public", "brand", "logo.png");
  const logoJpgPath = path.join(process.cwd(), "public", "brand", "logo.jpg");
  const logoPath = fs.existsSync(logoPngPath) ? logoPngPath : logoJpgPath;
  if (fs.existsSync(logoPath)) {
    const ext = logoPath.endsWith(".png") ? "png" : "jpeg";
    const imageId = wb.addImage({
      filename: logoPath,
      extension: ext,
    });
    ws.addImage(imageId, {
      tl: { col: 0.1, row: 0.1 },
      ext: { width: 72, height: 72 },
    });
  }

  // Row heights cho phần header
  ws.getRow(1).height = 26;
  ws.getRow(2).height = 24;
  ws.getRow(3).height = 24;
  ws.getRow(4).height = 10;
  ws.getRow(5).height = 26;
  ws.getRow(6).height = 18;
  ws.getRow(7).height = 10;

  // 2. Thông tin thương hiệu (Cột C trở đi, Dòng 1-3)
  const brandEndCol = Math.max(3, totalPhysicalCols);
  ws.mergeCells(1, 3, 1, brandEndCol);
  const b1 = ws.getCell(1, 3);
  b1.value = BRAND.name;
  b1.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF000000" } };
  b1.alignment = { horizontal: "left", vertical: "middle" };

  ws.mergeCells(2, 3, 2, brandEndCol);
  const b2 = ws.getCell(2, 3);
  b2.value = BRAND.address;
  b2.font = { name: "Arial", size: 9, color: { argb: "FF333333" } };
  b2.alignment = { horizontal: "left", vertical: "middle" };

  ws.mergeCells(3, 3, 3, brandEndCol);
  const b3 = ws.getCell(3, 3);
  b3.value = BRAND.phone;
  b3.font = { name: "Arial", size: 9, color: { argb: "FF333333" } };
  b3.alignment = { horizontal: "left", vertical: "middle" };

  // 3. Tiêu đề báo cáo ở giữa (Dòng 5)
  ws.mergeCells(5, 1, 5, totalPhysicalCols);
  const titleCell = ws.getCell(5, 1);
  titleCell.value = title;
  titleCell.font = { name: "Arial", size: 15, bold: true, color: { argb: "FF000000" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // 4. Ngày tháng ở giữa (Dòng 6)
  ws.mergeCells(6, 1, 6, totalPhysicalCols);
  const dateCell = ws.getCell(6, 1);
  dateCell.value = formatDateLong(new Date().toISOString());
  dateCell.font = { name: "Arial", size: 9.5, italic: true, color: { argb: "FF333333" } };
  dateCell.alignment = { horizontal: "center", vertical: "middle" };

  // 5. Khối thông tin bộ lọc bên trái (Dòng 8+)
  let metaRow = 8;
  fields.forEach((field) => {
    ws.getRow(metaRow).height = 18;
    ws.mergeCells(metaRow, 1, metaRow, 2);
    const lbl = ws.getCell(metaRow, 1);
    lbl.value = `${field.label}:`;
    lbl.font = { name: "Arial", size: 9.5, bold: true };
    lbl.alignment = { horizontal: "left", vertical: "middle" };

    const endValCol = Math.max(3, Math.min(8, totalPhysicalCols));
    ws.mergeCells(metaRow, 3, metaRow, endValCol);
    const val = ws.getCell(metaRow, 3);
    val.value = field.value == null ? "—" : String(field.value);
    val.font = { name: "Arial", size: 9.5 };
    val.alignment = { horizontal: "left", vertical: "middle" };
    metaRow++;
  });

  // Dòng trống trước bảng
  ws.getRow(metaRow).height = 8;
  metaRow++;

  // 6. Tiêu đề các cột bảng (Áp dụng colSpan nếu có, ví dụ merger BC)
  const tableHeaderRow = metaRow;
  ws.getRow(tableHeaderRow).height = 32;

  colPositions.forEach((col) => {
    if (col.span > 1) {
      ws.mergeCells(tableHeaderRow, col.startCol, tableHeaderRow, col.endCol);
    }
    const cell = ws.getCell(tableHeaderRow, col.startCol);
    cell.value = col.header;
    cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF000000" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    for (let c = col.startCol; c <= col.endCol; c++) {
      const hCell = ws.getCell(tableHeaderRow, c);
      hCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      hCell.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    }
  });

  // 7. Dữ liệu bảng (Áp dụng colSpan cho từng dòng nếu có)
  let currentRow = tableHeaderRow + 1;

  const isMultiRowMerged = (rowIndex: number, logicalColIndex: number) => {
    return merges.some(
      (m) =>
        rowIndex >= m.startRow &&
        rowIndex <= m.endRow &&
        m.cols.includes(logicalColIndex + 1) &&
        m.endRow > m.startRow
    );
  };

  rows.forEach((row) => {
    ws.getRow(currentRow).height = 30;

    row.forEach((val, colIdx) => {
      const col = colPositions[colIdx];
      if (!col) return;

      if (col.span > 1 && !isMultiRowMerged(currentRow, colIdx)) {
        ws.mergeCells(currentRow, col.startCol, currentRow, col.endCol);
      }

      const cell = ws.getCell(currentRow, col.startCol);
      cell.value = val == null ? "—" : val;
      cell.font = { name: "Arial", size: 9.5, color: { argb: "FF000000" } };
      cell.alignment = {
        horizontal: col.align || "left",
        vertical: "middle",
        wrapText: true,
      };

      for (let c = col.startCol; c <= col.endCol; c++) {
        const dCell = ws.getCell(currentRow, c);
        dCell.border = {
          top: { style: "thin", color: { argb: "FF555555" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF555555" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
      }

      if (typeof val === "number") {
        cell.numFmt = col.numFmt || "#,##0";
      }
    });

    currentRow++;
  });

  // 8. Áp dụng Merge Rows nếu có (cho phiếu nhiều vật tư)
  merges.forEach((m) => {
    m.cols.forEach((logicalColNum) => {
      const col = colPositions[logicalColNum - 1];
      if (!col) return;
      ws.mergeCells(m.startRow, col.startCol, m.endRow, col.endCol);
    });
  });

  // 9. Hàng Tổng Cộng cuối bảng
  totals.forEach((total) => {
    ws.getRow(currentRow).height = 26;
    const midCol = Math.max(1, Math.floor(totalPhysicalCols / 2));

    ws.mergeCells(currentRow, 1, currentRow, midCol);
    const leftCell = ws.getCell(currentRow, 1);
    leftCell.value = total.left;
    leftCell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF000000" } };
    leftCell.alignment = { horizontal: "left", vertical: "middle" };

    ws.mergeCells(currentRow, midCol + 1, currentRow, totalPhysicalCols);
    const rightCell = ws.getCell(currentRow, midCol + 1);
    rightCell.value = total.right;
    rightCell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF000000" } };
    rightCell.alignment = { horizontal: "right", vertical: "middle" };

    for (let c = 1; c <= totalPhysicalCols; c++) {
      const cell = ws.getCell(currentRow, c);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
      cell.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    }
    currentRow++;
  });

  // 10. Khối Chữ Ký
  if (signers && signers.length > 0) {
    currentRow += 2;
    const signTitleRow = currentRow;
    ws.getRow(signTitleRow).height = 20;

    const s1End = Math.max(2, Math.floor(totalPhysicalCols / 3));
    const s2Start = s1End + 1;
    const s2End = Math.max(s2Start, Math.floor((totalPhysicalCols * 2) / 3));
    const s3Start = s2End + 1;
    const s3End = totalPhysicalCols;

    if (signers[0]) {
      ws.mergeCells(signTitleRow, 2, signTitleRow, s1End);
      const s1 = ws.getCell(signTitleRow, 2);
      s1.value = signers[0];
      s1.font = { name: "Arial", size: 10, bold: true };
      s1.alignment = { horizontal: "center", vertical: "middle" };
    }

    if (signers[1]) {
      ws.mergeCells(signTitleRow, s2Start, signTitleRow, s2End);
      const s2 = ws.getCell(signTitleRow, s2Start);
      s2.value = signers[1];
      s2.font = { name: "Arial", size: 10, bold: true };
      s2.alignment = { horizontal: "center", vertical: "middle" };
    }

    if (signers[2]) {
      ws.mergeCells(signTitleRow, s3Start, signTitleRow, s3End);
      const s3 = ws.getCell(signTitleRow, s3Start);
      s3.value = signers[2];
      s3.font = { name: "Arial", size: 10, bold: true };
      s3.alignment = { horizontal: "center", vertical: "middle" };
    }

    const signSubRow = signTitleRow + 1;
    ws.getRow(signSubRow).height = 16;

    if (signers[0]) {
      ws.mergeCells(signSubRow, 2, signSubRow, s1End);
      const h1 = ws.getCell(signSubRow, 2);
      h1.value = "(Ký, ghi rõ họ tên)";
      h1.font = { name: "Arial", size: 8, italic: true, color: { argb: "FF475569" } };
      h1.alignment = { horizontal: "center", vertical: "middle" };
    }

    if (signers[1]) {
      ws.mergeCells(signSubRow, s2Start, signSubRow, s2End);
      const h2 = ws.getCell(signSubRow, s2Start);
      h2.value = "(Ký, ghi rõ họ tên)";
      h2.font = { name: "Arial", size: 8, italic: true, color: { argb: "FF475569" } };
      h2.alignment = { horizontal: "center", vertical: "middle" };
    }

    if (signers[2]) {
      ws.mergeCells(signSubRow, s3Start, signSubRow, s3End);
      const h3 = ws.getCell(signSubRow, s3Start);
      h3.value = "(Ký, ghi rõ họ tên)";
      h3.font = { name: "Arial", size: 8, italic: true, color: { argb: "FF475569" } };
      h3.alignment = { horizontal: "center", vertical: "middle" };
    }
  }

  // 11. Sheet phụ thứ 2 (nếu có yêu cầu chi tiết)
  if (secondarySheet) {
    const sCols = secondarySheet.columns.length;
    const detailWs = wb.addWorksheet(secondarySheet.sheetName, {
      pageSetup: {
        orientation,
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
      views: [{ showGridLines: true }],
    });
    detailWs.columns = secondarySheet.columns.map((c) => ({ width: c.width || 15 }));

    detailWs.getRow(1).height = 24;
    detailWs.mergeCells(1, 1, 1, sCols);
    const dTitle = detailWs.getCell(1, 1);
    dTitle.value = secondarySheet.title;
    dTitle.font = { name: "Arial", size: 14, bold: true };
    dTitle.alignment = { horizontal: "center", vertical: "middle" };

    if (secondarySheet.periodText) {
      detailWs.getRow(2).height = 18;
      detailWs.mergeCells(2, 1, 2, sCols);
      const dPeriod = detailWs.getCell(2, 1);
      dPeriod.value = secondarySheet.periodText;
      dPeriod.font = { name: "Arial", size: 9.5, italic: true };
      dPeriod.alignment = { horizontal: "center", vertical: "middle" };
    }

    detailWs.getRow(4).height = 32;
    secondarySheet.columns.forEach((header, colIdx) => {
      const cell = detailWs.getCell(4, colIdx + 1);
      cell.value = header.header;
      cell.font = { name: "Arial", size: 9.5, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      cell.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    });

    let dRowIdx = 5;
    secondarySheet.rows.forEach((row) => {
      detailWs.getRow(dRowIdx).height = 30;
      row.forEach((val, colIdx) => {
        const col = secondarySheet.columns[colIdx];
        const cell = detailWs.getCell(dRowIdx, colIdx + 1);
        cell.value = val == null ? "—" : val;
        cell.font = { name: "Arial", size: 9.5 };
        cell.alignment = { horizontal: col?.align || "left", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
        if (typeof val === "number") {
          cell.numFmt = col?.numFmt || "#,##0";
        }
      });
      dRowIdx++;
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

// ---------------------------------------------------------------------------------
// 1. Stock Ledger (Xuất - Nhập - Tồn kho) Excel workbook
// ---------------------------------------------------------------------------------
export async function buildStockLedgerExcel(
  data: GeneralReportData,
  range: { from: string; to: string },
  locationName?: string
): Promise<Uint8Array> {
  const periodLabel = `Từ ngày ${formatDate(range.from)} đến ngày ${formatDate(range.to)}`;
  const fields: ExcelReportField[] = [
    { label: "Kỳ báo cáo", value: periodLabel },
    ...(locationName ? [{ label: "Kho", value: locationName }] : []),
  ];

  const columns: ExcelReportColumn[] = [
    { header: "STT", width: 7, align: "center" },
    { header: "Tên vật tư", width: 38, align: "left", colSpan: 2 }, // Merger cột BC
    { header: "Biến thể", width: 22, align: "left" },
    { header: "ĐVT", width: 10, align: "center" },
    { header: "Tồn đầu", width: 14, align: "right", numFmt: "#,##0" },
    { header: "Nhập", width: 14, align: "right", numFmt: "#,##0" },
    { header: "Xuất", width: 14, align: "right", numFmt: "#,##0" },
    { header: "Tồn cuối", width: 14, align: "right", numFmt: "#,##0" },
    { header: "Giá trị tồn", width: 24, align: "right" },
  ];

  const rows = data.stockLedger.map((r, idx) => [
    idx + 1,
    r.productName,
    r.variantLabel,
    r.unit,
    r.openingQty,
    r.inQty,
    r.outQty,
    r.closingQty,
    formatVnd(r.closingValue),
  ]);

  const totals: ExcelReportTotal[] = [
    {
      left: "TỔNG GIÁ TRỊ TỒN KHO",
      right: formatVnd(data.totalInventoryValue),
    },
  ];

  return generateStyledExcelReport({
    title: "BÁO CÁO XUẤT - NHẬP - TỒN KHO",
    sheetName: "Xuat_Nhap_Ton",
    fields,
    columns,
    rows,
    totals,
  });
}

// ---------------------------------------------------------------------------------
// 2. Zone Cost (Chi phí theo khu vực / chuồng) Excel workbook
// ---------------------------------------------------------------------------------
export async function buildZoneCostExcel(
  data: ZoneCostReportData,
  range: { from: string; to: string }
): Promise<Uint8Array> {
  const periodLabel = `Từ ngày ${formatDate(range.from)} đến ngày ${formatDate(range.to)}`;
  const fields: ExcelReportField[] = [{ label: "Kỳ báo cáo", value: periodLabel }];

  const columns: ExcelReportColumn[] = [
    { header: "STT", width: 7, align: "center" },
    { header: "Khu vực / Chuồng", width: 38, align: "left", colSpan: 2 }, // Merger cột BC
    { header: "Số phiếu xuất", width: 18, align: "right", numFmt: "#,##0" },
    { header: "Số BB hỏng", width: 18, align: "right", numFmt: "#,##0" },
    { header: "Tổng chi phí", width: 26, align: "right" },
    { header: "Tỷ trọng", width: 16, align: "right" },
  ];

  const rows = data.zones.map((z, idx) => [
    idx + 1,
    z.zoneName,
    z.issueCount,
    z.defectCount,
    formatVnd(z.totalCost),
    `${z.percentage}%`,
  ]);

  const totals: ExcelReportTotal[] = [
    {
      left: "TỔNG CHI PHÍ TẤT CẢ KHU VỰC",
      right: formatVnd(data.grandTotalCost),
    },
  ];

  return generateStyledExcelReport({
    title: "BÁO CÁO CHI PHÍ VẬT TƯ THEO KHU VỰC",
    sheetName: "Chi_Phi_Khu_Vuc",
    fields,
    columns,
    rows,
    totals,
  });
}

// ---------------------------------------------------------------------------------
// 3. Vehicle Fuel Report (Tiêu thụ nhiên liệu xe / máy móc) Excel workbook
// ---------------------------------------------------------------------------------
export async function buildVehicleExcel(
  data: VehicleReportData,
  range: { from: string; to: string }
): Promise<Uint8Array> {
  const periodLabel = `Từ ngày ${formatDate(range.from)} đến ngày ${formatDate(range.to)}`;
  const fields: ExcelReportField[] = [{ label: "Kỳ báo cáo", value: periodLabel }];

  const columns: ExcelReportColumn[] = [
    { header: "STT", width: 7, align: "center" },
    { header: "Mã xe", width: 14, align: "center" },
    { header: "Tên phương tiện", width: 38, align: "left", colSpan: 2 },
    { header: "Đơn vị", width: 10, align: "center" },
    { header: "Định mức", width: 15, align: "right" },
    { header: "Đã cấp (lít)", width: 16, align: "right", numFmt: "#,##0" },
    { header: "Số lần", width: 14, align: "right", numFmt: "#,##0" },
    { header: "Tiêu hao TB", width: 16, align: "right" },
    { header: "Trạng thái", width: 20, align: "center" },
  ];

  const rows = data.vehicles.map((v, idx) => [
    idx + 1,
    v.code,
    v.name,
    v.odoUnit === "hours" ? "Giờ" : "Km",
    v.fuelNorm != null ? String(v.fuelNorm) : "—",
    v.totalLiters,
    v.dispenseCount,
    v.avgRate != null ? `${v.avgRate}` : "—",
    v.isOverNorm ? "Vượt định mức" : "Bình thường",
  ]);

  const totals: ExcelReportTotal[] = [
    {
      left: "TỔNG TIÊU THỤ NHIÊN LIỆU",
      right: `${formatNumber(data.totalLitersAllVehicles)} Lít`,
    },
  ];

  return generateStyledExcelReport({
    title: "BÁO CÁO TIÊU THỤ NHIÊN LIỆU PHƯƠNG TIỆN",
    sheetName: "Nhien_Lieu_Xe",
    fields,
    columns,
    rows,
    totals,
  });
}

// ---------------------------------------------------------------------------------
// 4. Partners Report (Đối tác cung cấp & khách hàng) Excel workbook
// ---------------------------------------------------------------------------------
export async function buildPartnersExcel(
  data: PartnersReportData,
  range: { from: string; to: string }
): Promise<Uint8Array> {
  const periodLabel = `Từ ngày ${formatDate(range.from)} đến ngày ${formatDate(range.to)}`;
  const fields: ExcelReportField[] = [{ label: "Kỳ báo cáo", value: periodLabel }];

  const columns: ExcelReportColumn[] = [
    { header: "STT", width: 7, align: "center" },
    { header: "Đối tác", width: 40, align: "left", colSpan: 2 }, // Merger cột BC
    { header: "Phân loại", width: 18, align: "center" },
    { header: "Số ĐT", width: 18, align: "center" },
    { header: "Số giao dịch", width: 16, align: "right", numFmt: "#,##0" },
    { header: "Tổng SL", width: 16, align: "right", numFmt: "#,##0" },
    { header: "Tổng giá trị", width: 26, align: "right" },
  ];

  const supplierRows = data.suppliers.map((s, idx) => [
    idx + 1,
    s.supplierName,
    "Nhà cung cấp",
    s.phone || "—",
    s.receiptCount,
    s.totalQuantity,
    formatVnd(s.totalAmount),
  ]);

  const offset = data.suppliers.length;
  const customerRows = data.customers.map((c, idx) => [
    offset + idx + 1,
    c.customerName,
    "Khách hàng",
    c.phone || "—",
    c.issueCount,
    c.totalQuantity,
    formatVnd(c.totalRevenue),
  ]);

  const rows = [...supplierRows, ...customerRows];

  const totalSupplierAmt = data.suppliers.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalCustomerRevenue = data.customers.reduce((sum, c) => sum + c.totalRevenue, 0);

  const totals: ExcelReportTotal[] = [
    {
      left: "Tổng mua từ Nhà cung cấp",
      right: formatVnd(totalSupplierAmt),
    },
    {
      left: "Tổng bán cho Khách hàng",
      right: formatVnd(totalCustomerRevenue),
    },
  ];

  return generateStyledExcelReport({
    title: "BÁO CÁO ĐỐI TÁC CUNG CẤP & KHÁCH HÀNG",
    sheetName: "Doi_Tac",
    fields,
    columns,
    rows,
    totals,
  });
}

// ---------------------------------------------------------------------------------
// 5. Stock Card (Thẻ kho chi tiết) Excel workbook
// ---------------------------------------------------------------------------------
export async function buildStockCardExcel(
  data: StockCardData,
  range: { from: string; to: string }
): Promise<Uint8Array> {
  const periodLabel = `Từ ngày ${formatDate(range.from)} đến ngày ${formatDate(range.to)}`;
  const fields: ExcelReportField[] = [
    { label: "Kỳ báo cáo", value: periodLabel },
    { label: "Vật tư", value: `${data.productName} (${data.variantLabel})` },
    { label: "Đơn vị tính", value: data.unit },
    { label: "Kho", value: data.locationName },
    { label: "Tồn đầu kỳ", value: formatNumber(data.openingStock) },
    { label: "Tồn cuối kỳ", value: formatNumber(data.closingStock) },
  ];

  const columns: ExcelReportColumn[] = [
    { header: "STT", width: 7, align: "center" },
    { header: "Ngày ghi sổ", width: 22, align: "center" },
    { header: "Mã CT", width: 15, align: "center" },
    { header: "Loại biến động", width: 26, align: "left", colSpan: 2 },
    { header: "Người thực hiện", width: 24, align: "left" },
    { header: "Nhập", width: 14, align: "right" },
    { header: "Xuất", width: 14, align: "right" },
    { header: "Tồn", width: 14, align: "right", numFmt: "#,##0" },
  ];

  const rows = data.entries.map((e, idx) => [
    idx + 1,
    formatDateTime(e.createdAt),
    e.refCode || "—",
    e.movementLabel,
    e.actorName,
    e.inQty > 0 ? e.inQty : "—",
    e.outQty > 0 ? e.outQty : "—",
    e.runningBalance,
  ]);

  const totals: ExcelReportTotal[] = [
    { left: "Tổng nhập trong kỳ", right: formatNumber(data.totalIn) },
    { left: "Tổng xuất trong kỳ", right: formatNumber(data.totalOut) },
    { left: "Tồn cuối kỳ", right: formatNumber(data.closingStock) },
  ];

  return generateStyledExcelReport({
    title: "THẺ KHO (SỔ KHO CHI TIẾT)",
    sheetName: "The_Kho",
    fields,
    columns,
    rows,
    totals,
  });
}

// ---------------------------------------------------------------------------------
// 6. Requisitions Report (Báo cáo yêu cầu vật tư) Excel workbook
// ---------------------------------------------------------------------------------
export async function buildRequisitionsExcel(
  requisitions: RequisitionReportRow[],
  range?: { from?: string | null; to?: string | null },
  filterInfo?: { status?: string | null; zoneName?: string | null }
): Promise<Uint8Array> {
  const periodLabel =
    range?.from && range?.to
      ? `Từ ngày ${formatDate(range.from)} đến ngày ${formatDate(range.to)}`
      : "Tất cả thời gian";

  const fields: ExcelReportField[] = [
    { label: "Kỳ báo cáo", value: periodLabel },
    ...(filterInfo?.status ? [{ label: "Trạng thái", value: filterInfo.status }] : []),
    ...(filterInfo?.zoneName ? [{ label: "Khu vực", value: filterInfo.zoneName }] : []),
  ];

  const columns: ExcelReportColumn[] = [
    { header: "STT", width: 7, align: "center" },
    { header: "Mã phiếu", width: 7, align: "center" }, // Chiều rộng B bằng A (7)
    { header: "Ngày", width: 14, align: "center" },
    { header: "Người yêu cầu", width: 22, align: "left" },
    { header: "Khu vực", width: 18, align: "left" },
    { header: "Vật tư yêu cầu", width: 44, align: "left", colSpan: 2 },
    { header: "Loại", width: 20, align: "left" },
    { header: "SL", width: 9, align: "center" },
    { header: "ĐVT", width: 9, align: "center" },
    { header: "Mục đích sử dụng", width: 32, align: "left" },
    { header: "Trạng thái", width: 16, align: "center" },
  ];

  const rows: (string | number | null | undefined)[][] = [];
  const merges: { startRow: number; endRow: number; cols: number[] }[] = [];

  const tableHeaderRowIndex = 8 + fields.length + 1; // 1-based header row
  let currentRowIndex = tableHeaderRowIndex + 1; // 1-based first data row

  requisitions.forEach((req, idx) => {
    const items =
      req.items.length > 0
        ? req.items
        : [{ productName: "—", variantLabel: "", quantity: 0, unit: "" }];

    const startRow = currentRowIndex;

    items.forEach((item) => {
      rows.push([
        idx + 1,
        req.code,
        formatDate(req.createdAt),
        req.requesterName || "—",
        req.zoneName || "—",
        item.productName || "—",
        item.variantLabel || "—",
        item.quantity > 0 ? item.quantity : "—",
        item.unit || "—",
        req.purpose || "—",
        req.statusLabel,
      ]);
      currentRowIndex++;
    });

    const endRow = currentRowIndex - 1;

    if (items.length > 1) {
      merges.push({
        startRow,
        endRow,
        cols: [1, 2, 3, 4, 5, 10, 11], // 1-based logical col indices for STT, Mã, Ngày, Người, Khu vực, Mục đích, Trạng thái
      });
    }
  });

  const totals: ExcelReportTotal[] = [
    {
      left: "TỔNG SỐ PHIẾU YÊU CẦU",
      right: `${requisitions.length} phiếu`,
    },
  ];

  // Secondary flat detail sheet for pivot/filtering
  const detailRows: (string | number | null | undefined)[][] = [];
  let itemCounter = 1;
  requisitions.forEach((req) => {
    const items =
      req.items.length > 0
        ? req.items
        : [{ productName: "—", variantLabel: "", quantity: 0, unit: "" }];

    items.forEach((item) => {
      detailRows.push([
        itemCounter++,
        req.code,
        formatDate(req.createdAt),
        req.requesterName || "—",
        req.zoneName || "—",
        item.productName || "—",
        item.variantLabel || "—",
        item.quantity > 0 ? item.quantity : "—",
        item.unit || "—",
        req.purpose || "—",
        req.statusLabel,
      ]);
    });
  });

  return generateStyledExcelReport({
    title: "BÁO CÁO TỔNG HỢP PHIẾU YÊU CẦU VẬT TƯ",
    sheetName: "Yeu_Cau_Vat_Tu",
    fields,
    columns,
    rows,
    totals,
    merges,
    secondarySheet: {
      sheetName: "Chi_Tiet_Vat_Tu",
      title: "CHI TIẾT VẬT TƯ YÊU CẦU THEO PHIẾU",
      periodText: periodLabel,
      columns,
      rows: detailRows,
    },
  });
}
