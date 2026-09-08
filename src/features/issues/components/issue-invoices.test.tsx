import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssueInvoices } from "./issue-invoices";

vi.mock("../upload", () => ({
  uploadIssueInvoiceImage: vi.fn(),
}));

vi.mock("../actions", () => ({
  updateIssueInvoiceImages: vi.fn(),
}));

vi.mock("@/components/image-lightbox", () => ({
  ZoomableImage: ({ src, alt }: { src: string; alt?: string }) => <img src={src} alt={alt} />,
}));

describe("IssueInvoices permissions", () => {
  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";
  const imageByA = `http://example.com/storage/v1/object/public/issue-images/${userA}/slip-a.jpg`;
  const imageByB = `http://example.com/storage/v1/object/public/issue-images/${userB}/slip-b.jpg`;

  it("shows delete button only for user's own uploaded images when logged in as manager", () => {
    render(
      <IssueInvoices
        issueId="iss-1"
        issueCode="PXK0001"
        invoiceImages={[imageByA, imageByB]}
        status="posted"
        currentUser={{ id: userA, role: "manager", name: "User A" }}
        creatorId={userA}
      />,
    );

    const deleteButtons = screen.getAllByRole("button", { name: /Xóa ảnh này/i });
    expect(deleteButtons).toHaveLength(1);
  });

  it("shows delete buttons for all images when logged in as dev/superuser", () => {
    render(
      <IssueInvoices
        issueId="iss-1"
        issueCode="PXK0001"
        invoiceImages={[imageByA, imageByB]}
        status="posted"
        currentUser={{ id: userA, role: "superuser", name: "Dev User" }}
        creatorId={userB}
      />,
    );

    const deleteButtons = screen.getAllByRole("button", { name: /Xóa ảnh này/i });
    expect(deleteButtons).toHaveLength(2);
  });
});
