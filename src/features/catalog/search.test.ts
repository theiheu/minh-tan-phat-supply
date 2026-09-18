import { describe, it, expect } from "vitest";
import { matchesSearchTokens, computeSearchScore, removeVietnameseTones } from "@/lib/search";

describe("Material & Variant Search Integration Tests", () => {
  describe("Vietnamese unaccented & case-insensitive matching", () => {
    it("matches product name without accents", () => {
      expect(matchesSearchTokens("Băng keo dán sàn", "bang keo")).toBe(true);
      expect(matchesSearchTokens("Động cơ điện 3 pha", "dong co dien")).toBe(true);
      expect(matchesSearchTokens("Ốc vít lục giác", "oc vit")).toBe(true);
      expect(matchesSearchTokens("Phễu cám tam giác", "pheu cam")).toBe(true);
    });

    it("matches variant attributes with mixed accents and casing", () => {
      const variantText = "CB tép 20A 3pha Panasonic SKU-0174";
      expect(matchesSearchTokens(variantText, "cb tep 20a")).toBe(true);
      expect(matchesSearchTokens(variantText, "20a 3pha")).toBe(true);
      expect(matchesSearchTokens(variantText, "panasonic 20A")).toBe(true);
      expect(matchesSearchTokens(variantText, "sku-0174")).toBe(true);
      expect(matchesSearchTokens(variantText, "SKU-0174 20A")).toBe(true);
    });

    it("matches bearing specs like 6203, Koyo, SKF", () => {
      const bearingText = "Vòng bi / Bạc đạn cầu 6203 Koyo 2RS SKU-0512";
      expect(matchesSearchTokens(bearingText, "bac dan 6203")).toBe(true);
      expect(matchesSearchTokens(bearingText, "vong bi koyo")).toBe(true);
      expect(matchesSearchTokens(bearingText, "6203 koyo")).toBe(true);
      expect(matchesSearchTokens(bearingText, "koyo 2rs")).toBe(true);
      expect(matchesSearchTokens(bearingText, "bac dan koyo 6203")).toBe(true);
    });
  });

  describe("Compound query token verification", () => {
    it("requires all query tokens to match somewhere in the text", () => {
      const item = "Bulong lục giác M8x40 Inox 304";
      expect(matchesSearchTokens(item, "bulong m8 40 inox")).toBe(true);
      expect(matchesSearchTokens(item, "bulong m8 m10")).toBe(false); // m10 is missing
      expect(matchesSearchTokens(item, "inox 304 m8")).toBe(true);
    });

    it("handles irregular whitespace in queries", () => {
      const item = "Băng keo vàng 5cm Cuộn";
      expect(matchesSearchTokens(item, "  bang   keo   vang   5cm  ")).toBe(true);
    });
  });

  describe("Relevance Scoring", () => {
    it("prioritizes exact SKU code matches highest", () => {
      const scoreExactCode = computeSearchScore("SKU-0174", "SKU-0174", "SKU-0174");
      const scorePartial = computeSearchScore("CB tép 20A SKU-0174", "SKU-0174", "SKU-9999");
      expect(scoreExactCode).toBe(100);
      expect(scoreExactCode).toBeGreaterThan(scorePartial);
    });

    it("prioritizes exact product name matches over partial variant matches", () => {
      const exactScore = computeSearchScore("CB tép", "CB tép");
      const partialScore = computeSearchScore("Aptomat tép 3 pha (MCB 3P)", "CB tép");
      expect(exactScore).toBe(100);
      expect(exactScore).toBeGreaterThanOrEqual(partialScore);
    });
  });
});
