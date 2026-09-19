import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReceiptInvoices } from "./receipt-invoices";
import { uploadReceiptInvoiceImage } from "../upload";
import { updateReceiptInvoiceImages } from "../actions";

vi.mock("../upload", () => ({
  uploadReceiptInvoiceImage: vi.fn(),
}));

vi.mock("../actions", () => ({
  updateReceiptInvoiceImages: vi.fn(),
}));

vi.mock("@/components/image-lightbox", () => ({
  ZoomableImage: ({ src, alt }: { src: string; alt?: string }) => <img src={src} alt={alt} />,
}));

describe("ReceiptInvoices permissions & confirmation flow", () => {
  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";
  const imageByA = `http://example.com/storage/v1/object/public/receipt-images/${userA}/invoice-a.jpg`;
  const imageByB = `http://example.com/storage/v1/object/public/receipt-images/${userB}/invoice-b.jpg`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows delete button only for user's own uploaded images when logged in as manager", () => {
    render(
      <ReceiptInvoices
        receiptId="rc-1"
        receiptCode="GRN0001"
        invoiceImages={[imageByA, imageByB]}
        status="posted"
        isManager={true}
        currentUser={{ id: userA, role: "warehouse", name: "User A" }}
        creatorId={userA}
      />,
    );

    const deleteButtons = screen.getAllByRole("button", { name: /Xóa ảnh này/i });
    expect(deleteButtons).toHaveLength(1);
  });

  it("shows delete buttons for all images when logged in as dev/superuser", () => {
    render(
      <ReceiptInvoices
        receiptId="rc-1"
        receiptCode="GRN0001"
        invoiceImages={[imageByA, imageByB]}
        status="posted"
        isManager={true}
        currentUser={{ id: userA, role: "superuser", name: "Dev User" }}
        creatorId={userB}
      />,
    );

    const deleteButtons = screen.getAllByRole("button", { name: /Xóa ảnh này/i });
    expect(deleteButtons).toHaveLength(2);
  });

  it("hides delete buttons completely if user is not manager/dev", () => {
    render(
      <ReceiptInvoices
        receiptId="rc-1"
        receiptCode="GRN0001"
        invoiceImages={[imageByA, imageByB]}
        status="posted"
        isManager={false}
        currentUser={{ id: userA, role: "requester", name: "Requester A" }}
        creatorId={userA}
      />,
    );

    expect(screen.queryByRole("button", { name: /Xóa ảnh này/i })).toBeNull();
  });

  it("stages uploaded images without calling updateReceiptInvoiceImages until confirmed", async () => {
    const newImage = "http://example.com/storage/v1/object/public/receipt-images/new-invoice.jpg";
    vi.mocked(uploadReceiptInvoiceImage).mockResolvedValueOnce(newImage);

    render(
      <ReceiptInvoices
        receiptId="rc-1"
        receiptCode="GRN0001"
        invoiceImages={[imageByA]}
        status="posted"
        isManager={true}
        currentUser={{ id: userA, role: "warehouse", name: "User A" }}
        creatorId={userA}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy content"], "test.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadReceiptInvoiceImage).toHaveBeenCalledTimes(1);
    });

    // Should NOT call updateReceiptInvoiceImages yet!
    expect(updateReceiptInvoiceImages).not.toHaveBeenCalled();

    // Should show confirm and cancel buttons
    const confirmButton = screen.getByRole("button", { name: /Xác nhận lưu/i });
    const cancelButton = screen.getByRole("button", { name: /^Hủy$/i });
    expect(confirmButton).toBeDefined();
    expect(cancelButton).toBeDefined();

    // Click cancel
    fireEvent.click(cancelButton);
    expect(screen.queryByRole("button", { name: /Xác nhận lưu/i })).toBeNull();
    expect(updateReceiptInvoiceImages).not.toHaveBeenCalled();
  });

  it("saves images to server only when clicking confirm button", async () => {
    const newImage = "http://example.com/storage/v1/object/public/receipt-images/new-invoice.jpg";
    vi.mocked(uploadReceiptInvoiceImage).mockResolvedValueOnce(newImage);
    vi.mocked(updateReceiptInvoiceImages).mockResolvedValueOnce(undefined as never);

    render(
      <ReceiptInvoices
        receiptId="rc-1"
        receiptCode="GRN0001"
        invoiceImages={[imageByA]}
        status="posted"
        isManager={true}
        currentUser={{ id: userA, role: "warehouse", name: "User A" }}
        creatorId={userA}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy content"], "test.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Xác nhận lưu/i })).toBeDefined();
    });

    const confirmButton = screen.getByRole("button", { name: /Xác nhận lưu/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(updateReceiptInvoiceImages).toHaveBeenCalledWith("rc-1", [imageByA, newImage]);
    });
  });
});
