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

    it("generates a valid binary buffer and workbook structure with sheets", async () => {
      const buffer = await buildStockLedgerExcel(mockGeneralData, range, "Kho Tổng");
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBeGreaterThan(0);

      const wb = XLSX.read(buffer, { type: "array" });
      expect(wb.SheetNames).toContain("Xuat_Nhap_Ton");

      const ws = wb.Sheets["Xuat_Nhap_Ton"];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      expect(rows[0][2]).toBe("TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG");
      expect(rows[4][0]).toBe("BÁO CÁO XUẤT - NHẬP - TỒN KHO");

      const headerRowIdx = rows.findIndex((r) => r && r[0] === "STT");
      expect(headerRowIdx).toBeGreaterThan(0);

      // Verify columns match PDF (Column B & C merged for Tên vật tư)
      expect(rows[headerRowIdx]).toEqual([
        "STT",
        "Tên vật tư",
        undefined,
        "Biến thể",
        "ĐVT",
        "Tồn đầu",
        "Nhập",
        "Xuất",
        "Tồn cuối",
        "Giá trị tồn",
      ]);

      // Verify data rows
      expect(rows[headerRowIdx + 1][1]).toBe("Cám đẻ CP");
      expect(rows[headerRowIdx + 2][1]).toBe("Men vi sinh");
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
          items: [],
        },
        {
          zoneId: "z2",
          zoneName: "Chuồng 2 - Gà đẻ",
          totalCost: 10000000,
          percentage: 40,
          issueCount: 3,
          defectCount: 0,
          items: [],
        },
      ],
    };

    it("generates valid workbook for zone cost report", async () => {
      const buffer = await buildZoneCostExcel(mockZoneData, range);
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBeGreaterThan(0);

      const wb = XLSX.read(buffer, { type: "array" });
      expect(wb.SheetNames).toContain("Chi_Phi_Khu_Vuc");

      const ws = wb.Sheets["Chi_Phi_Khu_Vuc"];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      expect(rows[0][2]).toBe("TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG");
      expect(rows[4][0]).toBe("BÁO CÁO CHI PHÍ VẬT TƯ THEO KHU VỰC");

      const headerRowIdx = rows.findIndex((r) => r && r[0] === "STT");
      expect(rows[headerRowIdx]).toEqual([
        "STT",
        "Khu vực / Chuồng",
        undefined,
        "Số phiếu xuất",
        "Số BB hỏng",
        "Tổng chi phí",
        "Tỷ trọng",
      ]);

      expect(rows[headerRowIdx + 1][1]).toBe("Chuồng 1 - Gà hậu bị");
      expect(rows[headerRowIdx + 2][1]).toBe("Chuồng 2 - Gà đẻ");
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

    it("generates valid workbook for vehicle fuel consumption", async () => {
      const buffer = await buildVehicleExcel(mockVehicleData, range);
      expect(buffer).toBeInstanceOf(Uint8Array);

      const wb = XLSX.read(buffer, { type: "array" });
      expect(wb.SheetNames).toContain("Nhien_Lieu_Xe");

      const ws = wb.Sheets["Nhien_Lieu_Xe"];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      expect(rows[0][2]).toBe("TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG");
      expect(rows[4][0]).toBe("BÁO CÁO TIÊU THỤ NHIÊN LIỆU PHƯƠNG TIỆN");

      const headerRowIdx = rows.findIndex((r) => r && r[0] === "STT");
      expect(rows[headerRowIdx + 1][1]).toBe("XE-01");
      expect(rows[headerRowIdx + 2][1]).toBe("MAY-01");
      expect(rows[headerRowIdx + 2][9]).toBe("Vượt định mức");
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

    it("generates valid workbook with supplier and customer data", async () => {
      const buffer = await buildPartnersExcel(mockPartnersData, range);
      expect(buffer).toBeInstanceOf(Uint8Array);

      const wb = XLSX.read(buffer, { type: "array" });
      expect(wb.SheetNames).toContain("Doi_Tac");

      const ws = wb.Sheets["Doi_Tac"];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      expect(rows[0][2]).toBe("TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG");
      expect(rows[4][0]).toBe("BÁO CÁO ĐỐI TÁC CUNG CẤP & KHÁCH HÀNG");

      const headerRowIdx = rows.findIndex((r) => r && r[0] === "STT");
      expect(rows[headerRowIdx + 1][1]).toBe("Công ty Cổ phần C.P Việt Nam");
      expect(rows[headerRowIdx + 1][3]).toBe("Nhà cung cấp");
      expect(rows[headerRowIdx + 2][1]).toBe("Đại lý trứng Minh Đức");
      expect(rows[headerRowIdx + 2][3]).toBe("Khách hàng");
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
      ],
    };

    it("generates valid workbook for stock card ledger", async () => {
      const buffer = await buildStockCardExcel(mockStockCard, range);
      expect(buffer).toBeInstanceOf(Uint8Array);

      const wb = XLSX.read(buffer, { type: "array" });
      expect(wb.SheetNames).toContain("The_Kho");

      const ws = wb.Sheets["The_Kho"];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      expect(rows[0][2]).toBe("TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG");
      expect(rows[4][0]).toBe("THẺ KHO (SỔ KHO CHI TIẾT)");

      const headerRowIdx = rows.findIndex((r) => r && r[0] === "STT");
      expect(rows[headerRowIdx]).toEqual([
        "STT",
        "Ngày ghi sổ",
        "Mã CT",
        "Loại biến động",
        undefined,
        "Người thực hiện",
        "Nhập",
        "Xuất",
        "Tồn",
      ]);
      expect(rows[headerRowIdx + 1][2]).toBe("PNK-0012");
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

    it("generates valid workbook with summary and detail sheets for requisitions", async () => {
      const buffer = await buildRequisitionsExcel(mockRequisitions, range, {
        status: "Đã duyệt",
        zoneName: "Chuồng Đẻ 1",
      });
      expect(buffer).toBeInstanceOf(Uint8Array);

      const wb = XLSX.read(buffer, { type: "array" });
      expect(wb.SheetNames).toContain("Yeu_Cau_Vat_Tu");
      expect(wb.SheetNames).toContain("Chi_Tiet_Vat_Tu");

      const wsSummary = wb.Sheets["Yeu_Cau_Vat_Tu"];
      const rows = XLSX.utils.sheet_to_json<string[]>(wsSummary, { header: 1 });

      // Brand info is at C1 (index 2)
      expect(rows[0][2]).toBe("TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG");
      // Title is at A5
      expect(rows[4][0]).toBe("BÁO CÁO TỔNG HỢP PHIẾU YÊU CẦU VẬT TƯ");

      const headerRowIdx = rows.findIndex((r) => r && r[0] === "STT");
      expect(rows[headerRowIdx]).toEqual([
        "STT",
        "Mã phiếu",
        "Ngày",
        "Người yêu cầu",
        "Khu vực",
        "Vật tư yêu cầu",
        undefined,
        "Loại",
        "SL",
        "ĐVT",
        "Mục đích sử dụng",
        "Trạng thái",
      ]);

      // Data row
      expect(rows[headerRowIdx + 1][1]).toBe("REQ-20260901-0001");
      expect(rows[headerRowIdx + 1][3]).toBe("Nguyễn Văn A");
      expect(rows[headerRowIdx + 1][5]).toBe("Bóng đèn sưởi hồng ngoại");
      expect(rows[headerRowIdx + 1][7]).toBe("150W");
      expect(rows[headerRowIdx + 1][8]).toBe(20);
      expect(rows[headerRowIdx + 1][9]).toBe("bóng");
    });

    it("handles multiple items with cell merges matching PDF layout", async () => {
      const multiItemRequisitions: RequisitionReportRow[] = [
        {
          id: "req-2",
          code: "REQ-20260901-0002",
          createdAt: "2026-09-01T10:00:00Z",
          requesterName: "Trần Văn B",
          zoneName: "Khu Hậu Bị",
          purpose: "Sửa chữa hệ thống nước",
          requisitionType: "replacement",
          status: "approved",
          statusLabel: "Đã duyệt",
          items: [
            {
              productName: "Ống nước phi 21",
              variantLabel: "Nhựa Tiền Phong",
              unit: "mét",
              quantity: 50,
            },
            {
              productName: "Co nối phi 21",
              variantLabel: "Ren ngoài",
              unit: "cái",
              quantity: 10,
            },
          ],
        },
      ];

      const buffer = await buildRequisitionsExcel(multiItemRequisitions, range);
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets["Yeu_Cau_Vat_Tu"];

      expect(ws["!merges"]).toBeDefined();
      expect(ws["!merges"]!.length).toBeGreaterThanOrEqual(10);

      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      const headerRowIdx = rows.findIndex((r) => r && r[0] === "STT");
      expect(headerRowIdx).toBeGreaterThan(0);

      // Item 1
      const item1Row = rows[headerRowIdx + 1];
      expect(item1Row[1]).toBe("REQ-20260901-0002");
      expect(item1Row[5]).toBe("Ống nước phi 21");
      expect(item1Row[7]).toBe("Nhựa Tiền Phong");
      expect(item1Row[8]).toBe(50);
      expect(item1Row[9]).toBe("mét");

      // Item 2
      const item2Row = rows[headerRowIdx + 2];
      expect(item2Row[5]).toBe("Co nối phi 21");
      expect(item2Row[7]).toBe("Ren ngoài");
      expect(item2Row[8]).toBe(10);
      expect(item2Row[9]).toBe("cái");
    });
  });
});
