import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AssemblyForm } from "./assembly-form";
import { DisassemblyForm } from "./disassembly-form";

// Mock SkuSelector
vi.mock("@/features/catalog/components/sku-selector", () => ({
  SkuSelector: ({ value }: { value?: string }) => (
    <div data-testid="sku-selector">{value || "Chưa chọn SKU"}</div>
  ),
}));

// Mock actions
vi.mock("../actions", () => ({
  executeAssembly: vi.fn(),
  executeDisassembly: vi.fn(),
  getSkuBomDetails: vi.fn().mockResolvedValue({
    skuId: "sku-kit-1",
    skuCode: "KIT-01",
    productName: "Bộ máy bơm nước hoàn chỉnh",
    summary: "Công suất 2HP",
    baseUnitSymbol: "bộ",
    inventoryPolicy: "stocked_assembly",
    activeVersionId: "v-1",
    selectedVersionId: "v-1",
    versions: [
      {
        id: "v-1",
        bomHeaderId: "bh-1",
        versionNumber: 1,
        status: "active",
        changeReason: "Ban đầu",
        createdAt: "2026-09-01T00:00:00Z",
      },
    ],
    items: [
      {
        id: "bi-1",
        componentSkuId: "sku-comp-1",
        componentSkuCode: "COMP-01",
        componentProductName: "Đầu bơm 2HP",
        componentSummary: "",
        baseQuantity: 1,
        wastagePercent: 0,
        baseUnitSymbol: "cái",
        requiredQuantity: 1,
        availableOnHand: 10,
        isAvailable: true,
      },
      {
        id: "bi-2",
        componentSkuId: "sku-comp-2",
        componentSkuCode: "COMP-02",
        componentProductName: "Mô tơ điện",
        componentSummary: "",
        baseQuantity: 1,
        wastagePercent: 0,
        baseUnitSymbol: "cái",
        requiredQuantity: 1,
        availableOnHand: 5,
        isAvailable: true,
      },
    ],
    onHandQuantity: 2,
  }),
}));

const mockLocations = [
  { id: "loc-1", name: "Kho Tổng A", code: "KT-A" },
  { id: "loc-2", name: "Kho Phụ Tùng B", code: "KPT-B" },
];

describe("AssemblyForm Component", () => {
  it("renders initial assembly form elements", () => {
    render(<AssemblyForm locations={mockLocations} />);
    expect(screen.getByText("Thiết lập lệnh lắp ráp")).toBeInTheDocument();
    expect(screen.getByText("SKU Thành phẩm (Stocked Assembly) *")).toBeInTheDocument();
    expect(screen.getByText("Số lượng lắp ráp *")).toBeInTheDocument();
    expect(screen.getByText("Kho xuất linh kiện *")).toBeInTheDocument();
    expect(screen.getByText("Kho nhập thành phẩm *")).toBeInTheDocument();
  });
});

describe("DisassemblyForm Component", () => {
  it("renders initial disassembly form elements", () => {
    render(<DisassemblyForm locations={mockLocations} />);
    expect(screen.getByText("Thiết lập lệnh tháo dỡ")).toBeInTheDocument();
    expect(screen.getByText("SKU Bộ thành phẩm (Stocked Assembly) *")).toBeInTheDocument();
    expect(screen.getByText("Số lượng bộ cần tháo dỡ *")).toBeInTheDocument();
    expect(screen.getByText("Kho xuất bộ thành phẩm để tháo *")).toBeInTheDocument();
  });
});
