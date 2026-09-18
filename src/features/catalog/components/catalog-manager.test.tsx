import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogManager } from "./catalog-manager";
import type { CatalogProduct } from "../domain/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("../actions", () => ({
  deleteProduct: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockProducts: CatalogProduct[] = [
  {
    id: "prod-1",
    name: "Bóng đèn sợi đốt 100W",
    description: "Đèn sưởi ấm gà con",
    categoryId: "cat-1",
    categoryName: "Điện - Điện tử",
    catalogStatus: "active",
    searchKeywords: ["den", "soi dot"],
    internalNotes: null,
    images: [],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    skus: [
      {
        id: "sku-1",
        skuCode: "BD-100W",
        productId: "prod-1",
        productName: "Bóng đèn sợi đốt 100W",
        categoryId: "cat-1",
        categoryName: "Điện - Điện tử",
        sku_status: "active",
        inventoryPolicy: "normal",
        trackingPolicy: "none",
        allowFraction: false,
        baseUnitId: "unit-1",
        baseUnit: null,
        attributes: [],
        summary: "",
        label: "Bóng đèn sợi đốt 100W",
        images: [],
        defaultImage: null,
      },
      {
        id: "sku-2",
        skuCode: "BD-200W",
        productId: "prod-1",
        productName: "Bóng đèn sợi đốt 100W",
        categoryId: "cat-1",
        categoryName: "Điện - Điện tử",
        sku_status: "active",
        inventoryPolicy: "normal",
        trackingPolicy: "none",
        allowFraction: false,
        baseUnitId: "unit-1",
        baseUnit: null,
        attributes: [],
        summary: "",
        label: "Bóng đèn sợi đốt 200W",
        images: [],
        defaultImage: null,
      },
    ],
    totalAvailable: 50,
  },
  {
    id: "prod-2",
    name: "Vòng bi bạc đạn 6203",
    description: "Bạc đạn quạt thông gió",
    categoryId: "cat-2",
    categoryName: "Vòng bi - Bạc đạn",
    catalogStatus: "draft",
    searchKeywords: ["bac dan", "6203"],
    internalNotes: null,
    images: [],
    createdAt: "2025-02-01T00:00:00Z",
    updatedAt: "2025-02-01T00:00:00Z",
    skus: [
      {
        id: "sku-3",
        skuCode: "VB-6203",
        productId: "prod-2",
        productName: "Vòng bi bạc đạn 6203",
        categoryId: "cat-2",
        categoryName: "Vòng bi - Bạc đạn",
        sku_status: "draft",
        inventoryPolicy: "normal",
        trackingPolicy: "none",
        allowFraction: false,
        baseUnitId: "unit-1",
        baseUnit: null,
        attributes: [],
        summary: "",
        label: "Vòng bi bạc đạn 6203",
        images: [],
        defaultImage: null,
      },
    ],
    totalAvailable: 10,
  },
  {
    id: "prod-3",
    name: "Cờ lê mỏ lết 12 inch",
    description: "Dụng cụ sửa chữa",
    categoryId: "cat-3",
    categoryName: "Dụng cụ - Bảo hộ",
    catalogStatus: "active",
    searchKeywords: ["co le", "mo let"],
    internalNotes: null,
    images: [],
    createdAt: "2025-03-01T00:00:00Z",
    updatedAt: "2025-03-01T00:00:00Z",
    skus: [
      {
        id: "sku-4",
        skuCode: "CL-12",
        productId: "prod-3",
        productName: "Cờ lê mỏ lết 12 inch",
        categoryId: "cat-3",
        categoryName: "Dụng cụ - Bảo hộ",
        sku_status: "active",
        inventoryPolicy: "normal",
        trackingPolicy: "none",
        allowFraction: false,
        baseUnitId: "unit-1",
        baseUnit: null,
        attributes: [],
        summary: "",
        label: "Cờ lê mỏ lết 12 inch",
        images: [],
        defaultImage: null,
      },
      {
        id: "sku-5",
        skuCode: "CL-10",
        productId: "prod-3",
        productName: "Cờ lê mỏ lết 12 inch",
        categoryId: "cat-3",
        categoryName: "Dụng cụ - Bảo hộ",
        sku_status: "active",
        inventoryPolicy: "normal",
        trackingPolicy: "none",
        allowFraction: false,
        baseUnitId: "unit-1",
        baseUnit: null,
        attributes: [],
        summary: "",
        label: "Cờ lê mỏ lết 10 inch",
        images: [],
        defaultImage: null,
      },
      {
        id: "sku-6",
        skuCode: "CL-8",
        productId: "prod-3",
        productName: "Cờ lê mỏ lết 12 inch",
        categoryId: "cat-3",
        categoryName: "Dụng cụ - Bảo hộ",
        sku_status: "active",
        inventoryPolicy: "normal",
        trackingPolicy: "none",
        allowFraction: false,
        baseUnitId: "unit-1",
        baseUnit: null,
        attributes: [],
        summary: "",
        label: "Cờ lê mỏ lết 8 inch",
        images: [],
        defaultImage: null,
      },
    ],
    totalAvailable: 100,
  },
];

