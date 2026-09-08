import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequisitionForm } from "./requisition-form";
import { useCartStore } from "@/stores/cart-store";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("RequisitionForm", () => {
  beforeEach(() => {
    useCartStore.getState().clear();
    vi.clearAllMocks();
  });

  it("renders Quét QR button in Vật tư yêu cầu section and opens scanner dialog", () => {
    render(
      <RequisitionForm
        zones={[{ id: "z-1", name: "Khu vực A", created_at: "", updated_at: "", deleted_at: null }]}
      />
    );

    const scanBtn = screen.getByRole("button", { name: /Quét QR/i });
    expect(scanBtn).toBeInTheDocument();

    fireEvent.click(scanBtn);

    expect(screen.getByText("Quét mã QR / Barcode Vật tư")).toBeInTheDocument();
  });
});
