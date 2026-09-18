import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkuSelector } from "./sku-selector";

// Mock the tanstack query custom hook directly
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({
      data: [
        {
          skuId: "sku-1",
          productId: "prod-1",
          productName: "Bu lông",
          skuCode: "SKU-BL",
          summary: "M10 · 20mm",
          label: "Bu lông — M10 · 20mm",
          trackingPolicy: "none",
          inventoryPolicy: "normal",
          baseUnitId: "unit-1",
          baseUnitSymbol: "cái",
          transactionUoms: [],
          availableOnHand: 50,
          sku_status: "active",
        }
      ],
      isLoading: false,
    }),
  };
});

// Since Popover Content renders via Radix Portal, we need to mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
});
window.IntersectionObserver = mockIntersectionObserver;

describe("SkuSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default state when no value selected", () => {
    render(<SkuSelector onSelect={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Tìm tên, mã SKU hoặc quét mã QR...");
  });

  it("renders selected product label", () => {
    render(<SkuSelector value="sku-1" onSelect={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Bu lôngM10 · 20mm");
  });
});
