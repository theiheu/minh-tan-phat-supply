import { describe, expect, it } from "vitest";
import {
  attributesToPairs,
  kitLabel,
  materialLabel,
  pairsToJson,
  parseAttributesObject,
} from "./attributes";

describe("parseAttributesObject", () => {
  it("parse chuỗi JSON object", () => {
    expect(parseAttributesObject('{"Kích cỡ":"39-42"}')).toEqual({ "Kích cỡ": "39-42" });
  });
  it("parse object (jsonb)", () => {
    expect(parseAttributesObject({ "Trọng lượng": "Bao 10kg" })).toEqual({ "Trọng lượng": "Bao 10kg" });
  });
  it("bỏ qua rỗng/null/sai định dạng", () => {
    expect(parseAttributesObject(null)).toBeNull();
    expect(parseAttributesObject(undefined)).toBeNull();
    expect(parseAttributesObject("không phải json")).toBeNull();
    expect(parseAttributesObject("[]")).toBeNull();
    expect(parseAttributesObject(42)).toBeNull();
    expect(parseAttributesObject({ a: "" })).toBeNull();
    expect(parseAttributesObject({ a: 1, b: "x" })).toEqual({ b: "x" });
  });
});

describe("pairs <-> json", () => {
  it("roundtrip", () => {
    const pairs: [string, string][] = [
      ["Kích cỡ", "39-42"],
      ["", ""],
    ];
    const json = pairsToJson(pairs);
    expect(json).toBe('{"Kích cỡ":"39-42"}');
    expect(attributesToPairs(json)).toEqual([
      ["Kích cỡ", "39-42"],
      ["", ""],
    ]);
  });
  it("bỏ dòng trống khóa/giá trị", () => {
    expect(pairsToJson([["a", "b"], ["", "x"], ["y", ""]])).toBe('{"a":"b"}');
  });
});

describe("materialLabel / kitLabel", () => {
  it("label từ attributes hoặc unit", () => {
    expect(materialLabel('{"Loại":"Núm"}', "Cái")).toBe("Núm");
    expect(materialLabel("{}", "Bộ")).toBe("Bộ");
    expect(materialLabel(null, null)).toBe("—");
  });
  it("kitLabel gộp linh kiện", () => {
    expect(
      kitLabel("Bộ máng", [
        { label: "Núm", quantity: 1 },
        { label: "Cốc", quantity: 2 },
      ]),
    ).toBe("Bộ máng (gồm Núm ×1 · Cốc ×2)");
    expect(kitLabel("Bộ", [])).toBe("Bộ");
  });
});
