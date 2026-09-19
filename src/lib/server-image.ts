import convert from "heic-convert";

/**
 * Kiểm tra buffer có phải là định dạng JPEG hay không qua magic bytes SOI (0xFF, 0xD8, 0xFF).
 */
export function isJpeg(buffer: Uint8Array): boolean {
  return (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

/**
 * Kiểm tra buffer có phải là định dạng PNG hay không qua magic bytes (\x89PNG\r\n\x1a\n).
 */
export function isPng(buffer: Uint8Array): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

/**
 * Kiểm tra buffer có phải là định dạng WebP hay không (RIFF....WEBP).
 */
export function isWebp(buffer: Uint8Array): boolean {
  return (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  );
}

/**
 * Kiểm tra buffer có phải là định dạng GIF hay không (GIF87a / GIF89a).
 */
export function isGif(buffer: Uint8Array): boolean {
  return (
    buffer.length >= 6 &&
    buffer[0] === 0x47 && // G
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x38 && // 8
    (buffer[4] === 0x37 || buffer[4] === 0x39) && // 7 hoặc 9
    buffer[5] === 0x61 // a
  );
}

/**
 * Kiểm tra buffer có phải là định dạng SVG hay không.
 */
export function isSvg(buffer: Uint8Array): boolean {
  if (buffer.length < 4) return false;
  let offset = 0;
  // Bỏ qua UTF-8 BOM nếu có
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    offset = 3;
  }
  const checkLen = Math.min(buffer.length, offset + 128);
  let str = "";
  for (let i = offset; i < checkLen; i++) {
    str += String.fromCharCode(buffer[i]);
  }
  const trimmed = str.trimStart().toLowerCase();
  return trimmed.startsWith("<svg") || trimmed.startsWith("<?xml");
}

/**
 * Tìm vị trí box 'ftyp' trong ISOBMFF container (thường ở offset 4).
 */
export function findFtypOffset(buffer: Uint8Array): number {
  if (buffer.length < 12) return -1;
  if (
    buffer[4] === 0x66 && // f
    buffer[5] === 0x74 && // t
    buffer[6] === 0x79 && // y
    buffer[7] === 0x70 // p
  ) {
    return 4;
  }
  const maxSearch = Math.min(buffer.length - 8, 32);
  for (let i = 0; i <= maxSearch; i++) {
    if (
      buffer[i] === 0x66 &&
      buffer[i + 1] === 0x74 &&
      buffer[i + 2] === 0x79 &&
      buffer[i + 3] === 0x70
    ) {
      return i;
    }
  }
  return -1;
}

const HEIC_DECODE_ACCEPTED_BRANDS = new Set([
  "mif1",
  "msf1",
  "heic",
  "heix",
  "hevc",
  "hevx",
]);

/**
 * Thư viện `heic-decode` kiểm tra case-sensitive 6 major brand cố định:
 * 'mif1', 'msf1', 'heic', 'heix', 'hevc', 'hevx'.
 * Nếu ảnh có brand chữ hoa ('HEIC', 'MIF1') hoặc brand mở rộng ('miaf', 'heim', 'heis', 'mif2'),
 * heic-decode sẽ ném lỗi "input buffer is not a HEIC image" dù libheif xử lý được.
 * Hàm này chuẩn hoá byte brand major trong header ftyp sang brand tương thích heic-decode.
 */
export function prepareHeicBuffer(buffer: Uint8Array): Uint8Array {
  const ftypOffset = findFtypOffset(buffer);
  if (ftypOffset < 0 || buffer.length < ftypOffset + 8) {
    return buffer;
  }

  const brandOffset = ftypOffset + 4;
  const rawBrand = String.fromCharCode(
    buffer[brandOffset],
    buffer[brandOffset + 1],
    buffer[brandOffset + 2],
    buffer[brandOffset + 3],
  );

  if (HEIC_DECODE_ACCEPTED_BRANDS.has(rawBrand)) {
    return buffer;
  }

  const lowerBrand = rawBrand.toLowerCase();
  const targetBrand = HEIC_DECODE_ACCEPTED_BRANDS.has(lowerBrand) ? lowerBrand : "heic";

  const copy = new Uint8Array(buffer);
  for (let i = 0; i < 4; i++) {
    copy[brandOffset + i] = targetBrand.charCodeAt(i);
  }
  return copy;
}

/**
 * Kiểm tra file có phải định dạng HEIC/HEIF hay không.
 * Nếu dữ liệu buffer thực tế là JPEG, PNG, WebP, GIF hoặc SVG thì KHÔNG phải HEIC
 * (tránh trường hợp thiết bị iOS tự convert sang JPEG nhưng giữ nguyên tên .heic).
 */
export function isHeic(buffer: Uint8Array, mimeType?: string, fileName?: string): boolean {
  // Nếu buffer là các định dạng ảnh chuẩn đã biết thì không phải HEIC
  if (isJpeg(buffer) || isPng(buffer) || isWebp(buffer) || isGif(buffer) || isSvg(buffer)) {
    return false;
  }

  // 1. Kiểm tra ISOBMFF ftyp header
  const ftypOffset = findFtypOffset(buffer);
  if (ftypOffset >= 0 && buffer.length >= ftypOffset + 8) {
    const brand = String.fromCharCode(
      buffer[ftypOffset + 4],
      buffer[ftypOffset + 5],
      buffer[ftypOffset + 6],
      buffer[ftypOffset + 7],
    ).toLowerCase();

    if (
      brand.startsWith("hei") || // heic, heix, heim, heis, heif
      brand.startsWith("hev") || // hevc, hevx, hevm, hevs
      brand === "mif1" ||
      brand === "msf1" ||
      brand === "mif2" ||
      brand === "miaf"
    ) {
      return true;
    }

    // Kiểm tra compatible brands trong header
    const headerLength = Math.min(buffer.length, ftypOffset + 128);
    let headerStr = "";
    for (let i = ftypOffset + 8; i < headerLength; i++) {
      headerStr += String.fromCharCode(buffer[i]);
    }
    const lowerHeader = headerStr.toLowerCase();
    if (
      lowerHeader.includes("heic") ||
      lowerHeader.includes("heix") ||
      lowerHeader.includes("hevc") ||
      lowerHeader.includes("hevx") ||
      lowerHeader.includes("heim") ||
      lowerHeader.includes("heis") ||
      lowerHeader.includes("mif1") ||
      lowerHeader.includes("msf1") ||
      lowerHeader.includes("mif2") ||
      lowerHeader.includes("miaf")
    ) {
      return true;
    }
  }

  // 2. Kiểm tra MIME type
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

  // 3. Kiểm tra đuôi file
  const normName = (fileName ?? "").toLowerCase().trim();
  if (normName.endsWith(".heic") || normName.endsWith(".heif")) {
    return true;
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
 * - Tự động nhận diện định dạng chuẩn dựa trên nội dung thực tế (magic bytes):
 *   + JPEG, PNG, WebP, GIF, SVG: giữ nguyên định dạng (kể cả khi tên file bị đổi thành .heic).
 *   + HEIC/HEIF: tự động chuẩn hoá header và chuyển đổi sang JPEG chuẩn tương thích 100% trên mọi trình duyệt/thiết bị.
 * - Trả về buffer, contentType và đuôi file chuẩn.
 */
export async function processImageUpload(
  buffer: Uint8Array,
  mimeType?: string,
  fileName?: string,
): Promise<ProcessedImage> {
  // 1. Nhận diện định dạng chuẩn theo magic bytes (tránh gửi ảnh JPEG/PNG đã convert sang heic-convert)
  if (isJpeg(buffer)) {
    return { data: buffer, contentType: "image/jpeg", ext: "jpg" };
  }
  if (isPng(buffer)) {
    return { data: buffer, contentType: "image/png", ext: "png" };
  }
  if (isWebp(buffer)) {
    return { data: buffer, contentType: "image/webp", ext: "webp" };
  }
  if (isGif(buffer)) {
    return { data: buffer, contentType: "image/gif", ext: "gif" };
  }
  if (isSvg(buffer)) {
    return { data: buffer, contentType: "image/svg+xml", ext: "svg" };
  }

  // 2. Xử lý ảnh HEIC / HEIF
  if (isHeic(buffer, mimeType, fileName)) {
    try {
      const prepared = prepareHeicBuffer(buffer);
      const converted = await convert({
        buffer: prepared,
        format: "JPEG",
        quality: 0.88,
      });
      return {
        data: new Uint8Array(converted),
        contentType: "image/jpeg",
        ext: "jpg",
      };
    } catch (err) {
      // Cứu nguy nếu nội dung thực tế vẫn là ảnh hợp lệ
      if (isJpeg(buffer)) {
        return { data: buffer, contentType: "image/jpeg", ext: "jpg" };
      }
      if (isPng(buffer)) {
        return { data: buffer, contentType: "image/png", ext: "png" };
      }
      if (isWebp(buffer)) {
        return { data: buffer, contentType: "image/webp", ext: "webp" };
      }

      throw new Error(
        `Không thể chuyển đổi ảnh HEIC sang JPEG: ${err instanceof Error ? err.message : "Định dạng không hợp lệ"}`,
      );
    }
  }

  // 3. Fallback theo MIME type hoặc tên file nếu magic bytes chưa phân loại được
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
  if (normMime === "image/gif" || normName.endsWith(".gif")) {
    return { data: buffer, contentType: "image/gif", ext: "gif" };
  }
  if (normMime === "image/svg+xml" || normName.endsWith(".svg")) {
    return { data: buffer, contentType: "image/svg+xml", ext: "svg" };
  }

  throw new Error("Chỉ chấp nhận ảnh PNG, JPG, WebP hoặc HEIC/HEIF");
}
