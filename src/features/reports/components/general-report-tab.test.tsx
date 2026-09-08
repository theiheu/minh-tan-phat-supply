import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
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
  stockLedger: [],
};

describe("GeneralReportTab component", () => {
  it("renders Top KPI cards with formatted VND values", () => {
    render(<GeneralReportTab data={mockReportData} />);

    // KPI Titles
    expect(screen.getByText("Tổng giá trị kho hiện tại")).toBeDefined();
    expect(screen.getByText("Tổng nhập kho trong kỳ")).toBeDefined();
    expect(screen.getByText("Tổng chi phí xuất dùng")).toBeDefined();
    expect(screen.getByText("Doanh thu bán & thanh lý")).toBeDefined();

    // Formatted Values
    expect(screen.getByText("125.000.000 đ")).toBeDefined();
    expect(screen.getByText("45.000.000 đ")).toBeDefined();
    expect(screen.getByText("32.000.000 đ")).toBeDefined();
    expect(screen.getByText("15.000.000 đ")).toBeDefined();
  });

  it("renders category breakdown progress bars and percentages", () => {
    render(<GeneralReportTab data={mockReportData} />);

    expect(
      screen.getByText("Phân bổ Chi phí Vật tư theo Nhóm Danh Mục")
    ).toBeDefined();

    expect(screen.getByText("Cơ điện")).toBeDefined();
    expect(screen.getByText("75.000.000 đ")).toBeDefined();
    expect(screen.getByText("60.0%")).toBeDefined();

    expect(screen.getByText("Thú y")).toBeDefined();
    expect(screen.getByText("37.500.000 đ")).toBeDefined();
    expect(screen.getByText("30.0%")).toBeDefined();
  });

  it("renders subsystem summaries for defects and fuel", () => {
    render(<GeneralReportTab data={mockReportData} />);

    expect(
      screen.getByText("Sự cố Thiết bị & Sửa chữa / Thanh lý")
    ).toBeDefined();
    expect(screen.getByText("12 lượt")).toBeDefined();
    expect(screen.getByText("8 thiết bị")).toBeDefined();
    expect(screen.getByText("4.500.000 đ")).toBeDefined();
    expect(screen.getByText("1.200.000 đ")).toBeDefined();

    expect(screen.getByText("Tổng hợp Kho Dầu Nhiên Liệu")).toBeDefined();
    expect(screen.getByText("+5.000 Lít")).toBeDefined();
    expect(screen.getByText("-4.200 Lít")).toBeDefined();
    expect(screen.getByText("1.800 Lít")).toBeDefined();
    expect(screen.getByText("84.000.000 đ")).toBeDefined();
  });

  it("triggers onNavigateToXnt when clicking jump action", () => {
    const handleNavigate = vi.fn();
    render(
      <GeneralReportTab
        data={mockReportData}
        onNavigateToXnt={handleNavigate}
      />
    );

    const link = screen.getByText("Chuyển sang Bảng Xuất - Nhập - Tồn →");
    fireEvent.click(link);
    expect(handleNavigate).toHaveBeenCalledTimes(1);
  });

  it("renders loading skeletons when isLoading is true", () => {
    render(<GeneralReportTab data={null} isLoading={true} />);
    expect(screen.getByText("Tổng giá trị kho hiện tại")).toBeDefined();
  });
});
