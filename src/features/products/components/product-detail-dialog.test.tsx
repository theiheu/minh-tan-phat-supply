import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductDetailDialog } from "./product-detail-dialog";
import { useCartStore } from "@/stores/cart-store";
import type { Product } from "@/lib/types";
import type { VariantWithStock } from "../types";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/features/catalog/components/transaction-uom-select", () => ({
  TransactionUomSelect: () => null,
}));

describe("ProductDetailDialog", () => {
  const mockProductSingle: Product = {
    id: "prod-1",
    name: "Băng keo điện",
    description: "Băng keo cách điện nano",
    category_id: "cat-1",
    options: [],
    images: ["https://example.com/tape.jpg"],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    deleted_at: null,
  };

  const mockVariantsSingle: VariantWithStock[] = [
    {
      id: "var-single",
      product_id: "prod-1",
      unit: "cuộn",
      price: 15000,
      min_stock: 5,
      is_default: true,
      is_trackable_lot: false,
      attributes: null,
      images: ["https://example.com/tape.jpg"],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      stock: 50,
      isComposite: false,
      components: [],
    },
  ];

  // Bạc đạn có nhiều Hãng (SKF, Koyo) và cùng có mã 6203
  const mockBearingProduct: Product = {
    id: "prod-bearing",
    name: "Vòng bi / Bạc đạn công nghiệp",
    description: "Vòng bi bạc đạn máy công nghiệp",
    category_id: "cat-bearing",
    options: ["Hãng sản xuất", "Mã vòng bi", "Loại nắp"],
    images: ["https://example.com/bearing.jpg"],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    deleted_at: null,
  };

  const mockBearingVariants: VariantWithStock[] = [
    {
      id: "skf-6203-2rs",
      sku_code: "BD-SKF-6203-2RS",
      product_id: "prod-bearing",
      unit: "cái",
      price: 85000,
      min_stock: 10,
      is_default: true,
      is_trackable_lot: false,
      attributes: { "Hãng sản xuất": "SKF", "Mã vòng bi": "6203", "Loại nắp": "2RS (Cao su)" },
      images: ["https://example.com/skf-6203.jpg"],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      stock: 50,
      isComposite: false,
      components: [],
    },
    {
      id: "skf-6203-zz",
      sku_code: "BD-SKF-6203-ZZ",
      product_id: "prod-bearing",
      unit: "cái",
      price: 80000,
      min_stock: 5,
      is_default: false,
      is_trackable_lot: false,
      attributes: { "Hãng sản xuất": "SKF", "Mã vòng bi": "6203", "Loại nắp": "ZZ (Sắt)" },
      images: ["https://example.com/skf-6203-zz.jpg"],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      stock: 30,
      isComposite: false,
      components: [],
    },
    {
      id: "skf-6204-2rs",
      sku_code: "BD-SKF-6204-2RS",
      product_id: "prod-bearing",
      unit: "cái",
      price: 95000,
      min_stock: 5,
      is_default: false,
      is_trackable_lot: false,
      attributes: { "Hãng sản xuất": "SKF", "Mã vòng bi": "6204", "Loại nắp": "2RS (Cao su)" },
      images: ["https://example.com/skf-6204.jpg"],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      stock: 20,
      isComposite: false,
      components: [],
    },
    {
      id: "koyo-6203-2rs",
      sku_code: "BD-KOYO-6203-2RS",
      product_id: "prod-bearing",
      unit: "cái",
      price: 65000,
      min_stock: 10,
      is_default: false,
      is_trackable_lot: false,
      attributes: { "Hãng sản xuất": "Koyo", "Mã vòng bi": "6203", "Loại nắp": "2RS (Cao su)" },
      images: ["https://example.com/koyo-6203.jpg"],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      stock: 45,
      isComposite: false,
      components: [],
    },
    {
      id: "koyo-6203-zz",
      sku_code: "BD-KOYO-6203-ZZ",
      product_id: "prod-bearing",
      unit: "cái",
      price: 60000,
      min_stock: 5,
      is_default: false,
      is_trackable_lot: false,
      attributes: { "Hãng sản xuất": "Koyo", "Mã vòng bi": "6203", "Loại nắp": "ZZ (Sắt)" },
      images: ["https://example.com/koyo-6203-zz.jpg"],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      stock: 15,
      isComposite: false,
      components: [],
    },
  ];

  beforeEach(() => {
    useCartStore.getState().clear();
    mockPush.mockClear();
  });

  it("renders single-variant product and adds to cart", () => {
    const onOpenChange = vi.fn();
    render(
      <ProductDetailDialog
        open={true}
        onOpenChange={onOpenChange}
        product={mockProductSingle}
        variants={mockVariantsSingle}
        categoryName="Điện"
      />
    );

    expect(screen.getByText("Băng keo điện")).toBeInTheDocument();
    expect(screen.getByText("Điện")).toBeInTheDocument();
    expect(screen.queryByText("Chọn 1 quy cách")).not.toBeInTheDocument();

    const addBtn = screen.getByRole("button", { name: "Thêm vào giỏ yêu cầu" });
    fireEvent.click(addBtn);

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].skuId).toBe("var-single");
    expect(items[0].enteredQuantity).toBe(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("handles multi-tier bearing selection (SKF vs Koyo, both having 6203) without conflict", () => {
    const onOpenChange = vi.fn();
    render(
      <ProductDetailDialog
        open={true}
        onOpenChange={onOpenChange}
        product={mockBearingProduct}
        variants={mockBearingVariants}
        categoryName="Bạc đạn"
      />
    );

    // Should display all 3 axes: Hãng sản xuất, Mã vòng bi, Loại nắp
    expect(screen.getByText("Hãng sản xuất:")).toBeInTheDocument();
    expect(screen.getByText("Mã vòng bi:")).toBeInTheDocument();
    expect(screen.getByText("Loại nắp:")).toBeInTheDocument();

    // Initial selected should be SKF 6203 2RS
    expect(screen.getByText("BD-SKF-6203-2RS")).toBeInTheDocument();

    // For SKF, 6204 is available and displayed
    expect(screen.getByRole("button", { name: "6204" })).toBeInTheDocument();

    // User switches Brand to Koyo
    const koyoChip = screen.getByRole("button", { name: "Koyo" });
    fireEvent.click(koyoChip);

    // For Koyo, 6204 is not available so it is hidden completely (not rendered with strike-through)
    expect(screen.queryByRole("button", { name: "6204" })).not.toBeInTheDocument();

    // Selected should now be Koyo 6203 2RS (preserving code 6203 and cap 2RS)
    expect(screen.getByText("BD-KOYO-6203-2RS")).toBeInTheDocument();

    // User switches cap to ZZ (Sắt)
    const zzChip = screen.getByRole("button", { name: "ZZ (Sắt)" });
    fireEvent.click(zzChip);

    // Selected should now be Koyo 6203 ZZ
    expect(screen.getByText("BD-KOYO-6203-ZZ")).toBeInTheDocument();

    // Add to cart
    const addBtn = screen.getByRole("button", { name: "Thêm vào giỏ yêu cầu" });
    fireEvent.click(addBtn);

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].skuId).toBe("koyo-6203-zz");
  });

  it("groups variants by Brand (SKF, Koyo) in Batch Mode and allows multi-add across brands", () => {
    const onOpenChange = vi.fn();
    render(
      <ProductDetailDialog
        open={true}
        onOpenChange={onOpenChange}
        product={mockBearingProduct}
        variants={mockBearingVariants}
      />
    );

    // Switch to batch mode
    const batchTabBtn = screen.getByRole("button", { name: /Chọn nhiều quy cách/i });
    fireEvent.click(batchTabBtn);

    // Check brand filter pills exist
    expect(screen.getByRole("button", { name: /Tất cả/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /SKF/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Koyo/i })).toBeInTheDocument();

    // Check headers for both brands in the table
    expect(screen.getAllByText("SKF").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Koyo").length).toBeGreaterThanOrEqual(1);

    // Enter quantity for SKF 6203 2RS: 10
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "10" } }); // SKF 6203 2RS

    // Enter quantity for Koyo 6203 2RS: 5
    fireEvent.change(inputs[3], { target: { value: "5" } }); // Koyo 6203 2RS

    // Should see summary bar: 2 quy cách, 15 món
    expect(screen.getByText(/Đã chọn:/)).toBeInTheDocument();
    expect(screen.getByText(/Tổng cộng:/)).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();

    // Click batch add to cart button
    const batchAddBtn = screen.getByRole("button", { name: /Thêm 2 quy cách/i });
    fireEvent.click(batchAddBtn);

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.skuId === "skf-6203-2rs")?.enteredQuantity).toBe(10);
    expect(items.find((i) => i.skuId === "koyo-6203-2rs")?.enteredQuantity).toBe(5);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("filters by brand tab in Batch Mode", () => {
    const onOpenChange = vi.fn();
    render(
      <ProductDetailDialog
        open={true}
        onOpenChange={onOpenChange}
        product={mockBearingProduct}
        variants={mockBearingVariants}
      />
    );

    // Switch to batch mode
    fireEvent.click(screen.getByRole("button", { name: /Chọn nhiều quy cách/i }));

    // Click Koyo brand filter tab
    const koyoFilterBtn = screen.getByRole("button", { name: /Koyo/i });
    fireEvent.click(koyoFilterBtn);

    // Should only show Koyo SKUs now
    expect(screen.getByText("BD-KOYO-6203-2RS")).toBeInTheDocument();
    expect(screen.queryByText("BD-SKF-6204-2RS")).not.toBeInTheDocument();
  });

  it("displays ONLY the selected variant's images in the gallery (supporting multiple images per variant) and switches dynamically", () => {
    const multiPhotoProduct: Product = {
      id: "prod-cable",
      name: "Dây cáp điện Cadivi",
      description: "Cáp điện nhiều quy cách",
      category_id: "cat-cable",
      options: ["Quy cách lõi"],
      images: ["https://example.com/cable-default.jpg"],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      deleted_at: null,
    };

    const multiPhotoVariants: VariantWithStock[] = [
      {
        id: "cable-1.5",
        sku_code: "CADIVI-1.5",
        product_id: "prod-cable",
        unit: "cuộn",
        price: 350000,
        min_stock: 5,
        is_default: true,
        is_trackable_lot: false,
        attributes: { "Quy cách lõi": "1.5 mm²" },
        images: [
          "https://example.com/cable-1.5-photo1.jpg",
          "https://example.com/cable-1.5-photo2.jpg",
          "https://example.com/cable-1.5-photo3.jpg",
        ],
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        stock: 20,
        isComposite: false,
        components: [],
      },
      {
        id: "cable-2.5",
        sku_code: "CADIVI-2.5",
        product_id: "prod-cable",
        unit: "cuộn",
        price: 550000,
        min_stock: 5,
        is_default: false,
        is_trackable_lot: false,
        attributes: { "Quy cách lõi": "2.5 mm²" },
        images: [
          "https://example.com/cable-2.5-single-photo.jpg",
        ],
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        stock: 15,
        isComposite: false,
        components: [],
      },
      {
        id: "cable-4.0",
        sku_code: "CADIVI-4.0",
        product_id: "prod-cable",
        unit: "cuộn",
        price: 850000,
        min_stock: 5,
        is_default: false,
        is_trackable_lot: false,
        attributes: { "Quy cách lõi": "4.0 mm²" },
        images: [], // No images -> should leave empty, not taking product images
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        stock: 10,
        isComposite: false,
        components: [],
      },
    ];

    render(
      <ProductDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        product={multiPhotoProduct}
        variants={multiPhotoVariants}
      />
    );

    // Initial selected is cable-1.5 (default) which has 3 photos
    expect(screen.getAllByText(/3 ảnh/i).length).toBeGreaterThanOrEqual(1);

    // Verify images rendered in gallery: should contain 1.5's photos and NOT 2.5's photo or default
    const initialImages = screen.getAllByRole("img");
    const initialSrcs = initialImages.map((img) => img.getAttribute("src"));
    expect(initialSrcs.some((s) => s?.includes("cable-1.5-photo1.jpg"))).toBe(true);
    expect(initialSrcs.some((s) => s?.includes("cable-1.5-photo2.jpg"))).toBe(true);
    expect(initialSrcs.some((s) => s?.includes("cable-1.5-photo3.jpg"))).toBe(true);
    expect(initialSrcs.some((s) => s?.includes("cable-2.5-single-photo.jpg"))).toBe(false);

    // Switch to variant 2.5 mm²
    const chip25 = screen.getByRole("button", { name: /2.5 mm²/i });
    fireEvent.click(chip25);

    // Now gallery should ONLY have 2.5's photo
    const updatedImages = screen.getAllByRole("img");
    const updatedSrcs = updatedImages.map((img) => img.getAttribute("src"));
    expect(updatedSrcs.some((s) => s?.includes("cable-2.5-single-photo.jpg"))).toBe(true);
    expect(updatedSrcs.some((s) => s?.includes("cable-1.5-photo1.jpg"))).toBe(false);

    // Switch to variant 4.0 mm² which has no variant images
    const chip40 = screen.getByRole("button", { name: /4.0 mm²/i });
    fireEvent.click(chip40);

    // Gallery should leave empty ("Chưa có hình ảnh"), not taking main product's default image
    expect(screen.getByText(/Chưa có hình ảnh/i)).toBeInTheDocument();
    const noImages = screen.queryAllByRole("img");
    const noSrcs = noImages.map((img) => img.getAttribute("src"));
    expect(noSrcs.some((s) => s?.includes("cable-default.jpg"))).toBe(false);
  });

  it("renders 'Sửa vật tư' button when canManage is true", () => {
    render(
      <ProductDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        product={mockProductSingle}
        variants={mockVariantsSingle}
        canManage={true}
      />
    );

    const editBtn = screen.getByRole("button", { name: /Sửa vật tư/i });
    expect(editBtn).toBeDefined();
  });
});