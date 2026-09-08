import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { StockCardTab, type StockVariantOption } from "./stock-card-tab";
import type { StockCardData } from "../types";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const mockVariants: StockVariantOption[] = [
  {
    id: "var-1",
    productName: "Bóng đèn sưởi hồng ngoại",
    variantLabel: "150W",
    unit: "bóng",
    sku: "DEN-150W",
  },
  {
    id: "var-2",
    productName: "Dung dịch sát trùng chuồng",
    variantLabel: "Can 5L",
    unit: "can",
    sku: "SAT-5L",
  },
  {
    id: "var-3",
    productName: "Cám heo con tập ăn",
    variantLabel: "Bao 25kg",
    unit: "bao",
    sku: "CAM-25KG",
  },
];

const mockStockCardData: StockCardData = {
  variantId: "var-1",
  productName: "Bóng đèn sưởi hồng ngoại",
  variantLabel: "150W",
  unit: "bóng",
  locationName: "Kho tổng Minh Tân Phát",
  openingStock: 50,
  totalIn: 100,
  totalOut: 30,
  closingStock: 120,
  entries: [
    {
      id: "mov-1",
      createdAt: "2026-09-01T08:30:00Z",
      refType: "receipt",
      refCode: "PNK-20260901-001",
      movementType: "receipt_in",
      movementLabel: "Nhập kho NCC",
      notes: "Nhập từ NCC Rạng Đông",
      actorName: "Nguyễn Văn Quản Kho",
      inQty: 100,
      outQty: 0,
      runningBalance: 150,
    },
    {
      id: "mov-2",
      createdAt: "2026-09-03T14:15:00Z",
      refType: "requisition",
      refCode: "PXK-20260903-005",
      movementType: "requisition_out",
      movementLabel: "Xuất cấp chuồng",
      notes: "Cấp cho Chuồng Đẻ 2",
      actorName: "Trần Kỹ Thuật",
      inQty: 0,
      outQty: 20,
      runningBalance: 130,
    },
    {
      id: "mov-3",
      createdAt: "2026-09-05T09:00:00Z",
      refType: "defect",
      refCode: "PH-20260905-002",
      movementType: "defect_out",
      movementLabel: "Báo hỏng 1-1",
      notes: "Cháy bóng đổi mới",
      actorName: "Lê Giám Sát",
      inQty: 0,
      outQty: 10,
      runningBalance: 120,
    },
  ],
};

