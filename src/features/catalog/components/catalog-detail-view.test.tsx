import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CatalogDetailView } from "./catalog-detail-view";
import type { ProductDetailData } from "../data";
import type { CatalogUnit } from "../domain/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
}));

// Mock server actions
vi.mock("../actions", () => ({
  deleteProduct: vi.fn().mockResolvedValue(undefined),
  updateProductMeta: vi.fn().mockResolvedValue(undefined),
  archiveProduct: vi.fn().mockResolvedValue(undefined),
  changeSkuStatus: vi.fn().mockResolvedValue(undefined),
  updateSkuImages: vi.fn().mockResolvedValue(undefined),
  addSku: vi.fn().mockResolvedValue("new-sku-id"),
  updateSku: vi.fn().mockResolvedValue(undefined),
  deleteSku: vi.fn().mockResolvedValue(undefined),
  upsertTransactionUom: vi.fn().mockResolvedValue("new-uom-id"),
  updateTransactionUom: vi.fn().mockResolvedValue(undefined),
  deleteTransactionUom: vi.fn().mockResolvedValue(undefined),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CatalogDetailView", () => {
  const mockCategories = [
    { id: "cat-1", name: "Cơ kim khí" },
    { id: "cat-2", name: "Điện & Tự động hóa" },
  ];

  const mockUnits: CatalogUnit[] = [
    { id: "unit-1", code: "CAI", name: "Cái", symbol: "cái", dimension: "count", factorToReference: 1, decimalScale: 0 },
    { id: "unit-2", code: "HOP", name: "Hộp", symbol: "hộp", dimension: "count", factorToReference: 1, decimalScale: 0 },
  ];

  const mockData: ProductDetailData = {
    product: {
      id: "prod-1",
      name: "Bạc đạn SKF 6203",
      description: "Vòng bi công nghiệp tiêu chuẩn",
      categoryId: "cat-1",
      categoryName: "Cơ kim khí",
      catalogStatus: "active",
      images: ["https://example.com/bearing.jpg"],
      searchKeywords: ["bạc đạn", "skf", "6203"],
      internalNotes: "Hàng nhập khẩu chính hãng",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
    skus: [
      {
        id: "sku-1",
        skuCode: "BD-SKF-6203-2RS",
        skuStatus: "active",
        baseUnitId: "unit-1",
        baseUnitSymbol: "cái",
        baseUnitName: "Cái",
        inventoryPolicy: "normal",
        trackingPolicy: "none",
        allowFraction: false,
        images: ["https://example.com/bearing-2rs.jpg"],
        isDefault: true,
        minStock: 10,
        price: 45000,
        stockOnHand: 50,
        stockReserved: 5,
        stockAvailable: 45,
        attributes: [
          {
            attributeDefinitionId: "attr-1",
            attributeName: "Hãng sản xuất",
            dataType: "text",
            optionValueId: null,
            textValue: "SKF",
            numericValue: null,
            unitId: null,
            unitSymbol: null,
            booleanValue: null,
            legacyTextValue: "SKF",
          },
          {
            attributeDefinitionId: "attr-2",
            attributeName: "Loại nắp",
            dataType: "text",
            optionValueId: null,
            textValue: "2RS",
            numericValue: null,
            unitId: null,
            unitSymbol: null,
            booleanValue: null,
            legacyTextValue: "2RS",
          },
        ],
        transactionUoms: [
          {
            id: "uom-base-1",
            skuId: "sku-1",
            unitId: "unit-1",
            code: "BASE",
            displayName: "Đơn vị chuẩn",
            factorToBase: 1,
            allowReceipt: true,
            allowIssue: true,
            allowFraction: false,
            isBase: true,
            barcode: null,
            label: "Cái (×1 cái)",
          },
          {
            id: "uom-box-1",
            skuId: "sku-1",
            unitId: "unit-2",
            code: "HOP10",
            displayName: "Hộp 10 cái",
            factorToBase: 10,
            allowReceipt: true,
            allowIssue: true,
            allowFraction: false,
            isBase: false,
            barcode: "893500123456",
            label: "Hộp 10 cái (×10 cái)",
          },
        ],
      },
    ],
    stockByLocation: [
      {
        skuId: "sku-1",
        skuCode: "BD-SKF-6203-2RS",
        locationId: "loc-1",
        locationCode: "KHO-TONG",
        locationName: "Kho Tổng",
        quantity: 50,
        reservedQuantity: 5,
        availableQuantity: 45,
        unitSymbol: "cái",
      },
    ],
    bomItems: [],
    auditLogs: [],
  };

  it("renders overview tab with product information and allows editing general info", () => {
    render(<CatalogDetailView data={mockData} categories={mockCategories} units={mockUnits} />);

    expect(screen.getByDisplayValue("Bạc đạn SKF 6203")).toBeDefined();
    expect(screen.getByDisplayValue("bạc đạn, skf, 6203")).toBeDefined();
    expect(screen.getByDisplayValue("Vòng bi công nghiệp tiêu chuẩn")).toBeDefined();
    expect(screen.getByDisplayValue("Hàng nhập khẩu chính hãng")).toBeDefined();

    const saveBtn = screen.getByRole("button", { name: /Lưu thay đổi/i });
    expect(saveBtn).toBeDefined();
  });

  it("renders tabs triggers for Overview, SKUs, UOMs, Stock, Logs", () => {
    render(<CatalogDetailView data={mockData} categories={mockCategories} units={mockUnits} />);

    expect(screen.getByRole("tab", { name: /Tổng quan/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Danh sách SKU/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Đơn vị & Quy đổi/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Tồn kho theo vị trí/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Nhật ký thay đổi/i })).toBeDefined();
  });

  it("handles deleting product with confirmation and redirects to admin products", async () => {
    const { deleteProduct } = await import("../actions");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<CatalogDetailView data={mockData} categories={mockCategories} units={mockUnits} />);

    const deleteBtn = screen.getByRole("button", { name: /Xóa vật tư/i });
    expect(deleteBtn).toBeDefined();

    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bạn có chắc chắn muốn xóa vật tư "Bạc đạn SKF 6203"?')
    );
    expect(deleteProduct).toHaveBeenCalledWith("prod-1");

    confirmSpy.mockRestore();
  });

  it("does not delete product if confirmation is cancelled", async () => {
    const { deleteProduct } = await import("../actions");
    vi.mocked(deleteProduct).mockClear();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<CatalogDetailView data={mockData} categories={mockCategories} units={mockUnits} />);

    const deleteBtn = screen.getByRole("button", { name: /Xóa vật tư/i });
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteProduct).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
