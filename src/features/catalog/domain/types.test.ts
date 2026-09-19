import { expect, it, describe } from "vitest";
import { parseDecimalQuantity, formatQuantity, computeAvailable } from "./quantity";
import { buildSkuSummary, buildSkuLabel, buildUomLabel } from "./labels";
import type { SkuAttributeValue, TransactionUom } from "./types";

describe("Decimal string manipulation", () => {
  it("parses valid positive decimals honoring the DB scale", () => {
    expect(parseDecimalQuantity("  12,50", 2)).toBe(12.5);
    expect(parseDecimalQuantity("  12.50 ", 6)).toBe(12.5);
    expect(parseDecimalQuantity("3.1415", 3)).toBe(3.142);
    // Invalid/negative
    expect(parseDecimalQuantity("-5", 0)).toBe(null);
    expect(parseDecimalQuantity("0", 6)).toBe(null);
    expect(parseDecimalQuantity("abc", 2)).toBe(null);
  });

  it("enforces scale zero exactly", () => {
    expect(parseDecimalQuantity("3", 0)).toBe(3);
    expect(parseDecimalQuantity("3.1", 0)).toBe(null);
  });

  it("formats decimal quantities cleanly", () => {
    expect(formatQuantity(12.5, 6)).toBe("12.5");
    expect(formatQuantity(12.0, 2)).toBe("12");
    expect(formatQuantity(3.14159, 2)).toBe("3.14");
    expect(formatQuantity(0.5, 0)).toBe("1"); // formatting a float with 0 scale rounds it
  });
});

describe("Availability logic", () => {
  it("computes floor(0) available quantities", () => {
    expect(computeAvailable(10, 3)).toBe(7);
    expect(computeAvailable(5, 6)).toBe(0);
    expect(computeAvailable(0, 0)).toBe(0);
  });
});

describe("Labels and summaries", () => {
  it("builds sku summaries from ordered attributes", () => {
    const attrs: SkuAttributeValue[] = [
      { attributeDefinitionId: "a", attributeName: "Hãng", dataType: "option", textValue: "Koyo", numericValue: null, booleanValue: null, optionValueId: "a", unitId: null, unitSymbol: null, legacyTextValue: null },
      { attributeDefinitionId: "b", attributeName: "Cấp độ", dataType: "number", textValue: null, numericValue: 5, booleanValue: null, optionValueId: null, unitId: null, unitSymbol: null, legacyTextValue: null },
      { attributeDefinitionId: "c", attributeName: "Điện áp", dataType: "measurement", textValue: null, numericValue: 380, booleanValue: null, optionValueId: null, unitId: "c", unitSymbol: "V", legacyTextValue: "380 V" },
      { attributeDefinitionId: "d", attributeName: "Dùng chung", dataType: "boolean", textValue: null, numericValue: null, booleanValue: true, optionValueId: null, unitId: null, unitSymbol: null, legacyTextValue: null },
    ];
    expect(buildSkuSummary(attrs)).toBe("Koyo · 5 · 380 V · Có");
  });

  it("skips blank or missing values", () => {
    expect(buildSkuSummary([])).toBe("SKU");
  });

  it("builds full sku labels", () => {
    expect(buildSkuLabel("Motor", "Koyo · 380 V")).toBe("Motor — Koyo · 380 V");
    expect(buildSkuLabel("Dây rút", "SKU")).toBe("Dây rút");
  });

  it("formats uom dropdown labels appropriately", () => {
    const base: TransactionUom = { id: "1", skuId: "1", unitId: "thung", code: "pack1", displayName: "Thùng", factorToBase: 24, allowReceipt: true, allowIssue: true, allowFraction: false, isBase: false, barcode: null, label: "" };
    expect(buildUomLabel(base, "chai")).toBe("Thùng (×24 chai)");
    
    const fractional: TransactionUom = { ...base, factorToBase: 1.5 };
    expect(buildUomLabel(fractional, "kg")).toBe("Thùng = 1.5 kg");
  });
});
