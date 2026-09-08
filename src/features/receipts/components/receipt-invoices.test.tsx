import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReceiptInvoices } from "./receipt-invoices";

vi.mock("../upload", () => ({
  uploadReceiptInvoiceImage: vi.fn(),
}));

vi.mock("../actions", () => ({
  updateReceiptInvoiceImages: vi.fn(),
}));

vi.mock("@/components/image-lightbox", () => ({
  ZoomableImage: ({ src, alt }: { src: string; alt?: string }) => <img src={src} alt={alt} />,
}));

describe("ReceiptInvoices permissions", () => {
  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";
  const imageByA = `http://example.com/storage/v1/object/public/receipt-images/${userA}/invoice-a.jpg`;
  const imageByB = `http://example.com/storage/v1/object/public/receipt-images/${userB}/invoice-b.jpg`;

  it("shows delete button only for user's own uploaded images when logged in as manager", () => {
    render(
      <ReceiptInvoices
        receiptId="rc-1"
        receiptCode="GRN0001"
        invoiceImages={[imageByA, imageByB]}
        status="posted"
        isManager={true}
        currentUser={{ id: userA, role: "manager", name: "User A" }}
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
});
