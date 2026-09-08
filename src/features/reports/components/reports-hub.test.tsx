import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});
import type {
  GeneralReportData,
  PartnersReportData,
  StockCardData,
  VehicleReportData,
  ZoneCostReportData,
} from "../types";
import type { StockLocationOption } from "./report-date-filters";
import { ReportsHub } from "./reports-hub";
import type { StockVariantOption } from "./stock-card-tab";

// Mock server actions
vi.mock("../actions", () => ({
  getGeneralReportAction: vi.fn(),
  getZoneCostReportAction: vi.fn(),
  getVehicleReportAction: vi.fn(),
  getPartnersReportAction: vi.fn(),
  getStockCardAction: vi.fn(),
}));

import {
  getGeneralReportAction,
  getPartnersReportAction,
  getStockCardAction,
  getVehicleReportAction,
  getZoneCostReportAction,
} from "../actions";

const mockLocations: StockLocationOption[] = [
  { id: "loc-1", code: "KHO_CHINH", name: "Kho Tổng Chính" },
  { id: "loc-2", code: "KHO_CAM", name: "Kho Cám & Dinh Dưỡng" },
];

const mockVariants: StockVariantOption[] = [
  {
    id: "var-1",
    productName: "Bóng đèn sưởi hồng ngoại",
    variantLabel: "100W",
    unit: "bóng",
  },
  {
    id: "var-2",
    productName: "Thuốc sát trùng Vikon",
    variantLabel: "Can 5L",
    unit: "can",
  },
];

const mockInitialGeneralData: GeneralReportData = {
  totalInventoryValue: 120000000,
  totalImportValue: 50000000,
  totalIssuedCost: 35000000,
  totalSalesRevenue: 18000000,
  categoryBreakdown: [
    { categoryName: "Cơ điện", cost: 80000000, percentage: 66.7 },
    { categoryName: "Thú y", cost: 40000000, percentage: 33.3 },
  ],
  defectsSummary: {
    totalDefects: 5,
    repairedCount: 3,
    repairCost: 1500000,
    liquidationRevenue: 800000,
  },
  fuelSummary: {
    totalImportedLiters: 4000,
    totalDispensedLiters: 3200,
    currentTankStock: 1500,
    estimatedCost: 64000000,
  },
  stockLedger: [
    {
      variantId: "var-1",
      productName: "Bóng đèn sưởi hồng ngoại",
      variantLabel: "100W",
      unit: "bóng",
      categoryName: "Cơ điện",
      openingQty: 40,
      inQty: 60,
      outQty: 20,
      closingQty: 80,
      unitPrice: 50000,
      closingValue: 4000000,
    },
  ],
};

const mockZoneData: ZoneCostReportData = {
  grandTotalCost: 45000000,
  zones: [
    {
      zoneId: "zone-1",
      zoneName: "Chuồng Gà Đẻ Số 01",
      totalCost: 30000000,
      percentage: 66.7,
      issueCount: 8,
      defectCount: 2,
      items: [
        {
          productName: "Bóng đèn",
          variantLabel: "100W",
          unit: "bóng",
          quantity: 20,
          unitPrice: 50000,
          totalAmount: 1000000,
        },
      ],
    },
    {
      zoneId: "zone-2",
      zoneName: "Chuồng Gà Đẻ Số 02",
      totalCost: 15000000,
      percentage: 33.3,
      issueCount: 4,
      defectCount: 1,
      items: [],
    },
  ],
};

const mockVehicleData: VehicleReportData = {
  totalLitersAllVehicles: 850,
  vehicles: [
    {
      vehicleId: "veh-1",
      code: "XE-01",
      name: "Xe tải Isuzu 2.5T",
      plate: "60C-123.45",
      odoUnit: "km",
      fuelNorm: 12,
      totalLiters: 450,
      dispenseCount: 6,
      totalUsageDiff: 3800,
      avgRate: 11.84,
      normDiff: -0.16,
      isOverNorm: false,
    },
  ],
};

