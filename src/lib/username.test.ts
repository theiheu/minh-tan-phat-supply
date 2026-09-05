import { describe, expect, it } from "vitest";
import { isValidUsername, normalizeUsername, internalEmailForUsername } from "./username";

describe("username", () => {
  it("normalize: trim + lowercase", () => {
    expect(normalizeUsername("  Nguyen.Van.A ")).toBe("nguyen.van.a");
  });

  it("chấp nhận username hợp lệ", () => {
    expect(isValidUsername("manager")).toBe(true);
    expect(isValidUsername("nguyen.van_a-2")).toBe(true);
    expect(isValidUsername("a1")).toBe(false); // < 3 ký tự
    expect(isValidUsername("nguyễn")).toBe(false); // có dấu
    expect(isValidUsername("1abc")).toBe(false); // phải bắt đầu bằng chữ
    expect(isValidUsername("has space")).toBe(false);
    expect(isValidUsername("UPPER")).toBe(true); // được chuẩn hoá về chữ thường
    expect(isValidUsername("x".repeat(31))).toBe(false); // quá dài
  });

  it("sinh email nội bộ", () => {
    expect(internalEmailForUsername("requester")).toBe("requester@mtp.local");
  });
});
