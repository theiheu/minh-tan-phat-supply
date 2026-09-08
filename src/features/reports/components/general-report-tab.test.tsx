import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { GeneralReportTab } from "./general-report-tab";
import type { GeneralReportData } from "../types";

const mockReportData: GeneralReportData = {
  totalInventoryValue: 125000000,
  totalImportValue: 45000000,
  totalIssuedCost: 32000000,
  totalSalesRevenue: 15000000,
  categoryBreakdown: [
    { categoryName: "Cơ điện", cost: 75000000, percentage: 60 },
    { categoryName: "Thú y", cost: 37500000, percentage: 30 },
    { categoryName: "Bao bì", cost: 12500000, percentage: 10 },
  ],
  defectsSummary: {
    totalDefects: 12,
    repairedCount: 8,
    repairCost: 4500000,
    liquidationRevenue: 1200000,
  },
  fuelSummary: {
    totalImportedLiters: 5000,
    totalDispensedLiters: 4200,
    currentTankStock: 1800,
    estimatedCost: 84000000,
  },
  stockLedger: [
    {
      variantId: "var-1",
      productName: "Bóng đèn hồng ngoại",
      variantLabel: "100W",
      unit: "bóng",
      categoryName: "Cơ điện",
      openingQty: 50,
      inQty: 100,
      outQty: 30,
      closingQty: 120,
      unitPrice: 50000,
      closingValue: 6000000,
    },
    {
      variantId: "var-2",
      productName: "Thuốc sát trùng Vikon",
      variantLabel: "Can 5L",
      unit: "can",
      categoryName: "Thú y",
      openingQty: 10,
      inQty: 20,
      outQty: 30,
      closingQty: 0,
      unitPrice: 450000,
      closingValue: 0,
    },
    {
      variantId: "var-3",
      productName: "Bao bì cám 25kg",
      variantLabel: "Loại dày",
      unit: "cái",
      categoryName: "Bao bì",
      openingQty: 200,
      inQty: 500,
      outQty: 400,
      closingQty: 300,
      unitPrice: 5000,
      closingValue: 1500000,
    },
  ],
};