const mockPartnersData: PartnersReportData = {
  suppliers: [
    {
      supplierId: "sup-1",
      supplierName: "Công ty TNHH Cám CP",
      phone: "0901234567",
      receiptCount: 10,
      totalQuantity: 500,
      totalAmount: 95000000,
    },
  ],
  customers: [
    {
      customerId: "cus-1",
      customerName: "Đại lý Trứng Gia Cầm Miền Đông",
      phone: "0987654321",
      issueCount: 15,
      totalQuantity: 1200,
      totalRevenue: 65000000,
    },
  ],
};

const mockStockCardData: StockCardData = {
  variantId: "var-1",
  productName: "Bóng đèn sưởi hồng ngoại",
  variantLabel: "100W",
  unit: "bóng",
  locationName: "Kho Tổng Chính",
  openingStock: 40,
  totalIn: 60,
  totalOut: 20,
  closingStock: 80,
  entries: [
    {
      id: "mov-1",
      createdAt: "2026-09-01T08:00:00.000Z",
      refType: "receipt",
      refCode: "PNK-20260901-01",
      movementType: "receipt",
      movementLabel: "Nhập kho mua hàng",
      notes: "Nhập lô bóng đèn mới",
      actorName: "Nguyễn Văn Kho",
      inQty: 60,
      outQty: 0,
      runningBalance: 100,
    },
    {
      id: "mov-2",
      createdAt: "2026-09-05T09:30:00.000Z",
      refType: "issue",
      refCode: "PXK-20260905-02",
      movementType: "issue",
      movementLabel: "Xuất sử dụng",
      notes: "Thay bóng hư chuồng 1",
      actorName: "Nguyễn Văn Kho",
      inQty: 0,
      outQty: 20,
      runningBalance: 80,
    },
  ],
};

