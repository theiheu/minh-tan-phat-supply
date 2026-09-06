import { describe, expect, it } from "vitest";
import { formatDateLong, formatDateTime } from "./format";

describe("formatDateLong", () => {
  it("null → chuỗi rỗng", () => expect(formatDateLong(null)).toBe(""));
  it("undefined → chuỗi rỗng", () => expect(formatDateLong(undefined)).toBe(""));
  it("chuỗi rỗng → chuỗi rỗng", () => expect(formatDateLong("")).toBe(""));
  it("chuỗi không hợp lệ → chuỗi rỗng", () => expect(formatDateLong("không-phải-ngày")).toBe(""));
  it("ISO hợp lệ → 'Ngày dd tháng mm năm yyyy' và đúng năm", () => {
    // Chọn mốc giữa trưa (+07) để năm không đổi dù host chạy múi giờ khác.
    const s = formatDateLong("2026-09-06T10:00:00+07:00");
    expect(s).toMatch(/^Ngày \d{2} tháng \d{2} năm 2026$/);
    expect(s).toContain("năm 2026");
  });
});

describe("formatDateTime", () => {
  it("null/undefined/chuỗi rỗng → '—'", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("")).toBe("—");
  });
  it("chuỗi không hợp lệ → '—'", () => expect(formatDateTime("không-phải-ngày")).toBe("—"));
  it("ISO hợp lệ → 'dd/mm/yyyy HH:mm' cùng phút :00", () => {
    // Mốc giữa trưa (+07) để ngày/năm không đổi dù host chạy múi giờ khác.
    const s = formatDateTime("2026-09-06T10:00:00+07:00");
    expect(s).toMatch(/^\d{2}\/\d{2}\/2026 \d{2}:00$/);
  });
});
