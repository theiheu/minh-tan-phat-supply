import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PartnersReportTab } from "./partners-report-tab";
import type { PartnersReportData } from "../types";

const mockPartnersData: PartnersReportData = {
  suppliers: [
    {
      supplierId: "sup-1",
      supplierName: "Công ty CP Thức Ăn Chăn Nuôi CP",
      phone: "0901234567",
      receiptCount: 5,
      totalQuantity: 2500,
      totalAmount: 120000000,
    },
    {
      supplierId: "sup-2",
      supplierName: "Đại lý Thuốc Thú Y Minh Phát",
      phone: "0912345678",
      receiptCount: 3,
      totalQuantity: 150,
      totalAmount: 45000000,
    },
    {
      supplierId: "sup-3",
      supplierName: "Cơ khí Nông Nghiệp Tân Tiến",
      phone: null,
      receiptCount: 0,
      totalQuantity: 0,
      totalAmount: 0,
    },
  ],
  customers: [
    {
      customerId: "cus-1",
      customerName: "Trang trại Heo Giống Đồng Nai",
      phone: "0987654321",
      issueCount: 4,
      totalQuantity: 300,
      totalRevenue: 65000000,
    },
    {
      customerId: "cus-2",
      customerName: "Thương lái Nguyễn Văn An",
      phone: "0978123456",
      issueCount: 2,
      totalQuantity: 120,
      totalRevenue: 28000000,
    },
    {
      customerId: "cus-3",
      customerName: "Khách lẻ vãng lai",
      phone: null,
      issueCount: 0,
      totalQuantity: 0,
      totalRevenue: 0,
    },
  ],
};

