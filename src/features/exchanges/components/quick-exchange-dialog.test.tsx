import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuickExchangeDialog } from "./quick-exchange-dialog";
import { quickEmergencyExchange } from "@/features/exchanges/actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/features/exchanges/actions", () => ({
  quickEmergencyExchange: vi.fn().mockResolvedValue({
    defect_id: "def-1",
    exchange_id: "ex-1",
    exchange_code: "DM-001",
  }),
}));

vi.mock("@/features/defects/upload", () => ({
  uploadDefectImage: vi.fn().mockResolvedValue("https://example.com/mock-image.jpg"),
}));

describe("QuickExchangeDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trigger button with emergency label", () => {
    render(<QuickExchangeDialog variants={[{ id: "v1", name: "Bóng úm", detail: "45W" }]} />);
    expect(screen.getByText(/Đổi khẩn cấp 1-1/i)).toBeInTheDocument();
  });

  it("opens dialog on trigger click and shows quick exchange fields", () => {
    render(
      <QuickExchangeDialog
        variants={[
          { id: "v1", name: "Bóng úm", detail: "45W" },
          { id: "v2", name: "Máng ăn", detail: "Inox" },
        ]}
      />,
    );

    const trigger = screen.getByText(/Đổi khẩn cấp 1-1/i);
    fireEvent.click(trigger);

    expect(screen.getByRole("heading", { name: /Đổi mới 1-1 khẩn cấp/i })).toBeInTheDocument();
    expect(screen.getByText(/Tên vật tư/i)).toBeInTheDocument();
    expect(screen.getByText(/Số lượng cần đổi/i)).toBeInTheDocument();
    expect(screen.getByText(/Mô tả lý do hỏng/i)).toBeInTheDocument();
  });

  it("handles quantity increment and decrement", () => {
    render(
      <QuickExchangeDialog
        variants={[{ id: "v1", name: "Bóng úm", detail: "45W" }]}
        defaultVariantId="v1"
      />,
    );

    fireEvent.click(screen.getByText(/Đổi khẩn cấp 1-1/i));

    const qtyInput = screen.getByDisplayValue("1") as HTMLInputElement;
    const plusBtn = screen.getByLabelText(/Tăng số lượng/i);
    const minusBtn = screen.getByLabelText(/Giảm số lượng/i);

    fireEvent.click(plusBtn);
    expect(qtyInput.value).toBe("2");

    fireEvent.click(minusBtn);
    expect(qtyInput.value).toBe("1");

    // Cannot go below 1
    fireEvent.click(minusBtn);
    expect(qtyInput.value).toBe("1");
  });

  it("submits emergency exchange successfully when fields are filled", async () => {
    render(
      <QuickExchangeDialog
        variants={[{ id: "v1", name: "Bóng úm", detail: "45W" }]}
        defaultVariantId="v1"
      />,
    );

    fireEvent.click(screen.getByText(/Đổi khẩn cấp 1-1/i));

    const damageInput = screen.getByPlaceholderText(/VD: Cháy bóng đèn úm/i);
    fireEvent.change(damageInput, { target: { value: "Bóng bị đứt dây tóc" } });

    // Upload an image via file input
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThan(0);
    const file = new File(["dummy content"], "broken.png", { type: "image/png" });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByAltText(/Ảnh hỏng khẩn cấp/i)).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole("button", { name: /Xác nhận Đổi khẩn cấp 1-1/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(quickEmergencyExchange).toHaveBeenCalledWith({
        variantId: "v1",
        quantity: 1,
        damageDetail: "Bóng bị đứt dây tóc",
        images: ["https://example.com/mock-image.jpg"],
      });
    });
  });
});

