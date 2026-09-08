import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { XntReportTab } from "./xnt-report-tab";
import type { GeneralReportData } from "../types";

const mockGeneralData: GeneralReportData = {
  totalInventoryValue: 120000000,
  totalImportValue: 50000000,
  totalIssuedCost: 35000000,
  totalSalesRevenue: 18000000,
  categoryBreakdown: [
    { categoryName: "Cơ điện & Quạt", cost: 80000000, percentage: 66.7 },
    { categoryName: "Thuốc sát trùng", cost: 40000000, percentage: 33.3 },
  ],
  defectsSummary: {
    totalDefects: 12,
    repairedCount: 8,
    repairCost: 4500000,
    liquidationRevenue: 1200000,
  },
  fuelSummary: {
    totalImportedLiters: 2000,
    totalDispensedLiters: 1500,
    currentTankStock: 500,
    estimatedCost: 30000000,
  },
  stockLedger: [
    {
      variantId: "var-1",
      productName: "Bóng đèn sưởi hồng ngoại",
      variantLabel: "150W",
      unit: "bóng",
      categoryName: "Chiếu sáng",
      openingQty: 50,
      inQty: 100,
      outQty: 30,
      closingQty: 120,
      unitPrice: 85000,
      closingValue: 10200000,
    },
    {
      variantId: "var-2",
      productName: "Dung dịch sát trùng chuồng",
      variantLabel: "Can 5L",
      unit: "can",
      categoryName: "Thuốc thú y",
      openingQty: 20,
      inQty: 10,
      outQty: 15,
      closingQty: 15,
      unitPrice: 350000,
      closingValue: 5250000,
    },
    {
      variantId: "var-3",
      productName: "Béc phun sương làm mát",
      variantLabel: "Đồng thau",
      unit: "cái",
      categoryName: "Hệ thống làm mát",
      openingQty: 10,
      inQty: 0,
      outQty: 10,
      closingQty: 0,
      unitPrice: 25000,
      closingValue: 0,
    },
  ],
};

describe("XntReportTab component", () => {
  it("renders summary quick cards with metrics", () => {
    render(<XntReportTab data={mockGeneralData} />);

    expect(screen.getByText("Tổng số mặt hàng")).toBeDefined();
    expect(screen.getByText("3 vật tư")).toBeDefined();
    expect(screen.getAllByText("+110").length).toBeGreaterThanOrEqual(1); // Total In
    expect(screen.getAllByText("-55").length).toBeGreaterThanOrEqual(1);  // Total Out
  });

  it("renders stock ledger table rows and footer totals", () => {
    render(<XntReportTab data={mockGeneralData} />);

    const table = screen.getByRole("table");
    const tableScope = within(table);

    expect(tableScope.getByText("Bóng đèn sưởi hồng ngoại")).toBeDefined();
    expect(tableScope.getByText("Dung dịch sát trùng chuồng")).toBeDefined();
    expect(tableScope.getByText("Béc phun sương làm mát")).toBeDefined();

    // Out of stock badge for 0 closingQty
    expect(tableScope.getByText("Hết hàng")).toBeDefined();

    // Footer total
    expect(tableScope.getByText("Tổng cộng (3 mặt hàng)")).toBeDefined();
  });

  it("filters stock ledger rows by search input", () => {
    render(<XntReportTab data={mockGeneralData} />);

    const searchInput = screen.getByLabelText("Tìm kiếm vật tư");
    fireEvent.change(searchInput, { target: { value: "sát trùng" } });

    const table = screen.getByRole("table");
    const tableScope = within(table);

    expect(tableScope.getByText("Dung dịch sát trùng chuồng")).toBeDefined();
    expect(tableScope.queryByText("Bóng đèn sưởi hồng ngoại")).toBeNull();
  });

  it("handles pagination when page size is exceeded", () => {
    const largeDataset: GeneralReportData = {
      ...mockGeneralData,
      stockLedger: Array.from({ length: 35 }).map((_, i) => ({
        variantId: `var-${i}`,
        productName: `Vật tư số ${i + 1}`,
        variantLabel: "Loại chuẩn",
        unit: "cái",
        categoryName: "Cơ điện",
        openingQty: 10,
        inQty: 5,
        outQty: 2,
        closingQty: 13,
        unitPrice: 10000,
        closingValue: 130000,
      })),
    };

    render(<XntReportTab data={largeDataset} />);

    // Page 1 with pageSize=20 should show items 1-20
    expect(screen.getByText("Vật tư số 1")).toBeDefined();
    expect(screen.getByText("Vật tư số 20")).toBeDefined();
    expect(screen.queryByText("Vật tư số 21")).toBeNull();

    // Next page button
    const nextBtn = screen.getByRole("button", { name: /Sau/i });
    fireEvent.click(nextBtn);

    // Page 2 shows items 21-35
    expect(screen.getByText("Vật tư số 21")).toBeDefined();
    expect(screen.getByText("Vật tư số 35")).toBeDefined();
    expect(screen.queryByText("Vật tư số 1")).toBeNull();
  });

  it("renders loading skeleton state when isLoading is true", () => {
    render(<XntReportTab data={null} isLoading={true} />);
    expect(screen.getByRole("table")).toBeDefined();
  });
});