describe("PartnersReportTab component", () => {
  describe("Suppliers Subtab", () => {
    it("renders Suppliers KPI cards and table by default", () => {
      render(<PartnersReportTab data={mockPartnersData} />);

      // Tab Triggers
      expect(screen.getByRole("tab", { name: /Nhà cung cấp/ })).toBeDefined();
      expect(screen.getByRole("tab", { name: /Khách hàng/ })).toBeDefined();

      // Supplier KPI titles
      expect(screen.getByText("Tổng tiền nhập từ NCC")).toBeDefined();
      expect(screen.getByText("Số NCC đã giao hàng")).toBeDefined();
      expect(screen.getByText("Tổng số đơn nhập")).toBeDefined();

      // Supplier KPI values: Total amount 120M + 45M = 165M
      expect(screen.getAllByText("165.000.000 đ").length).toBeGreaterThanOrEqual(1);
      // Active suppliers: 2 (sup-1, sup-2)
      expect(screen.getByText("2")).toBeDefined();
      expect(screen.getByText("NCC")).toBeDefined();
      // Total receipts: 5 + 3 = 8
      expect(screen.getAllByText("8").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("đơn")).toBeDefined();

      // Supplier Table Rows
      const table = screen.getByRole("table");
      const tableScope = within(table);

      expect(tableScope.getByText("Công ty CP Thức Ăn Chăn Nuôi CP")).toBeDefined();
      expect(tableScope.getByText("0901234567")).toBeDefined();
      expect(tableScope.getByText("120.000.000 đ")).toBeDefined();

      expect(tableScope.getByText("Đại lý Thuốc Thú Y Minh Phát")).toBeDefined();
      expect(tableScope.getByText("0912345678")).toBeDefined();
      expect(tableScope.getByText("45.000.000 đ")).toBeDefined();

      // Inactive supplier
      expect(tableScope.getByText("Cơ khí Nông Nghiệp Tân Tiến")).toBeDefined();

      // Supplier Table Footer
      expect(tableScope.getByText(/Tổng cộng \(3 NCC\):/)).toBeDefined();
      expect(tableScope.getByText("2.650")).toBeDefined(); // 2500 + 150
      expect(tableScope.getByText("165.000.000 đ")).toBeDefined();
    });

    it("filters suppliers by search input for name and phone", () => {
      render(<PartnersReportTab data={mockPartnersData} />);

      const searchInput = screen.getByLabelText("Tìm kiếm nhà cung cấp");
      const table = screen.getByRole("table");

      // 1. Search by name "CP"
      fireEvent.change(searchInput, { target: { value: "CP" } });
      let tableScope = within(table);
      expect(tableScope.getByText("Công ty CP Thức Ăn Chăn Nuôi CP")).toBeDefined();
      expect(tableScope.queryByText("Đại lý Thuốc Thú Y Minh Phát")).toBeNull();
      expect(tableScope.getByText(/Tổng cộng \(1 NCC\):/)).toBeDefined();

      // 2. Search by phone "0912345678"
      fireEvent.change(searchInput, { target: { value: "0912345678" } });
      tableScope = within(table);
      expect(tableScope.getByText("Đại lý Thuốc Thú Y Minh Phát")).toBeDefined();
      expect(tableScope.queryByText("Công ty CP Thức Ăn Chăn Nuôi CP")).toBeNull();

      // 3. Search non-matching
      fireEvent.change(searchInput, { target: { value: "Không Có" } });
      expect(
        screen.getByText('Không tìm thấy nhà cung cấp nào khớp với từ khóa "Không Có".')
      ).toBeDefined();
      expect(screen.queryByText(/Tổng cộng/)).toBeNull();
    });
  });

  describe("Customers Subtab", () => {
    it("switches to Customers subtab and displays KPI cards and table", () => {
      render(<PartnersReportTab data={mockPartnersData} />);

      // Switch to Customers Tab
      const customerTabTrigger = screen.getByRole("tab", { name: /Khách hàng/ });
      fireEvent.click(customerTabTrigger);

      // Customer KPI titles
      expect(screen.getByText("Tổng doanh số bán ra")).toBeDefined();
      expect(screen.getByText("Số khách hàng phát sinh")).toBeDefined();
      expect(screen.getByText("Tổng số đơn xuất bán")).toBeDefined();

      // Customer KPI values: Total revenue 65M + 28M = 93M
      expect(screen.getAllByText("93.000.000 đ").length).toBeGreaterThanOrEqual(1);
      // Active customers: 2 (cus-1, cus-2)
      expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("khách hàng")).toBeDefined();
      // Total issues: 4 + 2 = 6
      expect(screen.getAllByText("6").length).toBeGreaterThanOrEqual(1);

      // Customer Table Rows
      const customerPanel = screen.getByRole("tabpanel");
      const panelScope = within(customerPanel);

      expect(panelScope.getByText("Trang trại Heo Giống Đồng Nai")).toBeDefined();
      expect(panelScope.getByText("0987654321")).toBeDefined();
      expect(panelScope.getByText("65.000.000 đ")).toBeDefined();

      expect(panelScope.getByText("Thương lái Nguyễn Văn An")).toBeDefined();
      expect(panelScope.getByText("0978123456")).toBeDefined();
      expect(panelScope.getByText("28.000.000 đ")).toBeDefined();

      // Inactive customer
      expect(panelScope.getByText("Khách lẻ vãng lai")).toBeDefined();

      // Customer Table Footer
      expect(panelScope.getByText(/Tổng cộng \(3 khách hàng\):/)).toBeDefined();
      expect(panelScope.getByText("420")).toBeDefined(); // 300 + 120
      expect(panelScope.getAllByText("93.000.000 đ").length).toBe(2);
    });

    it("filters customers by search input for name and phone", () => {
      render(<PartnersReportTab data={mockPartnersData} />);

      // Switch to Customers Tab
      const customerTabTrigger = screen.getByRole("tab", { name: /Khách hàng/ });
      fireEvent.click(customerTabTrigger);

      const searchInput = screen.getByLabelText("Tìm kiếm khách hàng");
      const customerPanel = screen.getByRole("tabpanel");

      // 1. Search by name "Nguyễn Văn An"
      fireEvent.change(searchInput, { target: { value: "Nguyễn Văn An" } });
      let panelScope = within(customerPanel);
      expect(panelScope.getByText("Thương lái Nguyễn Văn An")).toBeDefined();
      expect(panelScope.queryByText("Trang trại Heo Giống Đồng Nai")).toBeNull();
      expect(panelScope.getByText(/Tổng cộng \(1 khách hàng\):/)).toBeDefined();

      // 2. Search by phone "0987654321"
      fireEvent.change(searchInput, { target: { value: "0987654321" } });
      panelScope = within(customerPanel);
      expect(panelScope.getByText("Trang trại Heo Giống Đồng Nai")).toBeDefined();
      expect(panelScope.queryByText("Thương lái Nguyễn Văn An")).toBeNull();

      // 3. Search non-matching
      fireEvent.change(searchInput, { target: { value: "Không Có" } });
      expect(
        screen.getByText('Không tìm thấy khách hàng nào khớp với từ khóa "Không Có".')
      ).toBeDefined();
    });
  });

  describe("Loading & Empty States", () => {
    it("renders loading skeleton state when isLoading is true", () => {
      render(<PartnersReportTab data={null} isLoading={true} />);

      expect(screen.getByText("Tổng tiền nhập từ NCC")).toBeDefined();
      expect(screen.queryByText("Công ty CP Thức Ăn Chăn Nuôi CP")).toBeNull();
    });

    it("renders empty state gracefully when data is null or empty", () => {
      render(<PartnersReportTab data={null} isLoading={false} />);

      expect(screen.getByText("Chưa có dữ liệu nhà cung cấp trong kỳ này.")).toBeDefined();

      const customerTabTrigger = screen.getByRole("tab", { name: /Khách hàng/ });
      fireEvent.click(customerTabTrigger);

      expect(screen.getByText("Chưa có dữ liệu khách hàng trong kỳ này.")).toBeDefined();
    });
  });
});