describe("StockCardTab component", () => {
  it("renders empty selection prompt when no variant is selected and data is null", () => {
    const handleSelect = vi.fn();
    render(
      <StockCardTab
        variants={mockVariants}
        data={null}
        onSelectVariant={handleSelect}
        selectedVariantId=""
      />
    );

    expect(
      screen.getByText("Vui lòng chọn một vật tư để xem sổ thẻ kho")
    ).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders variant combobox selector and triggers onSelectVariant on change", () => {
    const handleSelect = vi.fn();
    render(
      <StockCardTab
        variants={mockVariants}
        data={null}
        onSelectVariant={handleSelect}
        selectedVariantId=""
      />
    );

    const combobox = screen.getByRole("combobox");
    expect(combobox).toBeDefined();
    expect(
      screen.getByText("-- Chọn hoặc gõ tìm vật tư / biến thể --")
    ).toBeDefined();

    // Click to open combobox
    fireEvent.click(combobox);

    // Check formatted option text: "Tên sản phẩm - Tên biến thể (ĐVT)"
    expect(
      screen.getByText("Bóng đèn sưởi hồng ngoại - 150W (bóng)")
    ).toBeDefined();
    expect(
      screen.getByText("Dung dịch sát trùng chuồng - Can 5L (can)")
    ).toBeDefined();
    expect(
      screen.getByText("Cám heo con tập ăn - Bao 25kg (bao)")
    ).toBeDefined();

    // Select variant
    const option = screen.getByText("Dung dịch sát trùng chuồng - Can 5L (can)");
    fireEvent.click(option);
    expect(handleSelect).toHaveBeenCalledWith("var-2");
  });

  it("displays selected variant label in the combobox trigger", () => {
    render(
      <StockCardTab
        variants={mockVariants}
        data={null}
        onSelectVariant={vi.fn()}
        selectedVariantId="var-1"
      />
    );

    expect(
      screen.getByText("Bóng đèn sưởi hồng ngoại - 150W (bóng)")
    ).toBeDefined();
  });

  it("renders 4 Summary KPI cards with correct stock metrics", () => {
    const handleSelect = vi.fn();
    render(
      <StockCardTab
        variants={mockVariants}
        data={mockStockCardData}
        onSelectVariant={handleSelect}
        selectedVariantId="var-1"
      />
    );

    // KPI Card Titles
    expect(screen.getByText("Tồn đầu kỳ")).toBeDefined();
    expect(screen.getByText("Tổng nhập trong kỳ")).toBeDefined();
    expect(screen.getByText("Tổng xuất trong kỳ")).toBeDefined();
    expect(screen.getByText("Tồn cuối kỳ")).toBeDefined();

    // KPI Values
    // Opening: 50
    expect(screen.getByText("50")).toBeDefined();
    // Total in: +100 (in KPI card, row, and table footer)
    expect(screen.getAllByText("+100").length).toBeGreaterThanOrEqual(1);
    // Total out: -30 (in KPI card and table footer)
    expect(screen.getAllByText("-30").length).toBeGreaterThanOrEqual(1);
    // Closing: 120 (in KPI card and table footer)
    expect(screen.getAllByText("120").length).toBeGreaterThanOrEqual(1);
  });

  it("renders movement ledger table rows, slip codes, badges, and running balances", () => {
    const handleSelect = vi.fn();
    render(
      <StockCardTab
        variants={mockVariants}
        data={mockStockCardData}
        onSelectVariant={handleSelect}
        selectedVariantId="var-1"
      />
    );

    const table = screen.getByRole("table");
    const tableScope = within(table);

    // Table Headers
    expect(tableScope.getByText("Ngày giờ phát sinh")).toBeDefined();
    expect(tableScope.getByText("Mã chứng từ")).toBeDefined();
    expect(tableScope.getByText("Loại phát sinh")).toBeDefined();
    expect(tableScope.getByText("Diễn giải / Ghi chú")).toBeDefined();
    expect(tableScope.getByText("Số lượng Nhập (+)")).toBeDefined();
    expect(tableScope.getByText("Số lượng Xuất (-)")).toBeDefined();
    expect(tableScope.getByText("Tồn lũy kế")).toBeDefined();
    expect(tableScope.getByText("Người thực hiện")).toBeDefined();

    // Row 1: Nhập kho
    expect(tableScope.getByText("PNK-20260901-001")).toBeDefined();
    expect(tableScope.getByText("Nhập kho NCC")).toBeDefined();
    expect(tableScope.getByText("Nhập từ NCC Rạng Đông")).toBeDefined();
    expect(tableScope.getByText("Nguyễn Văn Quản Kho")).toBeDefined();
    expect(tableScope.getAllByText("+100").length).toBeGreaterThanOrEqual(1);
    expect(tableScope.getByText("150")).toBeDefined();

    // Row 2: Xuất cấp chuồng
    expect(tableScope.getByText("PXK-20260903-005")).toBeDefined();
    expect(tableScope.getByText("Xuất cấp chuồng")).toBeDefined();
    expect(tableScope.getByText("Cấp cho Chuồng Đẻ 2")).toBeDefined();
    expect(tableScope.getByText("Trần Kỹ Thuật")).toBeDefined();
    expect(tableScope.getByText("-20")).toBeDefined();
    expect(tableScope.getByText("130")).toBeDefined();

    // Row 3: Báo hỏng 1-1
    expect(tableScope.getByText("PH-20260905-002")).toBeDefined();
    expect(tableScope.getByText("Báo hỏng 1-1")).toBeDefined();
    expect(tableScope.getByText("Cháy bóng đổi mới")).toBeDefined();
    expect(tableScope.getByText("Lê Giám Sát")).toBeDefined();
    expect(tableScope.getByText("-10")).toBeDefined();
    expect(tableScope.getAllByText("120").length).toBeGreaterThanOrEqual(1);

    // Footer summary
    expect(
      tableScope.getByText(/Tổng cộng phát sinh trong kỳ \(3 giao dịch\)/)
    ).toBeDefined();
  });

  it("filters ledger rows using transaction search input", () => {
    const handleSelect = vi.fn();
    render(
      <StockCardTab
        variants={mockVariants}
        data={mockStockCardData}
        onSelectVariant={handleSelect}
        selectedVariantId="var-1"
      />
    );

    const searchInput = screen.getByLabelText("Tìm kiếm giao dịch trong thẻ kho");
    const table = screen.getByRole("table");

    // Filter by slip code "PXK"
    fireEvent.change(searchInput, { target: { value: "PXK" } });
    let tableScope = within(table);
    expect(tableScope.getByText("PXK-20260903-005")).toBeDefined();
    expect(tableScope.queryByText("PNK-20260901-001")).toBeNull();

    // Filter by note keyword "Rạng Đông"
    fireEvent.change(searchInput, { target: { value: "Rạng Đông" } });
    tableScope = within(table);
    expect(tableScope.getByText("PNK-20260901-001")).toBeDefined();
    expect(tableScope.queryByText("PXK-20260903-005")).toBeNull();

    // Non-matching term
    fireEvent.change(searchInput, { target: { value: "Không Tồn Tại" } });
    expect(
      screen.getByText('Không tìm thấy giao dịch nào khớp với từ khóa "Không Tồn Tại".')
    ).toBeDefined();
  });

  it("renders empty state when data has no ledger transactions", () => {
    const handleSelect = vi.fn();
    const emptyData: StockCardData = {
      ...mockStockCardData,
      openingStock: 25,
      totalIn: 0,
      totalOut: 0,
      closingStock: 25,
      entries: [],
    };

    render(
      <StockCardTab
        variants={mockVariants}
        data={emptyData}
        onSelectVariant={handleSelect}
        selectedVariantId="var-1"
      />
    );

    expect(
      screen.getByText("Chưa có phát sinh nhập/xuất nào cho vật tư này trong kỳ đã chọn.")
    ).toBeDefined();
  });

  it("renders skeleton loading state when isLoading is true", () => {
    const handleSelect = vi.fn();
    render(
      <StockCardTab
        variants={mockVariants}
        data={null}
        onSelectVariant={handleSelect}
        selectedVariantId="var-1"
        isLoading={true}
      />
    );

    expect(screen.getByText("Tồn đầu kỳ")).toBeDefined();
    expect(screen.queryByText("PNK-20260901-001")).toBeNull();
  });
});
