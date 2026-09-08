import convert from "heic-convert";

/**
 * Kiểm tra file có phải định dạng HEIC/HEIF hay không qua MIME type, đuôi file hoặc ISOBMFF magic bytes.
 */
export function isHeic(buffer: Uint8Array, mimeType?: string, fileName?: string): boolean {
  const normMime = (mimeType ?? "").toLowerCase().trim();
  if (
    normMime === "image/heic" ||
    normMime === "image/heif" ||
    normMime === "image/heic-sequence" ||
    normMime === "image/heif-sequence" ||
    normMime.includes("heic") ||
    normMime.includes("heif")
  ) {
    return true;
  }

  const normName = (fileName ?? "").toLowerCase().trim();
  if (normName.endsWith(".heic") || normName.endsWith(".heif")) {
    return true;
  }

  // Check ISOBMFF ftyp box header
  if (buffer.length >= 12) {
    const ftyp = String.fromCharCode(buffer[4], buffer[5], buffer[6], buffer[7]);
    if (ftyp === "ftyp") {
      const brand = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]).toLowerCase();
      if (
        brand.startsWith("hei") ||
        brand.startsWith("hev") ||
        brand === "mif1" ||
        brand === "msf1"
      ) {
        return true;
      }
      // Check compatible brands trong 64 byte đầu
      const headerLength = Math.min(buffer.length, 64);
      let headerStr = "";
      for (let i = 12; i < headerLength; i++) {
        headerStr += String.fromCharCode(buffer[i]);
      }
      const lowerHeader = headerStr.toLowerCase();
      if (
        lowerHeader.includes("heic") ||
        lowerHeader.includes("heix") ||
        lowerHeader.includes("hevc") ||
        lowerHeader.includes("mif1") ||
        lowerHeader.includes("msf1")
      ) {
        return true;
      }
    }
  }

  return false;
}

export interface ProcessedImage {
  data: Uint8Array;
  contentType: string;
  ext: string;
}

/**
 * Xử lý file ảnh trước khi lưu storage:
 * - Nếu là ảnh HEIC/HEIF: tự động chuyển đổi sang JPEG chuẩn chất lượng cao để hiển thị được trên mọi trình duyệt/thiết bị và xuất PDF.
 * - Nếu là PNG, JPEG, WebP, SVG: giữ nguyên định dạng.
 * - Trả về buffer, contentType và đuôi file chuẩn.
 */
export async function processImageUpload(
  buffer: Uint8Array,
  mimeType?: string,
  fileName?: string,
): Promise<ProcessedImage> {
  if (isHeic(buffer, mimeType, fileName)) {
    try {
      const converted = await convert({
        buffer,
        format: "JPEG",
        quality: 0.88,
      });
      return {
        data: new Uint8Array(converted),
        contentType: "image/jpeg",
        ext: "jpg",
      };
    } catch (err) {
      throw new Error(
        `Không thể chuyển đổi ảnh HEIC sang JPEG: ${err instanceof Error ? err.message : "Định dạng không hợp lệ"}`,
      );
    }
  }

  const normMime = (mimeType ?? "").toLowerCase().trim();
  const normName = (fileName ?? "").toLowerCase().trim();

  if (normMime === "image/png" || normName.endsWith(".png")) {
    return { data: buffer, contentType: "image/png", ext: "png" };
  }
  if (
    normMime === "image/jpeg" ||
    normMime === "image/jpg" ||
    normName.endsWith(".jpg") ||
    normName.endsWith(".jpeg")
  ) {
    return { data: buffer, contentType: "image/jpeg", ext: "jpg" };
  }
  if (normMime === "image/webp" || normName.endsWith(".webp")) {
    return { data: buffer, contentType: "image/webp", ext: "webp" };
  }
  if (normMime === "image/svg+xml" || normName.endsWith(".svg")) {
    return { data: buffer, contentType: "image/svg+xml", ext: "svg" };
  }

  throw new Error("Chỉ chấp nhận ảnh PNG, JPG, WebP hoặc HEIC/HEIF");
}