describe("GeneralReportTab component", () => {
  it("renders Top KPI cards with formatted VND values", () => {
    render(<GeneralReportTab data={mockReportData} />);

    // KPI Titles
    expect(screen.getByText("Tổng giá trị kho hiện tại")).toBeDefined();
    expect(screen.getByText("Tổng tiền nhập kho")).toBeDefined();
    expect(screen.getByText("Tổng chi phí xuất dùng")).toBeDefined();
    expect(screen.getByText("Doanh thu xuất bán & thanh lý")).toBeDefined();

    // Formatted Values
    expect(screen.getByText("125.000.000 đ")).toBeDefined();
    expect(screen.getByText("45.000.000 đ")).toBeDefined();
    expect(screen.getByText("32.000.000 đ")).toBeDefined();
    expect(screen.getByText("15.000.000 đ")).toBeDefined();
  });

  it("renders category breakdown progress bars and percentages", () => {
    render(<GeneralReportTab data={mockReportData} />);

    expect(screen.getByText("Cơ cấu giá trị kho theo danh mục")).toBeDefined();

    // Category items in breakdown section
    const codienItems = screen.getAllByText("Cơ điện");
    expect(codienItems.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("75.000.000 đ")).toBeDefined();
    expect(screen.getByText("(60%)")).toBeDefined();

    const thuyItems = screen.getAllByText("Thú y");
    expect(thuyItems.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("37.500.000 đ")).toBeDefined();
    expect(screen.getByText("(30%)")).toBeDefined();

    const baobiItems = screen.getAllByText("Bao bì");
    expect(baobiItems.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("12.500.000 đ")).toBeDefined();
    expect(screen.getByText("(10%)")).toBeDefined();

    // Progress bars
    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars.length).toBe(3);
    expect(progressBars[0].getAttribute("aria-valuenow")).toBe("60");
    expect(progressBars[1].getAttribute("aria-valuenow")).toBe("30");
    expect(progressBars[2].getAttribute("aria-valuenow")).toBe("10");
  });

  it("renders subsystem summaries for defects and fuel", () => {
    render(<GeneralReportTab data={mockReportData} />);

    // Defects Summary
    expect(screen.getByText("Sự cố & Thiết bị")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText("8")).toBeDefined();
    expect(screen.getByText("4.500.000 đ")).toBeDefined();
    expect(screen.getByText("1.200.000 đ")).toBeDefined();

    // Fuel Summary
    expect(screen.getByText("Tổng hợp Kho Dầu")).toBeDefined();
    expect(screen.getByText("Nhập bồn trong kỳ")).toBeDefined();
    expect(screen.getByText("Đã cấp phát")).toBeDefined();
    expect(screen.getByText("Tồn bồn hiện tại")).toBeDefined();
    expect(screen.getByText("Ước tính chi phí dầu")).toBeDefined();
    expect(screen.getByText("84.000.000 đ")).toBeDefined();
  });

  it("renders stock ledger (XNT) table rows, out-of-stock badge, and footer totals", () => {
    render(<GeneralReportTab data={mockReportData} />);

    // Table items
    expect(screen.getByText("Bóng đèn hồng ngoại")).toBeDefined();
    expect(screen.getByText("100W")).toBeDefined();
    expect(screen.getByText("Thuốc sát trùng Vikon")).toBeDefined();
    expect(screen.getByText("Can 5L")).toBeDefined();
    expect(screen.getByText("Bao bì cám 25kg")).toBeDefined();

    // Out-of-stock badge for var-2 (closingQty === 0)
    expect(screen.getByText("Hết hàng")).toBeDefined();

    // Table Footer Total Row
    expect(screen.getByText(/Tổng cộng \(3 vật tư\):/)).toBeDefined();
    // Sum opening: 50 + 10 + 200 = 260
    expect(screen.getByText("260")).toBeDefined();
    // Sum inQty: 100 + 20 + 500 = 620
    expect(screen.getByText("+620")).toBeDefined();
    // Sum outQty: 30 + 30 + 400 = 460
    expect(screen.getByText("-460")).toBeDefined();
    // Sum closingQty: 120 + 0 + 300 = 420
    expect(screen.getByText("420")).toBeDefined();
    // Sum closingValue: 6.000.000 + 0 + 1.500.000 = 7.500.000 đ
    expect(screen.getByText("7.500.000 đ")).toBeDefined();
  });

  it("filters stock ledger rows by product name, variant label, or category", () => {
    render(<GeneralReportTab data={mockReportData} />);

    const searchInput = screen.getByLabelText("Tìm kiếm vật tư trong bảng XNT");

    // 1. Filter by product name "Bóng đèn"
    fireEvent.change(searchInput, { target: { value: "bóng đèn" } });

    expect(screen.getByText("Bóng đèn hồng ngoại")).toBeDefined();
    expect(screen.queryByText("Thuốc sát trùng Vikon")).toBeNull();
    expect(screen.queryByText("Bao bì cám 25kg")).toBeNull();
    expect(screen.getByText(/Tổng cộng \(1 vật tư\):/)).toBeDefined();
    // 6.000.000 đ exists in row and footer
    expect(screen.getAllByText("6.000.000 đ").length).toBe(2);

    // 2. Filter by variant label "Can 5L"
    fireEvent.change(searchInput, { target: { value: "Can 5L" } });

    expect(screen.queryByText("Bóng đèn hồng ngoại")).toBeNull();
    expect(screen.getByText("Thuốc sát trùng Vikon")).toBeDefined();
    expect(screen.queryByText("Bao bì cám 25kg")).toBeNull();
    expect(screen.getByText(/Tổng cộng \(1 vật tư\):/)).toBeDefined();

    // 3. Filter by category "Bao bì"
    fireEvent.change(searchInput, { target: { value: "Bao bì" } });

    expect(screen.queryByText("Bóng đèn hồng ngoại")).toBeNull();
    expect(screen.queryByText("Thuốc sát trùng Vikon")).toBeNull();
    expect(screen.getByText("Bao bì cám 25kg")).toBeDefined();

    // 4. No matching results
    fireEvent.change(searchInput, { target: { value: "Không tồn tại" } });

    expect(
      screen.getByText('Không tìm thấy vật tư nào khớp với từ khóa "Không tồn tại".')
    ).toBeDefined();
    expect(screen.queryByText(/Tổng cộng/)).toBeNull();
  });

  it("renders loading skeleton state when isLoading is true", () => {
    render(<GeneralReportTab data={null} isLoading={true} />);

    // Shouldn't show values or table rows
    expect(screen.queryByText("125.000.000 đ")).toBeNull();
    expect(screen.queryByText("Bóng đèn hồng ngoại")).toBeNull();
  });

  it("renders empty state gracefully when data is null or empty", () => {
    render(<GeneralReportTab data={null} isLoading={false} />);

    expect(screen.getAllByText("0 đ").length).toBeGreaterThan(0);
    expect(screen.getByText("Chưa có dữ liệu phân loại danh mục trong kỳ này.")).toBeDefined();
    expect(screen.getByText("Chưa có dữ liệu Xuất - Nhập - Tồn trong kỳ này.")).toBeDefined();
  });
});
