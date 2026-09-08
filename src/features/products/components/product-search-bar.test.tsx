import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProductSearchBar } from "./product-search-bar";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    })),
  })),
}));

describe("ProductSearchBar", () => {
  it("renders search input, submit button, and scan button", () => {
    render(<ProductSearchBar defaultValue="dây điện" categoryId="cat-1" />);

    const input = screen.getByPlaceholderText("Tìm vật tư…") as HTMLInputElement;
    expect(input.value).toBe("dây điện");

    expect(screen.getByRole("button", { name: /Tìm/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Quét mã QR/i })).toBeInTheDocument();
  });

  it("opens scanner dialog when clicking scan button", () => {
    render(<ProductSearchBar />);

    const scanBtn = screen.getByRole("button", { name: /Quét mã QR/i });
    fireEvent.click(scanBtn);

    expect(screen.getByText("Quét mã QR / Barcode Vật tư")).toBeInTheDocument();
  });
});
