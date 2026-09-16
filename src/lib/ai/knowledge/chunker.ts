import crypto from "crypto";

export function generateContentHash(content: string): string {
  return crypto.createHash("sha256").update(content.trim()).digest("hex");
}

/**
 * Phân đoạn văn bản thông minh (Markdown & Plain text)
 * Tôn trọng ranh giới đoạn văn (\n\n) và tiêu đề (#, ##, ###)
 */
export function chunkText(content: string, maxChunkSize = 700, _overlap = 100): string[] {
  const cleanContent = content.replace(/\r\n/g, "\n").trim();
  if (!cleanContent) return [];

  if (cleanContent.length <= maxChunkSize) {
    return [cleanContent];
  }

  // Tách theo tiêu đề hoặc các đoạn văn lớn
  const paragraphs = cleanContent.split(/\n{2,}/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // Nếu đoạn hiện tại cộng thêm đoạn mới nhỏ hơn maxChunkSize
    if ((currentChunk + "\n\n" + trimmedPara).trim().length <= maxChunkSize) {
      currentChunk = currentChunk ? currentChunk + "\n\n" + trimmedPara : trimmedPara;
    } else {
      // Nếu currentChunk đã có nội dung, lưu lại
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      // Nếu đoạn văn dài hơn maxChunkSize, cắt nhỏ theo câu hoặc dòng
      if (trimmedPara.length > maxChunkSize) {
        const lines = trimmedPara.split(/\n+/);
        let subChunk = "";
        for (const line of lines) {
          if ((subChunk + "\n" + line).trim().length <= maxChunkSize) {
            subChunk = subChunk ? subChunk + "\n" + line : line;
          } else {
            if (subChunk.trim()) chunks.push(subChunk.trim());
            subChunk = line;
          }
        }
        currentChunk = subChunk;
      } else {
        currentChunk = trimmedPara;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((c) => c.length > 20);
}

/**
 * Trích xuất text từ buffer theo định dạng file (.pdf, .docx, .txt, .md)
 */
export async function extractTextFromFile(
  buffer: Buffer,
  fileName: string,
  _mimeType?: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  // 1. Markdown / Text
  if (ext === "txt" || ext === "md" || ext === "markdown" || ext === "csv") {
    return buffer.toString("utf-8");
  }

  // 2. Word (.docx)
  if (ext === "docx" || ext === "doc") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    } catch (err) {
      throw new Error("Không thể đọc file Word: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  // 3. PDF (.pdf)
  if (ext === "pdf") {
    try {
      const pdfParseModule = await import("pdf-parse");
      const pdfParse = (pdfParseModule as unknown as { default?: (buf: Buffer) => Promise<{ text: string }> }).default || (pdfParseModule as unknown as (buf: Buffer) => Promise<{ text: string }>);
      const data = await pdfParse(buffer);
      return data.text || "";
    } catch (err) {
      throw new Error("Không thể đọc file PDF: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  // Mặc định thử đọc dạng text utf-8
  return buffer.toString("utf-8");
}
