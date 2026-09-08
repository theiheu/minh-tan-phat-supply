import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ZoneCostReportTab } from "./zone-cost-report-tab";
import type { ZoneCostReportData } from "../types";

const mockZoneCostData: ZoneCostReportData = {
  grandTotalCost: 75000000,
  zones: [
    {
      zoneId: "zone-1",
      zoneName: "Chuồng Đẻ 3",
      totalCost: 45000000,
      percentage: 60,
      issueCount: 8,
      defectCount: 3,
      items: [
        {
          productName: "Bóng đèn sưởi hồng ngoại",
          variantLabel: "150W",
          unit: "bóng",
          quantity: 50,
          unitPrice: 600000,
          totalAmount: 30000000,
        },
        {
          productName: "Dung dịch sát trùng chuồng",
          variantLabel: "Can 5L",
          unit: "can",
          quantity: 30,
          unitPrice: 500000,
          totalAmount: 15000000,
        },
      ],
    },
    {
      zoneId: "zone-2",
      zoneName: "Chuồng Hậu Bị 1",
      totalCost: 20000000,
      percentage: 26.67,
      issueCount: 4,
      defectCount: 1,
      items: [
        {
          productName: "Núm uống tự động",
          variantLabel: "Inox 304",
          unit: "cái",
          quantity: 100,
          unitPrice: 200000,
          totalAmount: 20000000,
        },
      ],
    },
    {
      zoneId: "zone-3",
      zoneName: "Khu Xử Lý Nước Thải",
      totalCost: 10000000,
      percentage: 13.33,
      issueCount: 2,
      defectCount: 0,
      items: [
        {
          productName: "Hóa chất PAC khử trùng",
          variantLabel: "Bao 25kg",
          unit: "bao",
          quantity: 20,
          unitPrice: 500000,
          totalAmount: 10000000,
        },
      ],
    },
  ],
};

