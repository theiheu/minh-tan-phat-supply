import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  BRAND_EXCEL_TITLE,
  buildPartnersExcel,
  buildRequisitionsExcel,
  buildStockCardExcel,
  buildStockLedgerExcel,
  buildVehicleExcel,
  buildZoneCostExcel,
  calculateColumnWidths,
  formatReportPeriod,
} from "./excel-export";
import type {
  GeneralReportData,
  PartnersReportData,
  RequisitionReportRow,
  StockCardData,
  VehicleReportData,
  ZoneCostReportData,
} from "../types";

describe("excel-export engine", () => {
  const range = { from: "2026-09-01", to: "2026-09-30" };

  it("formats report period text correctly", () => {
    const text = formatReportPeriod(range);
    expect(text).toContain("Kỳ báo cáo: Từ ngày 01/09/2026 đến ngày 30/09/2026");
  });

  it("calculates auto column widths cleanly", () => {
    const rows = [
      ["STT", "Tên vật tư rất dài trong kho", "ĐVT"],
      [1, "Cám gà", "Bao"],
    ];
    const widths = calculateColumnWidths(rows);
    expect(widths.length).toBe(3);
    expect(widths[0].wch).toBeGreaterThanOrEqual(10);
    expect(widths[1].wch).toBeGreaterThan(20);
    expect(widths[2].wch).toBe(10);
  });

  describe("buildStockLedgerExcel", () => {
    const mockGeneralData: GeneralReportData = {
      totalInventoryValue: 15500000,
      totalImportValue: 20000000,
      totalIssuedCost: 12000000,
      totalSalesRevenue: 5000000,
      stockLedger: [
        {
          variantId: "v1",
          productName: "Cám đẻ CP",
          variantLabel: "Bao 40kg",
          unit: "bao",
          categoryName: "Thức ăn chăn nuôi",
          openingQty: 100,
          inQty: 50,
          outQty: 30,
          closingQty: 120,
          unitPrice: 350000,
          closingValue: 42000000,
        },
        {
          variantId: "v2",
          productName: "Men vi sinh",
          variantLabel: "Gói 1kg",
          unit: "gói",
          categoryName: "Thuốc thú y",
          openingQty: 20,
          inQty: 10,
          outQty: 5,
          closingQty: 25,
          unitPrice: 120000,
          closingValue: 3000000,
        },
      ],
      categoryBreakdown: [
        { categoryName: "Thức ăn chăn nuôi", cost: 42000000, percentage: 93.33 },
        { categoryName: "Thuốc thú y", cost: 3000000, percentage: 6.67 },
      ],
      defectsSummary: {
        totalDefects: 2,
        repairedCount: 1,
        repairCost: 500000,
        liquidationRevenue: 200000,
      },
      fuelSummary: {
        totalImportedLiters: 1000,
        totalDispensedLiters: 800,
        currentTankStock: 200,
        estimatedCost: 16000000,
      },
    };

    it("generates a valid binary buffer and workbook structure with sheets", () => {
      const buffer = buildStockLedgerExcel(mockGeneralData, range, "Kho Tổng");
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBeGreaterThan(0);

      const wb = XLSX.read(buffer, { type: "array" });
      expect(wb.SheetNames).toContain("Xuat_Nhap_Ton");
      expect(wb.SheetNames).toContain("Co_Cau_Danh_Muc");

      // Check sheet 1 contents
      const ws1 = wb.Sheets["Xuat_Nhap_Ton"];
      const rows1 = XLSX.utils.sheet_to_json<string[]>(ws1, { header: 1 });
      expect(rows1[0][0]).toBe(BRAND_EXCEL_TITLE);
      expect(rows1[1][0]).toBe("BÁO CÁO XUẤT - NHẬP - TỒN KHO");
      expect(rows1[2][0]).toContain("Kho: Kho Tổng");

      // Verify header row
      const headers = rows1[4];
      expect(headers).toContain("Tên vật tư");
      expect(headers).toContain("Giá trị tồn (VNĐ)");

      // Verify data rows
      expect(rows1[5][1]).toBe("Cám đẻ CP");
      expect(rows1[6][1]).toBe("Men vi sinh");

      // Verify total summary row
      const lastRow = rows1[rows1.length - 1];
      expect(lastRow[0]).toBe("TỔNG CỘNG");
      expect(lastRow[5]).toBe(120); // total opening: 100 + 20
      expect(lastRow[6]).toBe(60); // total in: 50 + 10
      expect(lastRow[7]).toBe(35); // total out: 30 + 5
      expect(lastRow[8]).toBe(145); // total closing: 120 + 25
    });
  });

  describe("buildZoneCostExcel", () => {
    const mockZoneData: ZoneCostReportData = {
      grandTotalCost: 25000000,
      zones: [
        {
          zoneId: "z1",
          zoneName: "Chuồng 1 - Gà hậu bị",
          totalCost: 15000000,
          percentage: 60,
          issueCount: 5,
          defectCount: 1,
          items: [
            {
              productName: "Cám hậu bị",
              variantLabel: "Bao 40kg",
              unit: "bao",
              quantity: 40,
              unitPrice: 350000,
              totalAmount: 14000000,
            },
            {
              productName: "Bóng đèn sưởi",
              variantLabel: "100W",
              unit: "cái",
              quantity: 10,
              unitPrice: 100000,
              totalAmount: 1000000,
            },
          ],
        },
        {
          zoneId: "z2",
          zoneName: "Chuồng 2 - Gà đẻ",
          totalCost: 10000000,
          percentage: 40,
          issueCount: 3,
          defectCount: 0,
          items: [
            {
              productName: "Cám đẻ cao sản",
              variantLabel: "Bao 40kg",
              unit: "bao",
              quantity: 25,
              unitPrice: 400000,
              totalAmount: 10000000,
            },
          ],
        },
      ],
    };

    it("generates valid workbook with summary and detail sheets", () => {
      const buffer = buildZoneCostExcel(mockZoneData, range);
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBeGreaterThan(0);

      const wb = XLSX.read(buffer, { type: "array" });
      expect(wb.SheetNames).toContain("Chi_Phi_Khu_Vuc");
      expect(wb.SheetNames).toContain("Chi_Tiet_Vat_Tu");

      // Check summary sheet
      const ws1 = wb.Sheets["Chi_Phi_Khu_Vuc"];
      const rows1 = XLSX.utils.sheet_to_json<string[]>(ws1, { header: 1 });
      expect(rows1[0][0]).toBe(BRAND_EXCEL_TITLE);
      expect(rows1[1][0]).toBe("BÁO CÁO CHI PHÍ VẬT TƯ THEO KHU VỰC");

      // Verify zone rows
      expect(rows1[5][1]).toBe("Chuồng 1 - Gà hậu bị");
      expect(rows1[6][1]).toBe("Chuồng 2 - Gà đẻ");

      // Verify grand total
      const lastRow = rows1[rows1.length - 1];
      expect(lastRow[0]).toBe("TỔNG CỘNG");
      expect(lastRow[4]).toBe(25000000);

      // Check detail sheet
      const ws2 = wb.Sheets["Chi_Tiet_Vat_Tu"];
      const rows2 = XLSX.utils.sheet_to_json<string[]>(ws2, { header: 1 });
      expect(rows2[1][0]).toBe("CHI TIẾT VẬT TƯ XUẤT THEO KHU VỰC");
      expect(rows2.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe("buildVehicleExcel", () => {
    const mockVehicleData: VehicleReportData = {
      totalLitersAllVehicles: 450,
      vehicles: [
        {
          vehicleId: "veh1",
          code: "XE-01",
          name: "Xe tải 2.5T",
          plate: "61C-12345",
          odoUnit: "km",
          fuelNorm: 15,
          totalLiters: 300,
          dispenseCount: 6,
          totalUsageDiff: 2000,
          avgRate: 15,
          normDiff: 0,
          isOverNorm: false,
        },
        {
          vehicleId: "veh2",
          code: "MAY-01",
          name: "Máy phát điện Cummins",
          plate: null,
          odoUnit: "hours",
          fuelNorm: 10,
          totalLiters: 150,
          dispenseCount: 3,
          totalUsageDiff: 10,
          avgRate: 15,
          normDiff: 5,
          isOverNorm: true,
        },
      ],
    };

    it("generates valid workbook for vehicle fuel consumption", () => {
      const buffer = buildVehicleExcel(mockVehicleData, range);
      expect(buffer).toBeInstanceOf(Uint8Array);

      const wb = XLSX.read(buffer, { type: "array" });
      expect(wb.SheetNames).toContain("Nhien_Lieu_Phuong_Tien");

      const ws = wb.Sheets["Nhien_Lieu_Phuong_Tien"];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      expect(rows[0][0]).toBe(BRAND_EXCEL_TITLE);
      expect(rows[1][0]).toBe("BÁO CÁO TIÊU THỤ NHIÊN LIỆU PHƯƠNG TIỆN & MÁY MÓC");

      expect(rows[5][1]).toBe("XE-01");
      expect(rows[6][1]).toBe("MAY-01");
      expect(rows[6][10]).toBe("Vượt định mức");

      const lastRow = rows[rows.length - 1];
      expect(lastRow[0]).toBe("TỔNG CỘNG");
      expect(lastRow[5]).toBe(450);
    });
  });

  describe("buildPartnersExcel", () => {
    const mockPartnersData: PartnersReportData = {
      suppliers: [
        {
          supplierId: "sup1",
          supplierName: "Công ty Cổ phần C.P Việt Nam",
          phone: "02743123456",
          receiptCount: 4,
          totalQuantity: 200,
          totalAmount: 70000000,
        },
      ],
      customers: [
        {
          customerId: "cus1",
          customerName: "Đại lý trứng Minh Đức",
          phone: "0912345678",
          issueCount: 8,
          totalQuantity: 50000,
          totalRevenue: 125000000,
        },
      ],
    };

    it("generates valid workbook with supplier and customer sheets", () => {
      const buffer = buildPartnersExcel(mockPartnersData, range);
      expect(buffer).toBeInstanceOf(Uint8Array);

      const wb = XLSX.read(buffer, { type: "array" });
      expect(wb.SheetNames).toContain("Nha_Cung_Cap");
      expect(wb.SheetNames).toContain("Khach_Hang");

      // Sheet 1: Suppliers
      const ws1 = wb.Sheets["Nha_Cung_Cap"];
      const rows1 = XLSX.utils.sheet_to_json<string[]>(ws1, { header: 1 });
      expect(rows1[1][0]).toBe("BÁO CÁO NHÀ CUNG CẤP VẬT TƯ");
      expect(rows1[5][1]).toBe("Công ty Cổ phần C.P Việt Nam");
      const lastRow1 = rows1[rows1.length - 1];
      expect(lastRow1[5]).toBe(70000000);

      // Sheet 2: Customers
      const ws2 = wb.Sheets["Khach_Hang"];
      const rows2 = XLSX.utils.sheet_to_json<string[]>(ws2, { header: 1 });
      expect(rows2[1][0]).toBe("BÁO CÁO KHÁCH HÀNG MUA VẬT TƯ / HÀNG HOÁ");
      expect(rows2[5][1]).toBe("Đại lý trứng Minh Đức");
      const lastRow2 = rows2[rows2.length - 1];
      expect(lastRow2[5]).toBe(125000000);
    });
  });

  describe("buildStockCardExcel", () => {
    const mockStockCard: StockCardData = {
      variantId: "v1",
      productName: "Cám đẻ CP 511",
      variantLabel: "Bao 40kg",
      unit: "bao",
      locationName: "Kho cám số 1",
      openingStock: 50,
      totalIn: 100,
      totalOut: 80,
      closingStock: 70,
      entries: [
        {
          id: "m1",
          createdAt: "2026-09-05T08:30:00.000Z",
          refType: "receipt",
          refCode: "PNK-0012",
          movementType: "receipt",
          movementLabel: "Nhập mua hàng",
          notes: "Nhập hàng từ nhà cung cấp C.P",
          actorName: "Lê Văn Dương",
          inQty: 100,
          outQty: 0,
          runningBalance: 150,
        },
        {
          id: "m2",
          createdAt: "2026-09-10T14:15:00.000Z",
          refType: "issue",
          refCode: "PXK-0034",
          movementType: "issue",
          movementLabel: "Xuất sử dụng",
          notes: "Xuất cho Chuồng 1",
          actorName: "Nguyễn Văn B",
          inQty: 0,
          outQty: 80,
          runningBalance: 70,
        },
      ],
    };

    it("generates valid workbook for stock card ledger", () => {
      const buffer = buildStockCardExcel(mockStockCard, range);
      expect(buffer).toBeInstanceOf(Uint8Array);

      const wb = XLSX.read(buffer, { type: "array" });
      expect(wb.SheetNames).toContain("The_Kho");

      const ws = wb.Sheets["The_Kho"];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      expect(rows[0][0]).toBe(BRAND_EXCEL_TITLE);
      expect(rows[1][0]).toBe("THẺ KHO (SỔ KHO CHI TIẾT VẬT TƯ)");
      expect(rows[3][0]).toContain("Cám đẻ CP 511");
      expect(rows[3][0]).toContain("Kho cám số 1");
      expect(rows[4][0]).toContain("Tồn đầu kỳ: 50");
      expect(rows[4][0]).toContain("Tồn cuối kỳ: 70");

      // Data rows
      expect(rows[7][2]).toBe("PNK-0012");
      expect(rows[7][5]).toBe(100);
      expect(rows[8][2]).toBe("PXK-0034");
      expect(rows[8][6]).toBe(80);

      // Summary row
      const lastRow = rows[rows.length - 1];
      expect(lastRow[0]).toBe("TỔNG CỘNG");
      expect(lastRow[5]).toBe(100);
      expect(lastRow[6]).toBe(80);
      expect(lastRow[7]).toBe(70);
    });
  });

  describe("buildRequisitionsExcel", () => {
    const mockRequisitions: RequisitionReportRow[] = [
      {
        id: "req-1",
        code: "REQ-20260901-0001",
        createdAt: "2026-09-01T10:00:00Z",
        requesterName: "Nguyễn Văn A",
        zoneName: "Chuồng Đẻ 1",
        purpose: "Thay bóng sưởi định kỳ",
        requisitionType: "replacement",
        status: "approved",
        statusLabel: "Đã duyệt",
        items: [
          {
            productName: "Bóng đèn sưởi hồng ngoại",
            variantLabel: "150W",
            unit: "bóng",
            quantity: 20,
          },
        ],
      },
    ];

    it("generates valid workbook with summary and detail sheets for requisitions", () => {
      const buffer = buildRequisitionsExcel(mockRequisitions, range, {
        status: "Đã duyệt",
        zoneName: "Chuồng Đẻ 1",
      });
      expect(buffer).toBeInstanceOf(Uint8Array);

      const wb = XLSX.read(buffer, { type: "array" });
      expect(wb.SheetNames).toContain("Yeu_Cau_Vat_Tu");
      expect(wb.SheetNames).toContain("Chi_Tiet_Vat_Tu");

      const wsSummary = wb.Sheets["Yeu_Cau_Vat_Tu"];
      const rows = XLSX.utils.sheet_to_json<string[]>(wsSummary, { header: 1 });
      expect(rows[0][0]).toBe(BRAND_EXCEL_TITLE);
      expect(rows[1][0]).toBe("BÁO CÁO TỔNG HỢP PHIẾU YÊU CẦU VẬT TƯ");
      expect(rows[2][0]).toContain("Kỳ báo cáo");
      expect(rows[2][0]).toContain("Trạng thái: Đã duyệt");
      expect(rows[2][0]).toContain("Khu vực: Chuồng Đẻ 1");
      expect(rows[5][1]).toBe("REQ-20260901-0001");
      expect(rows[5][3]).toBe("Nguyễn Văn A");
    });
  });
});
