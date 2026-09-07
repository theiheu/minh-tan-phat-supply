import { describe, it, expect } from "vitest";
import { generateQrDataUri, getSlipUrl } from "./qr";

describe("pdf qr helpers", () => {
  it("generates a valid png data uri for a given url", async () => {
    const dataUri = await generateQrDataUri("http://localhost:3000/requisitions/123");
    expect(dataUri).toMatch(/^data:image\/png;base64,/);
  });

  it("accepts a custom output width (nhãn QR in lớn)", async () => {
    const small = await generateQrDataUri("http://localhost:3000/issues/123");
    const large = await generateQrDataUri("http://localhost:3000/issues/123", 512);
    expect(large).toMatch(/^data:image\/png;base64,/);
    // PNG 512px phải lớn hơn PNG 160px.
    expect(large.length).toBeGreaterThan(small.length);
  });

  it("extracts full slip url using request headers", () => {
    const req = new Request("http://127.0.0.1:3000/api/requisitions/123/pdf", {
      headers: {
        host: "app.minhtanphat.vn",
        "x-forwarded-proto": "https",
      },
    });

    const url = getSlipUrl(req, "/requisitions/123");
    expect(url).toBe("https://app.minhtanphat.vn/requisitions/123");
  });

  it("falls back to request url origin when headers missing", () => {
    const req = new Request("http://localhost:3001/api/receipts/456/pdf");
    const url = getSlipUrl(req, "receipts/456");
    expect(url).toBe("http://localhost:3001/receipts/456");
  });
});
