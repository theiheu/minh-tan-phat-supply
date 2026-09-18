import { describe, it, expect } from "vitest";
import {
  removeVietnameseTones,
  normalizeSearchText,
  tokenizeQuery,
  matchesSearchTokens,
  computeSearchScore,
} from "./search";

describe("search utilities", () => {
  describe("removeVietnameseTones & normalizeSearchText", () => {
    it("removes accents from Vietnamese text correctly", () => {
      expect(removeVietnameseTones("Băng keo vàng 5cm")).toBe("Bang keo vang 5cm");
      expect(removeVietnameseTones("Động cơ điện 3 pha")).toBe("Dong co dien 3 pha");
      expect(removeVietnameseTones("Ốc vít lục giác chìm")).toBe("Oc vit luc giac chim");
      expect(removeVietnameseTones("Vòng bi bạc đạn")).toBe("Vong bi bac dan");
    });

    it("normalizes text to lowercased unaccented string", () => {
      expect(normalizeSearchText("  BĂNG KEO VÀNG  ")).toBe("bang keo vang");
      expect(normalizeSearchText("Đèn LED 12V")).toBe("den led 12v");
      expect(normalizeSearchText("")).toBe("");
    });
  });

  describe("tokenizeQuery", () => {
    it("splits query into unaccented words", () => {
      expect(tokenizeQuery("CB tép 20A")).toEqual(["cb", "tep", "20a"]);
      expect(tokenizeQuery("  bạc   đạn   6203  SKF  ")).toEqual(["bac", "dan", "6203", "skf"]);
      expect(tokenizeQuery("")).toEqual([]);
    });
  });

  describe("matchesSearchTokens", () => {
    it("matches when target contains all query words in any order", () => {
      const target = "CB tép 20A 3pha Panasonic SKU-0174";
      expect(matchesSearchTokens(target, "CB tép 20A")).toBe(true);
      expect(matchesSearchTokens(target, "cb tep 20a")).toBe(true);
      expect(matchesSearchTokens(target, "20a cb")).toBe(true);
      expect(matchesSearchTokens(target, "panasonic 20a")).toBe(true);
      expect(matchesSearchTokens(target, "SKU-0174")).toBe(true);
      expect(matchesSearchTokens(target, "sku-0174 20a")).toBe(true);
    });

    it("returns false if any query word is missing", () => {
      const target = "CB tép 20A 3pha Panasonic";
      expect(matchesSearchTokens(target, "CB tép 30A")).toBe(false);
      expect(matchesSearchTokens(target, "koyo 20a")).toBe(false);
    });

    it("handles empty or whitespace query as match-all", () => {
      expect(matchesSearchTokens("Băng keo", "")).toBe(true);
      expect(matchesSearchTokens("Băng keo", "   ")).toBe(true);
    });
  });

  describe("computeSearchScore", () => {
    it("gives highest score to exact code or exact name", () => {
      expect(computeSearchScore("SKU-0174", "SKU-0174", "SKU-0174")).toBe(100);
      expect(computeSearchScore("CB tép", "CB tép")).toBe(100);
      expect(computeSearchScore("CB tép", "cb tep")).toBe(90);
    });

    it("ranks prefix matches above substring matches", () => {
      const prefixScore = computeSearchScore("Băng keo trong", "Băng keo");
      const substringScore = computeSearchScore("Cuộn Băng keo trong", "Băng keo");
      expect(prefixScore).toBeGreaterThan(substringScore);
    });
  });
});
