import { describe, expect, it } from "vitest";
import { formatAmountInWords } from "./money-words";

describe("formatAmountInWords", () => {
  it("0", () => expect(formatAmountInWords(0)).toBe("không đồng"));
  it("đơn vị", () => expect(formatAmountInWords(5)).toBe("năm đồng"));
  it("trăm lẻ", () => expect(formatAmountInWords(105)).toBe("một trăm lẻ năm đồng"));
  it("nghìn", () => expect(formatAmountInWords(1234)).toBe("một nghìn hai trăm ba mươi tư đồng"));
  it("triệu", () => expect(formatAmountInWords(1000005)).toBe("một triệu không trăm lẻ năm đồng"));
  it("tỷ", () => expect(formatAmountInWords(2000000000)).toBe("hai tỷ đồng"));
  it("lẻ nghìn", () => expect(formatAmountInWords(1001)).toBe("một nghìn không trăm lẻ một đồng"));
});
