import { describe, expect, it } from "vitest";
import { formatDate, formatVnd } from "./format";
import { computeCompositeStock } from "./stock";

describe("computeCompositeStock", () => {
  it("trả về min(floor(child/qty))", () => {
    // Bộ = 1 Núm + 1 Cốc; Núm tồn 5, Cốc tồn 3 → 3 bộ
    expect(computeCompositeStock([5, 3], [1, 1])).toBe(3);
  });

  it("trả về 0 khi thiếu 1 linh kiện", () => {
    expect(computeCompositeStock([10, 0], [1, 1])).toBe(0);
  });

  it("hỗ trợ linh kiện cần số lượng > 1", () => {
    // 2 Núm cho 1 bộ; Núm tồn 5 → 2 bộ
    expect(computeCompositeStock([5], [2])).toBe(2);
  });

  it("trả về 0 khi mảng rỗng", () => {
    expect(computeCompositeStock([], [])).toBe(0);
  });
});

describe("format helpers", () => {
  it("định dạng tiền 1.234.567 đ", () => {
    expect(formatVnd(1234567)).toBe("1.234.567 đ");
  });

  it("định dạng ngày dd/mm/yyyy", () => {
    expect(formatDate("2025-09-05T12:00:00")).toBe("05/09/2025");
  });

  it("trả về — cho ngày rỗng", () => {
    expect(formatDate(null)).toBe("—");
  });
});
