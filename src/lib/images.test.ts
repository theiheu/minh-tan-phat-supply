import { describe, it, expect } from "vitest";
import { appAssetUrl, canDeleteInvoiceImage } from "./images";

describe("appAssetUrl", () => {
  it("converts absolute storage URL to relative", () => {
    expect(appAssetUrl("http://127.0.0.1:54321/storage/v1/object/public/receipt-images/a.jpg")).toBe(
      "/storage/v1/object/public/receipt-images/a.jpg",
    );
  });

  it("leaves relative URLs and undefined unchanged", () => {
    expect(appAssetUrl("/storage/a.jpg")).toBe("/storage/a.jpg");
    expect(appAssetUrl(undefined)).toBeUndefined();
  });
});

describe("canDeleteInvoiceImage", () => {
  const devRole = "superuser";
  const managerRole = "manager";
  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";

  it("allows dev/superuser to delete any image", () => {
    const url = `http://example.com/storage/v1/object/public/receipt-images/${userA}/invoice1.jpg`;
    expect(
      canDeleteInvoiceImage({
        imageUrl: url,
        currentUserId: userB,
        userRole: devRole,
        creatorId: userA,
      }),
    ).toBe(true);
  });

  it("allows a user to delete their own uploaded image", () => {
    const url = `http://example.com/storage/v1/object/public/receipt-images/${userA}/invoice1.jpg`;
    expect(
      canDeleteInvoiceImage({
        imageUrl: url,
        currentUserId: userA,
        userRole: managerRole,
        creatorId: userB,
      }),
    ).toBe(true);
  });

  it("prevents a user from deleting an image uploaded by another user", () => {
    const url = `http://example.com/storage/v1/object/public/receipt-images/${userA}/invoice1.jpg`;
    expect(
      canDeleteInvoiceImage({
        imageUrl: url,
        currentUserId: userB,
        userRole: managerRole,
        creatorId: userA,
      }),
    ).toBe(false);
  });

  it("allows slip creator to delete legacy images without uuid folder", () => {
    const legacyUrl = "http://example.com/storage/v1/object/public/receipt-images/invoice1.jpg";
    expect(
      canDeleteInvoiceImage({
        imageUrl: legacyUrl,
        currentUserId: userA,
        userRole: managerRole,
        creatorId: userA,
      }),
    ).toBe(true);

    expect(
      canDeleteInvoiceImage({
        imageUrl: legacyUrl,
        currentUserId: userB,
        userRole: managerRole,
        creatorId: userA,
      }),
    ).toBe(false);
  });
});
