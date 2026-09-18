import { describe, expect, it } from "vitest";
import type { CatalogUnit } from "./types";
import {
  availableTransactionUnits,
  initialBaseUnitId,
  transactionUomCode,
  validateTransactionUomDraft,
  validateTransactionUomDrafts,
} from "./uom";

const units: CatalogUnit[] = [
  { id: "bich", code: "bich", name: "Bịch", symbol: "bịch", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "cai", code: "cai", name: "Cái", symbol: "cái", dimension: "count", factorToReference: 1, decimalScale: 0 },
  { id: "thung", code: "thung", name: "Thùng", symbol: "thùng", dimension: "package", factorToReference: 1, decimalScale: 0 },
];

describe("material UOM creation", () => {
  it("does not silently default the base unit from the first sorted option", () => {
    expect(initialBaseUnitId()).toBe("");
  });

  it("uses the selected unit code as the stable transaction code", () => {
    expect(transactionUomCode(units[2])).toBe("thung");
  });

  it("only offers transaction units that are not the base or already selected", () => {
    expect(availableTransactionUnits(units, "cai", ["thung"]).map((unit) => unit.id))
      .toEqual(["bich"]);
  });

  it("requires a real transaction unit distinct from the base unit", () => {
    expect(validateTransactionUomDraft({ unitId: "", displayName: "Thùng", factorToBase: 24 }, units, "cai"))
      .toBe("Vui lòng chọn đơn vị giao dịch");
    expect(validateTransactionUomDraft({ unitId: "cai", displayName: "Cái", factorToBase: 1 }, units, "cai"))
      .toBe("Đơn vị quy đổi phải khác đơn vị cơ sở");
    expect(validateTransactionUomDraft({ unitId: "thung", displayName: "Thùng 24 cái", factorToBase: 24 }, units, "cai"))
      .toBeNull();
  });

  it("rejects duplicate transaction units", () => {
    expect(validateTransactionUomDrafts([
      { unitId: "thung", displayName: "Thùng 24 cái", factorToBase: 24 },
      { unitId: "thung", displayName: "Thùng lớn", factorToBase: 48 },
    ], units, "cai")).toBe("Mỗi đơn vị giao dịch chỉ được khai báo một lần");
  });
});
