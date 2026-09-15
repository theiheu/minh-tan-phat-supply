import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductDetailDialog } from "./product-detail-dialog";
import { useCartStore } from "@/stores/cart-store";
import type { Product } from "@/lib/types";
import type { VariantWithStock } from "../types";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ProductDetailDialog - Unit Conversion", () => {
  const mockProduct: Product = {
    id: "prod-glue",
    name: "Keo dán bạt chuồng trại",
    description: "Keo dán vá bạt che chuồng kín",
    category_id: "cat-1",
    options: ["Quy cách"],
    images: ["https://example.com/glue.jpg"],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    deleted_at: null,
  };

  const mockVariants: VariantWithStock[] = [
    {
      id: "var-box",
      product_id: "prod-glue",
      unit: "Thùng",
      price: 480000,
      min_stock: 0,
      is_default: true,
      is_trackable_lot: false,
      attributes: { "Quy cách": "1 Thùng = 6 Hộp (550ml)" },
      images: ["https://example.com/glue-box.jpg"],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      stock: 10,
      isComposite: true,
      components: [
        {
          variantId: "var-can",
          label: "550ml",
          unit: "Hộp",
          quantity: 6,
        },
      ],
    },
    {
      id: "var-can",
      product_id: "prod-glue",
      unit: "Hộp",
      price: 85000,
      min_stock: 10,
      is_default: false,
      is_trackable_lot: false,
      attributes: { "Quy cách": "550ml" },
      images: ["https://example.com/glue-can.jpg"],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      stock: 64,
      isComposite: false,
      components: [],
    },
  ];

  beforeEach(() => {
    useCartStore.getState().clear();
  });

  it("hiển thị các đơn vị quy đổi và ghi chú tự động quy đổi", () => {
    const onOpenChange = vi.fn();
    render(
      <ProductDetailDialog
        open={true}
        onOpenChange={onOpenChange}
        product={mockProduct}
        variants={mockVariants}
      />,
    );

    expect(screen.getByText("Keo dán bạt chuồng trại")).toBeInTheDocument();
    // Hiển thị radio cho Thùng và Hộp
    expect(screen.getAllByText(/Thùng = 6 Hộp/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Tồn: 10 Thùng/)).toBeInTheDocument();
    expect(screen.getByText(/Tồn: 64 Hộp/)).toBeInTheDocument();

    // Mặc định đang chọn Thùng với SL = 1 -> Ghi chú quy đổi: 1 Thùng = 6 Hộp
    expect(screen.getByText(/Quy đổi:/)).toBeInTheDocument();
    expect(screen.getAllByText(/6 Hộp/).length).toBeGreaterThanOrEqual(1);
  });

  it("tự động cập nhật số lượng quy đổi khi tăng số lượng", () => {
    const onOpenChange = vi.fn();
    render(
      <ProductDetailDialog
        open={true}
        onOpenChange={onOpenChange}
        product={mockProduct}
        variants={mockVariants}
      />,
    );

    // Bấm tăng số lượng (+)
    const plusButton = screen.getByRole("button", { name: "Tăng số lượng" });
    fireEvent.click(plusButton);

    // SL giờ là 2 Thùng -> 2 x 6 = 12 Hộp
    expect(screen.getByText(/12 Hộp/)).toBeInTheDocument();
  });

  it("thêm vào giỏ đúng đơn vị và số lượng đã chọn", () => {
    const onOpenChange = vi.fn();
    render(
      <ProductDetailDialog
        open={true}
        onOpenChange={onOpenChange}
        product={mockProduct}
        variants={mockVariants}
      />,
    );

    // Tăng số lượng lên 2 Thùng
    const plusButton = screen.getByRole("button", { name: "Tăng số lượng" });
    fireEvent.click(plusButton);

    // Bấm Thêm vào giỏ
    const addBtn = screen.getByRole("button", { name: "Thêm vào giỏ" });
    fireEvent.click(addBtn);

    const items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].variantId).toBe("var-box");
    expect(items[0].quantity).toBe(2);
    expect(items[0].unit).toBe("Thùng");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
