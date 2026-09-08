import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { VehicleReportTab } from "./vehicle-report-tab";
import type { VehicleReportData } from "../types";

const mockVehicleReportData: VehicleReportData = {
  totalLitersAllVehicles: 350.5,
  vehicles: [
    {
      vehicleId: "v-1",
      code: "XE-01",
      name: "Xe Tải Hyundai 2.5T",
      plate: "60C-12345",
      odoUnit: "km",
      fuelNorm: 14.0,
      totalLiters: 150.5,
      dispenseCount: 3,
      totalUsageDiff: 1000,
      avgRate: 15.05,
      normDiff: 1.05,
      isOverNorm: true,
    },
    {
      vehicleId: "v-2",
      code: "MAY-01",
      name: "Máy phát điện dự phòng 150kVA",
      plate: null,
      odoUnit: "hours",
      fuelNorm: 10.0,
      totalLiters: 120.0,
      dispenseCount: 2,
      totalUsageDiff: 15,
      avgRate: 8.0,
      normDiff: -2.0,
      isOverNorm: false,
    },
    {
      vehicleId: "v-3",
      code: "XE-02",
      name: "Xe Bán Tải Ford Ranger",
      plate: "60C-99999",
      odoUnit: "km",
      fuelNorm: null,
      totalLiters: 80.0,
      dispenseCount: 1,
      totalUsageDiff: 800,
      avgRate: 10.0,
      normDiff: null,
      isOverNorm: false,
    },
    {
      vehicleId: "v-4",
      code: "MAY-02",
      name: "Máy Bơm Nước Chữa Cháy",
      plate: null,
      odoUnit: "hours",
      fuelNorm: 5.0,
      totalLiters: 0,
      dispenseCount: 0,
      totalUsageDiff: 0,
      avgRate: null,
      normDiff: null,
      isOverNorm: false,
    },
  ],
};

describe("VehicleReportTab component", () => {
  it("renders 3 Summary KPI cards with correct data", () => {
    render(<VehicleReportTab data={mockVehicleReportData} />);

    // KPI Titles
    expect(screen.getByText("Tổng dầu đã cấp")).toBeDefined();
    expect(screen.getByText("Số phương tiện hoạt động")).toBeDefined();
    expect(screen.getByText("Phương tiện vượt định mức")).toBeDefined();

    // KPI Values
    // Total liters: 350.5 (in KPI card & table footer)
    expect(screen.getAllByText(/350,5/).length).toBeGreaterThanOrEqual(1);
    // Active count: 3 (v-1, v-2, v-3 have totalLiters > 0 / dispenseCount > 0)
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("phương tiện")).toBeDefined();
    // Over norm count: 1 (v-1 has isOverNorm === true)
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("xe cảnh báo")).toBeDefined();
  });

  it("renders table rows, metrics, and evaluation badges correctly", () => {
    render(<VehicleReportTab data={mockVehicleReportData} />);

    const table = screen.getByRole("table");
    const tableScope = within(table);

    // Table Headers
    expect(tableScope.getByText("Mã xe & Tên xe")).toBeDefined();
    expect(tableScope.getByText("Biển số / Model")).toBeDefined();
    expect(tableScope.getByText("ĐVT")).toBeDefined();
    expect(tableScope.getByText("Tổng lít đã cấp")).toBeDefined();
    expect(tableScope.getByText("Quãng đường / Giờ chạy")).toBeDefined();
    expect(tableScope.getByText("Tiêu hao thực tế")).toBeDefined();
    expect(tableScope.getByText("Định mức quy định")).toBeDefined();
    expect(tableScope.getByText("Chênh lệch")).toBeDefined();
    expect(tableScope.getByText("Đánh giá")).toBeDefined();

    // Row 1: Over-norm vehicle
    expect(tableScope.getByText("Xe Tải Hyundai 2.5T")).toBeDefined();
    expect(tableScope.getByText("XE-01")).toBeDefined();
    expect(tableScope.getByText("60C-12345")).toBeDefined();
    expect(tableScope.getByText("Vượt định mức")).toBeDefined();
    expect(tableScope.getByText("+1,05")).toBeDefined();

    // Row 2: Normal machine
    expect(tableScope.getByText("Máy phát điện dự phòng 150kVA")).toBeDefined();
    expect(tableScope.getByText("MAY-01")).toBeDefined();
    expect(tableScope.getByText("Bình thường")).toBeDefined();
    expect(tableScope.getByText("-2")).toBeDefined();

    // Row 3: No norm
    expect(tableScope.getByText("Xe Bán Tải Ford Ranger")).toBeDefined();
    expect(tableScope.getByText("60C-99999")).toBeDefined();

    // Row 4: Inactive machine
    expect(tableScope.getByText("Máy Bơm Nước Chữa Cháy")).toBeDefined();

    // Table Footer Total Row
    expect(tableScope.getByText(/Tổng cộng \(4 phương tiện\):/)).toBeDefined();
    // Sum total liters in footer: 350.5 Lít
    expect(tableScope.getByText("350,5 Lít")).toBeDefined();
    // Sum dispense count in footer: 3 + 2 + 1 + 0 = 6
    expect(tableScope.getByText("6 lần cấp")).toBeDefined();
  });

  it("filters vehicle rows by search input for name, code, and plate", () => {
    render(<VehicleReportTab data={mockVehicleReportData} />);

    const searchInput = screen.getByLabelText("Tìm kiếm phương tiện trong bảng báo cáo dầu");
    const table = screen.getByRole("table");

    // 1. Search by code "MAY-01"
    fireEvent.change(searchInput, { target: { value: "MAY-01" } });
    let tableScope = within(table);
    expect(tableScope.getByText("Máy phát điện dự phòng 150kVA")).toBeDefined();
    expect(tableScope.queryByText("Xe Tải Hyundai 2.5T")).toBeNull();
    expect(tableScope.getByText(/Tổng cộng \(1 phương tiện\):/)).toBeDefined();

    // 2. Search by plate "60C-99999"
    fireEvent.change(searchInput, { target: { value: "60C-99999" } });
    tableScope = within(table);
    expect(tableScope.getByText("Xe Bán Tải Ford Ranger")).toBeDefined();
    expect(tableScope.queryByText("Máy phát điện dự phòng 150kVA")).toBeNull();

    // 3. Search non-matching term
    fireEvent.change(searchInput, { target: { value: "Xe Không Có" } });
    expect(
      screen.getByText('Không tìm thấy phương tiện nào khớp với từ khóa "Xe Không Có".')
    ).toBeDefined();
    expect(screen.queryByText(/Tổng cộng/)).toBeNull();
  });

  it("renders loading skeleton state when isLoading is true", () => {
    render(<VehicleReportTab data={null} isLoading={true} />);

    expect(screen.queryByText("Tổng dầu đã cấp")).toBeDefined();
    expect(screen.queryByText("Xe Tải Hyundai 2.5T")).toBeNull();
  });

  it("renders empty state when data is null or empty", () => {
    render(<VehicleReportTab data={null} isLoading={false} />);

    expect(screen.getByText("Chưa có dữ liệu cấp dầu phương tiện trong kỳ này.")).toBeDefined();
  });
});
