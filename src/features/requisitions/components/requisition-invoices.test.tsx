import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RequisitionInvoices } from "./requisition-invoices";
import { uploadRequisitionInvoiceImage } from "../upload";
import { updateRequisitionInvoiceImages } from "../actions";

vi.mock("../upload", () => ({
  uploadRequisitionInvoiceImage: vi.fn(),
}));

vi.mock("../actions", () => ({
  updateRequisitionInvoiceImages: vi.fn(),
}));

vi.mock("@/components/image-lightbox", () => ({
  ZoomableImage: ({ src, alt }: { src: string; alt?: string }) => <img src={src} alt={alt} />,
}));

describe("RequisitionInvoices permissions & confirmation flow", () => {
  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";
  const imageByA = `http://example.com/storage/v1/object/public/requisition-images/${userA}/req-a.jpg`;
  const imageByB = `http://example.com/storage/v1/object/public/requisition-images/${userB}/req-b.jpg`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows delete button only for user's own uploaded images when logged in as manager/requester", () => {
    render(
      <RequisitionInvoices
        requisitionId="req-1"
        requisitionCode="YCCP0001"
        invoiceImages={[imageByA, imageByB]}
        status="received"
        isManager={true}
        currentUser={{ id: userA, role: "warehouse", name: "User A" }}
        requesterId={userA}
      />,
    );

    const deleteButtons = screen.getAllByRole("button", { name: /Xóa ảnh này/i });
    expect(deleteButtons).toHaveLength(1);
  });

  it("stages uploaded images without calling updateRequisitionInvoiceImages until confirmed", async () => {
    const newImage = "http://example.com/storage/v1/object/public/requisition-images/new-req.jpg";
    vi.mocked(uploadRequisitionInvoiceImage).mockResolvedValueOnce(newImage);

    render(
      <RequisitionInvoices
        requisitionId="req-1"
        requisitionCode="YCCP0001"
        invoiceImages={[imageByA]}
        status="approved"
        isManager={true}
        currentUser={{ id: userA, role: "warehouse", name: "User A" }}
        requesterId={userA}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy content"], "test.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadRequisitionInvoiceImage).toHaveBeenCalledTimes(1);
    });

    // Should NOT call updateRequisitionInvoiceImages yet!
    expect(updateRequisitionInvoiceImages).not.toHaveBeenCalled();

    // Confirm & Cancel buttons exist
    const confirmButton = screen.getByRole("button", { name: /Xác nhận lưu/i });
    const cancelButton = screen.getByRole("button", { name: /^Hủy$/i });
    expect(confirmButton).toBeDefined();
    expect(cancelButton).toBeDefined();

    // Click cancel
    fireEvent.click(cancelButton);
    expect(screen.queryByRole("button", { name: /Xác nhận lưu/i })).toBeNull();
    expect(updateRequisitionInvoiceImages).not.toHaveBeenCalled();
  });

  it("saves images to server only when clicking confirm button", async () => {
    const newImage = "http://example.com/storage/v1/object/public/requisition-images/new-req.jpg";
    vi.mocked(uploadRequisitionInvoiceImage).mockResolvedValueOnce(newImage);
    vi.mocked(updateRequisitionInvoiceImages).mockResolvedValueOnce(undefined as never);

    render(
      <RequisitionInvoices
        requisitionId="req-1"
        requisitionCode="YCCP0001"
        invoiceImages={[imageByA]}
        status="approved"
        isManager={true}
        currentUser={{ id: userA, role: "warehouse", name: "User A" }}
        requesterId={userA}
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
      expect(updateRequisitionInvoiceImages).toHaveBeenCalledWith("req-1", [imageByA, newImage]);
    });
  });
});
