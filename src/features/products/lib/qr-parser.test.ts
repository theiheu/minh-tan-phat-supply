import { describe, it, expect } from "vitest";
import { parseProductQrText } from "./qr-parser";

describe("parseProductQrText", () => {
  it("parses raw UUID as variant_id", () => {
    const uuid = "47814b7e-9762-42da-91ef-07755efcfa77";
    const res = parseProductQrText(uuid);
    expect(res.type).toBe("variant_id");
    expect(res.value).toBe(uuid);
  });

  it("extracts variant UUID from full products url with ?variant= parameter", () => {
    const url = "https://mtp.local/products?variant=47814b7e-9762-42da-91ef-07755efcfa77";
    const res = parseProductQrText(url);
    expect(res.type).toBe("variant_id");
    expect(res.value).toBe("47814b7e-9762-42da-91ef-07755efcfa77");
  });

  it("extracts variant UUID from QR format MTP:VAR:uuid", () => {
    const text = "MTP:VAR:47814b7e-9762-42da-91ef-07755efcfa77";
    const res = parseProductQrText(text);
    expect(res.type).toBe("variant_id");
    expect(res.value).toBe("47814b7e-9762-42da-91ef-07755efcfa77");
  });

  it("treats plain barcode or SKU text as search query", () => {
    const sku = "8934567890123";
    const res = parseProductQrText(sku);
    expect(res.type).toBe("search_query");
    expect(res.value).toBe("8934567890123");
  });

  it("handles empty or whitespace strings gracefully", () => {
    const res = parseProductQrText("   ");
    expect(res.type).toBe("search_query");
    expect(res.value).toBe("");
  });

  it("extracts variant UUID from URL with path /qr/variant/<uuid>", () => {
    const url = "https://mtp.local/qr/variant/47814b7e-9762-42da-91ef-07755efcfa77";
    const res = parseProductQrText(url);
    expect(res.type).toBe("variant_id");
    expect(res.value).toBe("47814b7e-9762-42da-91ef-07755efcfa77");
  });
});
