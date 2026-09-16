import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./system-prompt";

describe("buildSystemPrompt", () => {
  it("should generate role-aware prompt for requester without financial prices", () => {
    const prompt = buildSystemPrompt({
      userId: "user-1",
      userName: "Nguyễn Văn Kỹ Thuật",
      role: "technician",
    });

    expect(prompt).toContain("Nguyễn Văn Kỹ Thuật");
    expect(prompt).toContain("technician");
    expect(prompt).toContain("KHÔNG ĐƯỢC PHÉP xem giá nhập/giá tiền");
    expect(prompt).toContain("TUYỆT ĐỐI KHÔNG tự bịa số lượng");
  });

  it("should permit financial prices for accountant and owner", () => {
    const prompt = buildSystemPrompt({
      userId: "user-2",
      userName: "Trần Kế Toán",
      role: "accountant",
    });

    expect(prompt).toContain("Trần Kế Toán");
    expect(prompt).toContain("CÓ QUYỀN xem giá nhập và chi phí tài chính");
  });
});
