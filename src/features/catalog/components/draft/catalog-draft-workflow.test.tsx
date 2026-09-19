import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CatalogDraftWorkflow } from "./catalog-draft-workflow";
import type { CatalogUnit } from "../../domain/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
}));

vi.mock("../../actions", () => ({
  createCompleteProduct: vi.fn().mockResolvedValue("mock-product-id"),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CatalogDraftWorkflow Unit Selection & Creation", () => {
  const mockCategories = [
    { id: "cat-1", name: "Cơ kim khí" },
    { id: "cat-2", name: "Điện & Tự động hóa" },
  ];

  const mockUnits: CatalogUnit[] = [
    { id: "unit-cai", code: "cai", name: "Cái", symbol: "cái", dimension: "count", factorToReference: 1, decimalScale: 0 },
    { id: "unit-bo", code: "bo", name: "Bộ", symbol: "bộ", dimension: "count", factorToReference: 1, decimalScale: 0 },
    { id: "unit-hop", code: "hop", name: "Hộp", symbol: "hộp", dimension: "package", factorToReference: 1, decimalScale: 0 },
    { id: "unit-thung", code: "thung", name: "Thùng", symbol: "thùng", dimension: "package", factorToReference: 1, decimalScale: 0 },
    { id: "unit-kg", code: "kg", name: "Kg", symbol: "kg", dimension: "mass", factorToReference: 1, decimalScale: 3 },
  ];

  const initialDraft = {
    id: "",
    revision: 1,
    payload: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Step 1 (Thông tin cơ bản) and allows moving to Step 2 when name is filled", () => {
    render(
      <CatalogDraftWorkflow
        initialDraft={initialDraft}
        units={mockUnits}
        categories={mockCategories}
      />
    );

    expect(screen.getByText("1. Thông tin cơ bản")).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Tên vật tư/i);
    fireEvent.change(nameInput, { target: { value: "Bạc đạn SKF 6203" } });

    const nextBtn = screen.getByRole("button", { name: /Tiếp tục/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/2. Định nghĩa SKU & Cấu trúc Quy cách/i)).toBeInTheDocument();
  });

  it("allows selecting base unit in Single SKU mode via quick suggestion chips", () => {
    render(
      <CatalogDraftWorkflow
        initialDraft={initialDraft}
        units={mockUnits}
        categories={mockCategories}
      />
    );

    // Step 1 -> Step 2
    fireEvent.change(screen.getByLabelText(/Tên vật tư/i), { target: { value: "Bạc đạn SKF 6203" } });
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Single SKU is default
    expect(screen.getByText("Vật tư đơn nhất (1 SKU duy nhất)")).toBeInTheDocument();

    // Click quick chip "Cái"
    const caiChip = screen.getByRole("button", { name: "Cái" });
    fireEvent.click(caiChip);

    // Click Tiếp tục to Step 3 (BOM)
    const nextBtn = screen.getByRole("button", { name: /Tiếp tục/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/3. Khai báo Bộ lắp ráp/i)).toBeInTheDocument();
  });

  it("handles Multi-SKU mode unit default and quick toolbar", () => {
    render(
      <CatalogDraftWorkflow
        initialDraft={initialDraft}
        units={mockUnits}
        categories={mockCategories}
      />
    );

    // Step 1 -> Step 2
    fireEvent.change(screen.getByLabelText(/Tên vật tư/i), { target: { value: "Bạc đạn đa quy cách" } });
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Switch to Multi-SKU
    const multiSkuBtn = screen.getByText("Nhiều quy cách / Biến thể đa tầng (Multi-SKU)");
    fireEvent.click(multiSkuBtn);

    expect(screen.getByText(/Danh sách biến thể/i)).toBeInTheDocument();
    expect(screen.getByText("ĐVT chung:")).toBeInTheDocument();
  });

  it("allows navigating through all steps to complete material creation", async () => {
    const { createCompleteProduct } = await import("../../actions");

    render(
      <CatalogDraftWorkflow
        initialDraft={initialDraft}
        units={mockUnits}
        categories={mockCategories}
      />
    );

    // Step 1: Info
    fireEvent.change(screen.getByLabelText(/Tên vật tư/i), { target: { value: "Đèn sưởi hồng ngoại 250W" } });
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Step 2: SKU (Single)
    const caiChip = screen.getByRole("button", { name: "Cái" });
    fireEvent.click(caiChip);
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Step 3: BOM (Normal material - skip)
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Step 4: UOM (Add quick packaging unit Thùng)
    expect(screen.getByText("4. Đơn vị & Quy đổi")).toBeInTheDocument();
    const thungChip = screen.getByRole("button", { name: "+ Thùng" });
    fireEvent.click(thungChip);

    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Step 5: Review & Activate
    expect(screen.getByText(/5. Rà soát thông tin & Hoàn tất/i)).toBeInTheDocument();
    const activateBtn = screen.getByRole("button", { name: /Tạo & Kích hoạt vật tư/i });
    fireEvent.click(activateBtn);

    await waitFor(() => {
      expect(createCompleteProduct).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/admin/products");
    });
  });
});
