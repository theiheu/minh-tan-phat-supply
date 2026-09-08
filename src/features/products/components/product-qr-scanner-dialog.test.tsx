import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProductQrScannerDialog } from "./product-qr-scanner-dialog";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ProductQrScannerDialog", () => {
  const pushMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      push: pushMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders scanner dialog with manual code input when open", () => {
    render(<ProductQrScannerDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Quét mã QR / Barcode Vật tư")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Nhập mã tem / SKU thủ công..."),
    ).toBeInTheDocument();
  });

  it("handles manual code submission and displays QuickAddBottomSheet when variant is found", async () => {
    const validUuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: validUuid,
        product_id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
        unit: "cái",
        price: 150000,
        min_stock: 2,
        is_default: true,
        is_trackable_lot: false,
        attributes: {},
        images: [],
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        products: { id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22", name: "Kìm bấm cos", image_url: "https://example.com/kim.jpg" },
      },
    });

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { quantity: 8 },
    });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "variants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockSingle,
              }),
            }),
          };
        }
        if (table === "variant_stock") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: mockMaybeSingle,
              }),
            }),
          };
        }
        return {};
      }),
    };

    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    render(<ProductQrScannerDialog open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("Nhập mã tem / SKU thủ công...");
    fireEvent.change(input, { target: { value: `MTP:VAR:${validUuid}` } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Kìm bấm cos")).toBeInTheDocument();
    });

    expect(screen.getByText("ĐVT: cái")).toBeInTheDocument();
    expect(screen.getByText("Tồn: 8 cái")).toBeInTheDocument();
  });

  it("navigates to /products?q=... when code is text query or variant not found", async () => {
    const onOpenChange = vi.fn();
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      })),
    };
    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    render(<ProductQrScannerDialog open={true} onOpenChange={onOpenChange} />);

    const input = screen.getByPlaceholderText("Nhập mã tem / SKU thủ công...");
    fireEvent.change(input, { target: { value: "Ốc vít lục giác" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/products?q=%E1%BB%90c%20v%C3%ADt%20l%E1%BB%A5c%20gi%C3%A1c");
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("triggers navigator.vibrate when variant is found", async () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });

    const validUuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "variants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: validUuid,
                    product_id: "prod-1",
                    unit: "bộ",
                    price: 200000,
                    products: { name: "Bộ dụng cụ" },
                  },
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { quantity: 5 } }),
            }),
          }),
        };
      }),
    };
    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    render(<ProductQrScannerDialog open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("Nhập mã tem / SKU thủ công...");
    fireEvent.change(input, { target: { value: validUuid } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(vibrateMock).toHaveBeenCalledWith([40, 30, 40]);
    });
  });

  it("handles camera getUserMedia error gracefully", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
      writable: true,
      configurable: true,
    });

    render(<ProductQrScannerDialog open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText("Không thể mở camera. Vui lòng cấp quyền hoặc nhập mã bên dưới."),
      ).toBeInTheDocument();
    });
  });
});