const mockCategories = [
  { id: "cat-1", name: "Điện - Điện tử" },
  { id: "cat-2", name: "Vòng bi - Bạc đạn" },
  { id: "cat-3", name: "Dụng cụ - Bảo hộ" },
];

describe("CatalogManager", () => {
  it("renders separate columns for Tên vật tư and Danh mục", () => {
    const { container } = render(
      <CatalogManager
        products={mockProducts}
        categories={mockCategories}
        page={1}
        totalPages={1}
        filters={{ q: "", category: "" }}
      />
    );

    // Verify separate headers exist
    expect(screen.getByRole("button", { name: /Tên vật tư/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Danh mục/i })).toBeInTheDocument();
    expect(screen.queryByText("Tên / Danh mục")).not.toBeInTheDocument();

    // Verify product name and category appear in table cells
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);

    const firstRowCells = rows[0].querySelectorAll("td");
    // Column 0: Image, Column 1: Tên vật tư, Column 2: Danh mục
    expect(firstRowCells[1]).toHaveTextContent("Bóng đèn sợi đốt 100W");
    expect(firstRowCells[2]).toHaveTextContent("Điện - Điện tử");

    const secondRowCells = rows[1].querySelectorAll("td");
    expect(secondRowCells[1]).toHaveTextContent("Vòng bi bạc đạn 6203");
    expect(secondRowCells[2]).toHaveTextContent("Vòng bi - Bạc đạn");
  });

  it("sorts products by name alphabetically (asc/desc)", () => {
    const { container } = render(
      <CatalogManager
        products={mockProducts}
        categories={mockCategories}
        page={1}
        totalPages={1}
        filters={{ q: "", category: "" }}
      />
    );

    const sortNameBtn = screen.getByRole("button", { name: /Tên vật tư/i });

    // Click to sort asc: Bóng đèn -> Cờ lê -> Vòng bi
    fireEvent.click(sortNameBtn);
    let rows = container.querySelectorAll("tbody tr");
    expect(rows[0]).toHaveTextContent("Bóng đèn sợi đốt 100W");
    expect(rows[1]).toHaveTextContent("Cờ lê mỏ lết 12 inch");
    expect(rows[2]).toHaveTextContent("Vòng bi bạc đạn 6203");

    // Click again to sort desc: Vòng bi -> Cờ lê -> Bóng đèn
    fireEvent.click(sortNameBtn);
    rows = container.querySelectorAll("tbody tr");
    expect(rows[0]).toHaveTextContent("Vòng bi bạc đạn 6203");
    expect(rows[1]).toHaveTextContent("Cờ lê mỏ lết 12 inch");
    expect(rows[2]).toHaveTextContent("Bóng đèn sợi đốt 100W");
  });

  it("sorts products by category name (asc/desc)", () => {
    const { container } = render(
      <CatalogManager
        products={mockProducts}
        categories={mockCategories}
        page={1}
        totalPages={1}
        filters={{ q: "", category: "" }}
      />
    );

    const sortCategoryBtn = screen.getByRole("button", { name: /Danh mục/i });

    // Click to sort asc: Dụng cụ - Bảo hộ -> Điện - Điện tử -> Vòng bi - Bạc đạn
    fireEvent.click(sortCategoryBtn);
    let rows = container.querySelectorAll("tbody tr");
    expect(rows[0]).toHaveTextContent("Dụng cụ - Bảo hộ");
    expect(rows[1]).toHaveTextContent("Điện - Điện tử");
    expect(rows[2]).toHaveTextContent("Vòng bi - Bạc đạn");

    // Click again to sort desc: Vòng bi - Bạc đạn -> Điện - Điện tử -> Dụng cụ - Bảo hộ
    fireEvent.click(sortCategoryBtn);
    rows = container.querySelectorAll("tbody tr");
    expect(rows[0]).toHaveTextContent("Vòng bi - Bạc đạn");
    expect(rows[1]).toHaveTextContent("Điện - Điện tử");
    expect(rows[2]).toHaveTextContent("Dụng cụ - Bảo hộ");
  });

  it("sorts products by SKU count and available stock", () => {
    const { container } = render(
      <CatalogManager
        products={mockProducts}
        categories={mockCategories}
        page={1}
        totalPages={1}
        filters={{ q: "", category: "" }}
      />
    );

    const sortSkusBtn = screen.getByRole("button", { name: /Tổng số SKU/i });

    // Click to sort SKU count asc: 1 SKU (Vòng bi) -> 2 SKU (Bóng đèn) -> 3 SKU (Cờ lê)
    fireEvent.click(sortSkusBtn);
    let rows = container.querySelectorAll("tbody tr");
    expect(rows[0]).toHaveTextContent("1 SKU");
    expect(rows[1]).toHaveTextContent("2 SKU");
    expect(rows[2]).toHaveTextContent("3 SKU");

    const sortStockBtn = screen.getByRole("button", { name: /Tổng tồn kho khả dụng/i });

    // Click to sort stock asc: 10 -> 50 -> 100
    fireEvent.click(sortStockBtn);
    rows = container.querySelectorAll("tbody tr");
    expect(rows[0]).toHaveTextContent("Vòng bi bạc đạn 6203"); // stock 10
    expect(rows[1]).toHaveTextContent("Bóng đèn sợi đốt 100W"); // stock 50
    expect(rows[2]).toHaveTextContent("Cờ lê mỏ lết 12 inch"); // stock 100

    // Click to sort stock desc: 100 -> 50 -> 100
    fireEvent.click(sortStockBtn);
    rows = container.querySelectorAll("tbody tr");
    expect(rows[0]).toHaveTextContent("Cờ lê mỏ lết 12 inch"); // stock 100
    expect(rows[1]).toHaveTextContent("Bóng đèn sợi đốt 100W"); // stock 50
    expect(rows[2]).toHaveTextContent("Vòng bi bạc đạn 6203"); // stock 10
  });

  it("renders empty state when no products found", () => {
    render(
      <CatalogManager
        products={[]}
        categories={mockCategories}
        page={1}
        totalPages={1}
        filters={{ q: "không có", category: "" }}
      />
    );

    expect(screen.getByText("Không tìm thấy vật tư phù hợp")).toBeInTheDocument();
  });

  it("handles deleting a product with confirmation", async () => {
    const { deleteProduct } = await import("../actions");
    const { toast } = await import("sonner");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <CatalogManager
        products={mockProducts}
        categories={mockCategories}
        page={1}
        totalPages={1}
        filters={{ q: "", category: "" }}
      />
    );

    const deleteButtons = screen.getAllByRole("button", { name: /Xóa/i });
    expect(deleteButtons.length).toBe(3);

    fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bạn có chắc chắn muốn xóa vật tư "Bóng đèn sợi đốt 100W" không?')
    );
    expect(deleteProduct).toHaveBeenCalledWith("prod-1");

    confirmSpy.mockRestore();
  });

  it("does not delete product if confirmation is cancelled", async () => {
    const { deleteProduct } = await import("../actions");
    vi.mocked(deleteProduct).mockClear();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <CatalogManager
        products={mockProducts}
        categories={mockCategories}
        page={1}
        totalPages={1}
        filters={{ q: "", category: "" }}
      />
    );

    const deleteButtons = screen.getAllByRole("button", { name: /Xóa/i });
    fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteProduct).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