describe("ReportsHub component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGeneralReportAction).mockResolvedValue(mockInitialGeneralData);
    vi.mocked(getZoneCostReportAction).mockResolvedValue(mockZoneData);
    vi.mocked(getVehicleReportAction).mockResolvedValue(mockVehicleData);
    vi.mocked(getPartnersReportAction).mockResolvedValue(mockPartnersData);
    vi.mocked(getStockCardAction).mockResolvedValue(mockStockCardData);
  });

  it("renders header with title, subtitle, and export buttons", () => {
    render(
      <ReportsHub
        initialGeneralData={mockInitialGeneralData}
        locations={mockLocations}
        variants={mockVariants}
        initialDateRange={{
          from: "2026-09-01",
          to: "2026-09-30",
          preset: "this_month",
        }}
      />
    );

    // Title & Subtitle
    expect(screen.getByText("Trung tâm Báo cáo & Thống kê")).toBeDefined();
    expect(
      screen.getByText(/Trại gà đẻ trứng Lê Văn Dương/i)
    ).toBeDefined();

    // Export Buttons
    const exportExcelBtn = screen.getByRole("link", {
      name: /Xuất Excel \(\.xlsx\)/i,
    });
    expect(exportExcelBtn).toBeDefined();
    expect(exportExcelBtn.getAttribute("href")).toContain("/api/reports/export");
    expect(exportExcelBtn.getAttribute("href")).toContain("type=stock_ledger");
    expect(exportExcelBtn.getAttribute("href")).toContain("from=2026-09-01");
    expect(exportExcelBtn.getAttribute("href")).toContain("to=2026-09-30");

    const printPdfBtn = screen.getByRole("link", {
      name: /In Báo Cáo PDF/i,
    });
    expect(printPdfBtn).toBeDefined();
    expect(printPdfBtn.getAttribute("href")).toContain("/api/reports/pdf");
    expect(printPdfBtn.getAttribute("href")).toContain("type=stock_ledger");
    expect(printPdfBtn.getAttribute("target")).toBe("_blank");

    // All tabs exist
    expect(screen.getByRole("tab", { name: /Báo cáo Chung/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Theo Chuồng/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Phương tiện/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Đối tác/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Sổ Thẻ kho/i })).toBeDefined();

    // Initial General Tab Content is rendered
    expect(screen.getByText("Tổng giá trị kho hiện tại")).toBeDefined();
    expect(screen.getByText("120.000.000 đ")).toBeDefined();
    expect(screen.getByText("Bóng đèn sưởi hồng ngoại")).toBeDefined();
  });

  it("switches tabs and fetches corresponding report data", async () => {
    render(
      <ReportsHub
        initialGeneralData={mockInitialGeneralData}
        locations={mockLocations}
        variants={mockVariants}
        initialDateRange={{
          from: "2026-09-01",
          to: "2026-09-30",
          preset: "this_month",
        }}
      />
    );

    // 1. Switch to "Theo Chuồng" (zones)
    const zonesTab = screen.getByRole("tab", { name: /Theo Chuồng/i });
    fireEvent.click(zonesTab);

    await waitFor(() => {
      expect(getZoneCostReportAction).toHaveBeenCalledWith({
        from: "2026-09-01",
        to: "2026-09-30",
      });
      expect(screen.getAllByText("Chuồng Gà Đẻ Số 01").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Chuồng Gà Đẻ Số 02")).toBeDefined();
      expect(screen.getAllByText("45.000.000 đ").length).toBeGreaterThanOrEqual(1);
    });

    // 2. Switch to "Phương tiện" (vehicles)
    const vehiclesTab = screen.getByRole("tab", { name: /Phương tiện/i });
    fireEvent.click(vehiclesTab);

    await waitFor(() => {
      expect(getVehicleReportAction).toHaveBeenCalledWith({
        from: "2026-09-01",
        to: "2026-09-30",
      });
      expect(screen.getByText("Xe tải Isuzu 2.5T")).toBeDefined();
      expect(screen.getByText("XE-01")).toBeDefined();
      expect(screen.getByText("60C-123.45")).toBeDefined();
    });

    // 3. Switch to "Đối tác" (partners)
    const partnersTab = screen.getByRole("tab", { name: /Đối tác/i });
    fireEvent.click(partnersTab);

    await waitFor(() => {
      expect(getPartnersReportAction).toHaveBeenCalledWith({
        from: "2026-09-01",
        to: "2026-09-30",
      });
      expect(screen.getByText("Công ty TNHH Cám CP")).toBeDefined();
    });

    // 4. Switch to "Sổ Thẻ kho" (stock_card)
    const stockCardTab = screen.getByRole("tab", { name: /Sổ Thẻ kho/i });
    fireEvent.click(stockCardTab);

    expect(
      screen.getByText("Vui lòng chọn một vật tư để xem sổ thẻ kho")
    ).toBeDefined();

    // Select a variant via combobox
    const combobox = screen.getByText("-- Chọn hoặc gõ tìm vật tư / biến thể --");
    fireEvent.click(combobox);
    const option = screen.getByText("Bóng đèn sưởi hồng ngoại - 100W (bóng)");
    fireEvent.click(option);

    await waitFor(() => {
      expect(getStockCardAction).toHaveBeenCalledWith({
        variantId: "var-1",
        locationId: undefined,
        from: "2026-09-01",
        to: "2026-09-30",
      });
      expect(screen.getByText("PNK-20260901-01")).toBeDefined();
      expect(screen.getByText("PXK-20260905-02")).toBeDefined();
      expect(screen.getByText("Nhập lô bóng đèn mới")).toBeDefined();
    });
  });

  it("updates export button hrefs based on active tab and filters", async () => {
    render(
      <ReportsHub
        initialGeneralData={mockInitialGeneralData}
        locations={mockLocations}
        variants={mockVariants}
        initialDateRange={{
          from: "2026-09-01",
          to: "2026-09-30",
          preset: "this_month",
        }}
      />
    );

    // Initial General Tab: type=stock_ledger
    let exportBtn = screen.getByRole("link", { name: /Xuất Excel \(\.xlsx\)/i });
    expect(exportBtn.getAttribute("href")).toContain("type=stock_ledger");

    // Switch to Zones: type=zone_cost
    fireEvent.click(screen.getByRole("tab", { name: /Theo Chuồng/i }));
    await waitFor(() => {
      exportBtn = screen.getByRole("link", { name: /Xuất Excel \(\.xlsx\)/i });
      expect(exportBtn.getAttribute("href")).toContain("type=zone_cost");
    });

    // Switch to Vehicles: type=vehicles
    fireEvent.click(screen.getByRole("tab", { name: /Phương tiện/i }));
    await waitFor(() => {
      exportBtn = screen.getByRole("link", { name: /Xuất Excel \(\.xlsx\)/i });
      expect(exportBtn.getAttribute("href")).toContain("type=vehicles");
    });

    // Switch to Partners: type=partners
    fireEvent.click(screen.getByRole("tab", { name: /Đối tác/i }));
    await waitFor(() => {
      exportBtn = screen.getByRole("link", { name: /Xuất Excel \(\.xlsx\)/i });
      expect(exportBtn.getAttribute("href")).toContain("type=partners");
    });

    // Switch to Stock Card without selected variant -> disabled
    fireEvent.click(screen.getByRole("tab", { name: /Sổ Thẻ kho/i }));
    expect(screen.queryByRole("link", { name: /Xuất Excel \(\.xlsx\)/i })).toBeNull();
    const disabledBtn = screen.getByRole("button", { name: /Xuất Excel \(\.xlsx\)/i });
    expect(disabledBtn.hasAttribute("disabled")).toBe(true);

    // Select variant via combobox -> enabled link with type=stock_card & variantId=var-1
    const combobox = screen.getByText("-- Chọn hoặc gõ tìm vật tư / biến thể --");
    fireEvent.click(combobox);
    const option = screen.getByText("Bóng đèn sưởi hồng ngoại - 100W (bóng)");
    fireEvent.click(option);

    await waitFor(() => {
      exportBtn = screen.getByRole("link", { name: /Xuất Excel \(\.xlsx\)/i });
      expect(exportBtn.getAttribute("href")).toContain("type=stock_card");
      expect(exportBtn.getAttribute("href")).toContain("variantId=var-1");
    });

    // Change location filter
    const locationSelect = screen.getByLabelText("Kho");
    fireEvent.change(locationSelect, { target: { value: "loc-1" } });

    await waitFor(() => {
      exportBtn = screen.getByRole("link", { name: /Xuất Excel \(\.xlsx\)/i });
      expect(exportBtn.getAttribute("href")).toContain("location=loc-1");
    });
  });

  it("reloads data when date filters change", async () => {
    render(
      <ReportsHub
        initialGeneralData={mockInitialGeneralData}
        locations={mockLocations}
        variants={mockVariants}
        initialDateRange={{
          from: "2026-09-01",
          to: "2026-09-30",
          preset: "this_month",
        }}
      />
    );

    // Click "7 ngày qua" preset
    const preset7Days = screen.getByRole("button", { name: "7 ngày qua" });
    fireEvent.click(preset7Days);

    await waitFor(() => {
      expect(getGeneralReportAction).toHaveBeenCalled();
      const calls = vi.mocked(getGeneralReportAction).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.from).toBeDefined();
      expect(lastCall.to).toBeDefined();
    });

    // Custom from date input change
    const fromInput = screen.getByLabelText("Từ ngày");
    fireEvent.change(fromInput, { target: { value: "2026-08-01" } });

    await waitFor(() => {
      expect(getGeneralReportAction).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "2026-08-01",
        })
      );
    });

    const exportBtn = screen.getByRole("link", { name: /Xuất Excel \(\.xlsx\)/i });
    expect(exportBtn.getAttribute("href")).toContain("from=2026-08-01");
  });
});
