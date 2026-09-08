import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuickAddBottomSheet } from "./quick-add-bottom-sheet";
import { useCartStore } from "@/stores/cart-store";
import type { VariantWithStock } from "../types";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("QuickAddBottomSheet", () => {
  const mockVariant: VariantWithStock = {
    id: "var-123",
    product_id: "prod-456",
    unit: "cái",
    price: 50000,
    min_stock: 5,
    is_default: true,
    is_trackable_lot: false,
    attributes: { size: "XL" },
    images: [],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    stock: 15,
    isComposite: false,
    components: [],
  };

  beforeEach(() => {
    useCartStore.getState().clear();
    vi.clearAllMocks();
  });

  it("renders product name, unit, and stock badge", () => {
    render(
      <QuickAddBottomSheet
        productName="Máy khoan pin Bosch"
        variant={mockVariant}
        image="https://example.com/drill.jpg"
      />
    );

    expect(screen.getByText("Máy khoan pin Bosch")).toBeInTheDocument();
    expect(screen.getByText("ĐVT: cái")).toBeInTheDocument();
    expect(screen.getByText("Tồn: 15 cái")).toBeInTheDocument();
  });

  it("allows incrementing and decrementing quantity (min 1)", () => {
    render(
      <QuickAddBottomSheet
        productName="Máy khoan pin Bosch"
        variant={mockVariant}
      />
    );

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.value).toBe("1");

    // Increment
    const plusBtn = input.parentElement?.querySelectorAll("button")[1];
    expect(plusBtn).toBeDefined();
    fireEvent.click(plusBtn!);
    expect(input.value).toBe("2");

    // Decrement
    const minusBtn = input.parentElement?.querySelectorAll("button")[0];
    expect(minusBtn).toBeDefined();
    fireEvent.click(minusBtn!);
    expect(input.value).toBe("1");

    // Decrement below 1 should stay at 1
    fireEvent.click(minusBtn!);
    expect(input.value).toBe("1");
  });

  it("adds item to useCartStore and displays success view", () => {
    const onAdded = vi.fn();
    render(
      <QuickAddBottomSheet
        productName="Máy khoan pin Bosch"
        variant={mockVariant}
        image="https://example.com/drill.jpg"
        onAdded={onAdded}
      />
    );

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3" } });

    const addBtn = screen.getByRole("button", { name: /Thêm vào giỏ hàng/i });
    fireEvent.click(addBtn);

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      variantId: "var-123",
      quantity: 3,
      name: "Máy khoan pin Bosch",
      label: "cái",
      unit: "cái",
      image: "https://example.com/drill.jpg",
      stock: 15,
    });

    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Đã thêm vào giỏ thành công!")).toBeInTheDocument();
  });

  it("handles continuation actions on success view", () => {
    const onContinueScan = vi.fn();
    const onGoToCart = vi.fn();

    render(
      <QuickAddBottomSheet
        productName="Máy khoan pin Bosch"
        variant={mockVariant}
        onContinueScan={onContinueScan}
        onGoToCart={onGoToCart}
      />
    );

    // Add to cart
    fireEvent.click(screen.getByRole("button", { name: /Thêm vào giỏ hàng/i }));

    const continueBtn = screen.getByRole("button", { name: /Tiếp tục quét/i });
    fireEvent.click(continueBtn);
    expect(onContinueScan).toHaveBeenCalledTimes(1);

    const cartBtn = screen.getByRole("button", { name: /Xem giỏ hàng/i });
    fireEvent.click(cartBtn);
    expect(onGoToCart).toHaveBeenCalledTimes(1);
  });
});
