import { describe, it, expect } from "vitest";
import { extractStandardizedDraft, KNOWLEDGE_STANDARDIZER_SYSTEM_PROMPT } from "./standardizer";

describe("Knowledge Standardizer", () => {
  it("should have comprehensive system prompt", () => {
    expect(KNOWLEDGE_STANDARDIZER_SYSTEM_PROMPT).toContain("Chuyên gia Tiêu chuẩn hóa Tri thức & SOP Vận hành Trang trại");
    expect(KNOWLEDGE_STANDARDIZER_SYSTEM_PROMPT).toContain("standardized_knowledge");
  });

  it("should parse valid standardized_knowledge draft and clean text", () => {
    const rawAiOutput = [
      "Chào bạn! Tôi đã phân tích ghi chú và chuẩn hóa thành quy trình bảo dưỡng quạt hút.",
      "",
      "```standardized_knowledge",
      JSON.stringify({
        title: "📖 QUY TRÌNH 15: BẢO DƯỠNG QUẠT HÚT CÔNG NGHIỆP",
        category: "sop",
        summary: "Quy trình kiểm tra, vệ sinh và bôi trơn bạc đạn quạt hút tại các dãy trại.",
        content: "## 1. Mục đích\nĐảm bảo thông gió trang trại.\n\n## 2. Các bước\nBước 1: Ngắt cầu dao điện.\nBước 2: Vệ sinh cánh quạt.",
        keywords: ["quạt hút", "bảo dưỡng", "cơ điện"]
      }, null, 2),
      "```",
      "",
      "Bạn có thể xem trước bản thảo ở trên và nhấn nút Nạp vào CSDL nhé!"
    ].join("\n");

    const { cleanText, draft } = extractStandardizedDraft(rawAiOutput);

    expect(draft).not.toBeNull();
    expect(draft?.title).toBe("📖 QUY TRÌNH 15: BẢO DƯỠNG QUẠT HÚT CÔNG NGHIỆP");
    expect(draft?.category).toBe("sop");
    expect(draft?.summary).toContain("kiểm tra, vệ sinh và bôi trơn");
    expect(draft?.content).toContain("## 1. Mục đích");
    expect(draft?.keywords).toEqual(["quạt hút", "bảo dưỡng", "cơ điện"]);

    expect(cleanText).not.toContain("standardized_knowledge");
    expect(cleanText).toContain("Chào bạn! Tôi đã phân tích ghi chú");
    expect(cleanText).toContain("Bạn có thể xem trước bản thảo ở trên");
  });

  it("should fallback category to sop if unknown category is provided", () => {
    const rawAiOutput = [
      "```standardized_knowledge",
      JSON.stringify({
        title: "TIÊU CHUẨN MỚI",
        category: "invalid_category",
        summary: "Tóm tắt",
        content: "Nội dung quy trình chi tiết..."
      }),
      "```"
    ].join("\n");

    const { draft } = extractStandardizedDraft(rawAiOutput);
    expect(draft).not.toBeNull();
    expect(draft?.category).toBe("sop");
  });

  it("should return null draft when no code block is present", () => {
    const plainText = "Tôi chưa hiểu ý bạn, bạn vui lòng cung cấp thêm thông tin về quy trình nhé.";
    const { cleanText, draft } = extractStandardizedDraft(plainText);
    expect(draft).toBeNull();
    expect(cleanText).toBe(plainText);
  });
});
