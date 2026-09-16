import { describe, it, expect } from "vitest";
import { chunkText, generateContentHash, extractTextFromFile } from "./chunker";

describe("Knowledge Chunker & Text Extraction", () => {
  it("should generate SHA-256 hash consistently", () => {
    const text = "Quy trình kiểm kê trang trại";
    const hash1 = generateContentHash(text);
    const hash2 = generateContentHash(text);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("should chunk long markdown text by paragraphs", () => {
    const longText = [
      "# HƯỚNG DẪN KIỂM KÊ KHO",
      "Bước 1: Thủ kho chuẩn bị danh sách vật tư và máy quét mã vạch.",
      "Bước 2: Tiến hành đếm thực tế từng vị trí kệ hàng và ghi nhận số liệu.",
      "Bước 3: Đối soát số liệu thực tế với phần mềm quản lý kho.",
      "Bước 4: Lập biên bản chênh lệch nếu có thừa hoặc thiếu vật tư.",
    ].join("\n\n");

    const chunks = chunkText(longText, 150, 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain("HƯỚNG DẪN KIỂM KÊ");
  });

  it("should extract text from txt/md buffer", async () => {
    const sampleText = "Nội dung tài liệu kiểm tra";
    const buffer = Buffer.from(sampleText, "utf-8");
    const extracted = await extractTextFromFile(buffer, "huong-dan.txt", "text/plain");
    expect(extracted).toBe(sampleText);
  });
});
