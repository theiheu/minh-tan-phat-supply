import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlipInvoices } from "./slip-invoices";
import type { SlipDetailPayload } from "@/features/dashboard/actions/get-slip-detail";

vi.mock("@/components/image-lightbox", () => ({
  ZoomableImage: ({ src, alt }: { src: string; alt?: string }) => <img src={src} alt={alt} />,
}));

describe("SlipInvoices component", () => {
  const userA = "11111111-1111-1111-1111-111111111111";
  const image1 = `http://example.com/storage/v1/object/public/receipt-images/${userA}/invoice-1.jpg`;
  const pendingImage1 = `http://example.com/storage/v1/object/public/receipt-images/${userA}/invoice-pending.jpg`;

  const sampleDetail: SlipDetailPayload = {
    type: "receipt",
    id: "rc-100",
    code: "PNK0001",
    status: "approved",
    createdAt: "2025-01-01T00:00:00Z",
    creatorId: userA,
    invoiceImages: [image1],
    items: [],
  };

  it("renders existing images and shows confirmation bar when there are pending images", () => {
    const onConfirmPending = vi.fn();
    const onCancelPending = vi.fn();
    const onRemovePending = vi.fn();

    render(
      <SlipInvoices
        detail={sampleDetail}
        isManager={true}
        currentUser={{ id: userA, role: "warehouse", name: "User A" }}
        pending={false}
        uploadingInvoices={false}
        pendingInvoiceImages={[pendingImage1]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onConfirmPending={onConfirmPending}
        onCancelPending={onCancelPending}
        onRemovePending={onRemovePending}
      />,
    );

    expect(screen.getByText(/1 đã lưu \+ 1 chờ xác nhận/i)).toBeDefined();
    expect(screen.getByText(/Chờ lưu/i)).toBeDefined();

    const confirmButton = screen.getByRole("button", { name: /Xác nhận lưu/i });
    const cancelButton = screen.getByRole("button", { name: /^Hủy$/i });
    expect(confirmButton).toBeDefined();
    expect(cancelButton).toBeDefined();

    fireEvent.click(confirmButton);
    expect(onConfirmPending).toHaveBeenCalledTimes(1);

    fireEvent.click(cancelButton);
    expect(onCancelPending).toHaveBeenCalledTimes(1);
  });
});