describe("ZoneCostReportTab component", () => {
  it("renders 3 Summary KPI cards with correct data", () => {
    render(<ZoneCostReportTab data={mockZoneCostData} />);

    // KPI Titles
    expect(screen.getByText("Tổng chi phí vật tư toàn trại")).toBeDefined();
    expect(screen.getByText("Khu chuồng chi phí cao nhất")).toBeDefined();
    expect(screen.getByText("Số khu vực phát sinh chi phí")).toBeDefined();

    // KPI Values
    expect(screen.getAllByText("75.000.000 đ").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Chuồng Đẻ 3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/45\.000\.000 đ/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("(60%)")).toBeDefined();
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("khu vực")).toBeDefined();
  });

  it("renders table rows, progress bars, and footer totals", () => {
    render(<ZoneCostReportTab data={mockZoneCostData} />);

    const table = screen.getByRole("table");
    const tableScope = within(table);

    // Check table headers
    expect(tableScope.getByText("Tên khu vực / Chuồng trại")).toBeDefined();
    expect(tableScope.getByText("Tổng chi phí vật tư")).toBeDefined();
    expect(tableScope.getByText("Tỷ trọng (%)")).toBeDefined();
    expect(tableScope.getByText("Số phiếu xuất cấp")).toBeDefined();
    expect(tableScope.getByText("Số lần báo hỏng (1-1)")).toBeDefined();

    // Check table row items
    expect(tableScope.getByText("Chuồng Đẻ 3")).toBeDefined();
    expect(tableScope.getByText("Chuồng Hậu Bị 1")).toBeDefined();
    expect(tableScope.getByText("Khu Xử Lý Nước Thải")).toBeDefined();

    // Check costs in table
    expect(tableScope.getByText("45.000.000 đ")).toBeDefined();
    expect(tableScope.getByText("20.000.000 đ")).toBeDefined();
    expect(tableScope.getByText("10.000.000 đ")).toBeDefined();

    // Progress bars
    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars.length).toBe(3);
    expect(progressBars[0].getAttribute("aria-valuenow")).toBe("60");
    expect(progressBars[1].getAttribute("aria-valuenow")).toBe("26.67");
    expect(progressBars[2].getAttribute("aria-valuenow")).toBe("13.33");

    // Table Footer Total Row
    expect(tableScope.getByText(/Tổng cộng \(3 khu vực\):/)).toBeDefined();
    // Sum total cost: 45 + 20 + 10 = 75.000.000 đ (in KPI and footer)
    expect(screen.getAllByText("75.000.000 đ").length).toBe(2);
    // Sum issues: 8 + 4 + 2 = 14
    expect(tableScope.getByText("14")).toBeDefined();
    // Sum defects: 3 + 1 + 0 = 4 (appears in row 2 issueCount as well as footer defectCount)
    expect(tableScope.getAllByText("4").length).toBe(2);
  });

  it("filters zone rows by search term and updates totals", () => {
    render(<ZoneCostReportTab data={mockZoneCostData} />);

    const searchInput = screen.getByLabelText("Tìm kiếm khu vực trong bảng chi phí chuồng");
    const table = screen.getByRole("table");

    // Filter by "Hậu Bị"
    fireEvent.change(searchInput, { target: { value: "Hậu Bị" } });

    const tableScope = within(table);
    expect(tableScope.getByText("Chuồng Hậu Bị 1")).toBeDefined();
    expect(tableScope.queryByText("Chuồng Đẻ 3")).toBeNull();
    expect(tableScope.queryByText("Khu Xử Lý Nước Thải")).toBeNull();

    // Footer updates for 1 zone
    expect(tableScope.getByText(/Tổng cộng \(1 khu vực\):/)).toBeDefined();

    // Non-matching filter
    fireEvent.change(searchInput, { target: { value: "Không tồn tại" } });
    expect(
      screen.getByText('Không tìm thấy khu vực nào khớp với từ khóa "Không tồn tại".')
    ).toBeDefined();
    expect(screen.queryByText(/Tổng cộng/)).toBeNull();
  });

  it("opens drill-down dialog when clicking 'Chi tiết vật tư' button", () => {
    render(<ZoneCostReportTab data={mockZoneCostData} />);

    // Click "Chi tiết vật tư" for Chuồng Đẻ 3
    const detailBtn = screen.getByLabelText("Xem chi tiết vật tư Chuồng Đẻ 3");
    fireEvent.click(detailBtn);

    const dialog = screen.getByRole("dialog");
    const dialogScope = within(dialog);

    // Dialog Title
    expect(
      dialogScope.getByText("Chi tiết vật tư đã cấp cho: Chuồng Đẻ 3")
    ).toBeDefined();

    // Dialog Summary
    expect(dialogScope.getByText("Chiếm 60% tổng chi phí toàn trại")).toBeDefined();
    expect(dialogScope.getByText("8")).toBeDefined();
    expect(dialogScope.getByText("lượt xuất cấp vật tư")).toBeDefined();
    expect(dialogScope.getByText("3")).toBeDefined();
    expect(dialogScope.getByText("phiếu sự cố thiết bị")).toBeDefined();

    // Dialog Items Table
    expect(dialogScope.getByText("Bóng đèn sưởi hồng ngoại")).toBeDefined();
    expect(dialogScope.getByText("150W")).toBeDefined();
    expect(dialogScope.getByText("50")).toBeDefined();
    expect(dialogScope.getByText("600.000 đ")).toBeDefined();
    expect(dialogScope.getByText("30.000.000 đ")).toBeDefined();

    expect(dialogScope.getByText("Dung dịch sát trùng chuồng")).toBeDefined();
    expect(dialogScope.getByText("Can 5L")).toBeDefined();
    expect(dialogScope.getByText("30")).toBeDefined();
    expect(dialogScope.getByText("500.000 đ")).toBeDefined();
    expect(dialogScope.getByText("15.000.000 đ")).toBeDefined();

    // Dialog Total Quantity & Amount Footer
    expect(dialogScope.getByText(/Tổng cộng \(2 mặt hàng\):/)).toBeDefined();
    expect(dialogScope.getByText("80")).toBeDefined(); // 50 + 30
  });

  it("renders loading skeleton state when isLoading is true", () => {
    render(<ZoneCostReportTab data={null} isLoading={true} />);

    expect(screen.queryByText("75.000.000 đ")).toBeNull();
    expect(screen.queryByText("Chuồng Đẻ 3")).toBeNull();
  });

  it("renders empty state gracefully when data is null or empty", () => {
    render(<ZoneCostReportTab data={null} isLoading={false} />);

    expect(screen.getAllByText("0 đ").length).toBeGreaterThan(0);
    expect(screen.getByText("Không có dữ liệu")).toBeDefined();
    expect(screen.getByText("Chưa có dữ liệu chi phí khu vực trong kỳ này.")).toBeDefined();
  });
});
