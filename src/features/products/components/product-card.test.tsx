import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProductCard } from "./product-card";
import type { Product } from "@/lib/types";
import type { VariantWithStock } from "../types";

vi.mock("../actions", () => ({
  getProductHistory: vi.fn().mockResolvedValue([]),
}));

describe("ProductCard", () => {
  const mockProduct: Product = {
    id: "prod-1",
    name: "Găng tay cao su",
    description: "Găng tay bảo hộ lao động",
    category_id: "cat-1",
    options: ["Kích cỡ"],
    images: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    deleted_at: null,
  };

  const mockVariants: VariantWithStock[] = [
    {
      id: "var-1",
      product_id: "prod-1",
      unit: "đôi",
      price: 10000,
      min_stock: 5,
      is_default: true,
      is_trackable_lot: false,
      attributes: { size: "L" },
      images: ["https://example.com/image1.jpg"],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      stock: 20,
      isComposite: false,
      components: [],
    },
  ];

  it("opens ProductDetailDialog when clicking card body", () => {
    render(<ProductCard product={mockProduct} variants={mockVariants} />);

    // Initial state: ProductDetailDialog is closed
    expect(screen.queryByRole("button", { name: "Thêm vào giỏ" })).not.toBeInTheDocument();

    // Click product title / card body
    fireEvent.click(screen.getByText("Găng tay cao su"));

    // ProductDetailDialog should open
    expect(screen.getByRole("button", { name: "Thêm vào giỏ" })).toBeInTheDocument();
  });

  it("does not open ProductDetailDialog when viewing or closing image lightbox", () => {
    render(<ProductCard product={mockProduct} variants={mockVariants} />);

    // Find the image element / gallery container
    const img = screen.getAllByAltText("Găng tay cao su")[0];
    fireEvent.click(img);

    // Lightbox should be open
    const closeBtn = screen.getByRole("button", { name: "Đóng ảnh phóng to" });
    expect(closeBtn).toBeInTheDocument();

    // ProductDetailDialog must NOT be open
    expect(screen.queryByRole("button", { name: "Thêm vào giỏ" })).not.toBeInTheDocument();

    // Close the lightbox by clicking close button
    fireEvent.click(closeBtn);

    // ProductDetailDialog must still NOT be open
    expect(screen.queryByRole("button", { name: "Thêm vào giỏ" })).not.toBeInTheDocument();
  });

  it("does not open ProductDetailDialog when closing image lightbox via backdrop click", () => {
    render(<ProductCard product={mockProduct} variants={mockVariants} />);

    const img = screen.getAllByAltText("Găng tay cao su")[0];
    fireEvent.click(img);

    const lightboxDialog = screen.getByRole("dialog", { name: "Găng tay cao su" });
    expect(lightboxDialog).toBeInTheDocument();

    // Click backdrop
    fireEvent.click(lightboxDialog);

    // ProductDetailDialog must NOT be open
    expect(screen.queryByRole("button", { name: "Thêm vào giỏ" })).not.toBeInTheDocument();
  });

  it("does not open ProductDetailDialog when closing image lightbox via Escape key", () => {
    render(<ProductCard product={mockProduct} variants={mockVariants} />);

    const img = screen.getAllByAltText("Găng tay cao su")[0];
    fireEvent.click(img);

    expect(screen.getByRole("dialog", { name: "Găng tay cao su" })).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });

    // ProductDetailDialog must NOT be open
    expect(screen.queryByRole("button", { name: "Thêm vào giỏ" })).not.toBeInTheDocument();
  });

  it("does not open ProductDetailDialog when navigating gallery images or clicking history button", async () => {
    render(<ProductCard product={mockProduct} variants={mockVariants} />);

    // Click next button in card gallery
    const nextBtn = screen.getByRole("button", { name: "Ảnh sau" });
    fireEvent.click(nextBtn);
    expect(screen.queryByRole("button", { name: "Thêm vào giỏ" })).not.toBeInTheDocument();

    // Click history button
    const historyBtn = screen.getByRole("button", { name: "Xem lịch sử cấp phát và xuất kho" });
    fireEvent.click(historyBtn);
    expect(screen.queryByRole("button", { name: "Thêm vào giỏ" })).not.toBeInTheDocument();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

