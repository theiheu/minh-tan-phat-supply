import { describe, it, expect, vi } from "vitest";
import {
  isHeic,
  isJpeg,
  isPng,
  isWebp,
  isGif,
  isSvg,
  prepareHeicBuffer,
  processImageUpload,
} from "./server-image";
import convert from "heic-convert";

vi.mock("heic-convert", () => {
  return {
    default: vi.fn(async ({ buffer }) => {
      // Simulate conversion returning JPEG buffer
      if (buffer[0] === 0xde && buffer[1] === 0xad) {
        throw new Error("Corrupt HEIC file");
      }
      return new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    }),
  };
});

describe("Magic bytes detection", () => {
  it("detects JPEG from SOI marker", () => {
    const valid = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const invalid = new Uint8Array([0xff, 0x00, 0xff]);
    expect(isJpeg(valid)).toBe(true);
    expect(isJpeg(invalid)).toBe(false);
  });

  it("detects PNG from signature", () => {
    const valid = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const invalid = new Uint8Array([0x89, 0x50, 0x4e]);
    expect(isPng(valid)).toBe(true);
    expect(isPng(invalid)).toBe(false);
  });

  it("detects WebP from RIFF & WEBP markers", () => {
    // 'RIFF' + 4 bytes + 'WEBP'
    const valid = new Uint8Array([
      0x52, 0x49, 0x46, 0x46,
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ]);
    const invalid = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]);
    expect(isWebp(valid)).toBe(true);
    expect(isWebp(invalid)).toBe(false);
  });

  it("detects GIF from signature", () => {
    const gif89 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const gif87 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    const invalid = new Uint8Array([0x47, 0x49, 0x46, 0x38]);
    expect(isGif(gif89)).toBe(true);
    expect(isGif(gif87)).toBe(true);
    expect(isGif(invalid)).toBe(false);
  });

  it("detects SVG including with XML declaration and UTF-8 BOM", () => {
    const encoder = new TextEncoder();
    const svgSimple = encoder.encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const svgXml = encoder.encode("<?xml version='1.0'?><svg></svg>");
    const svgBom = new Uint8Array([0xef, 0xbb, 0xbf, ...svgXml]);
    const notSvg = encoder.encode("<html><body>hello</body></html>");

    expect(isSvg(svgSimple)).toBe(true);
    expect(isSvg(svgXml)).toBe(true);
    expect(isSvg(svgBom)).toBe(true);
    expect(isSvg(notSvg)).toBe(false);
  });
});

describe("prepareHeicBuffer", () => {
  it("preserves already supported lowercase brands", () => {
    const buffer = new Uint8Array([
      0, 0, 0, 24,
      0x66, 0x74, 0x79, 0x70, // ftyp
      0x68, 0x65, 0x69, 0x63, // heic
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    const result = prepareHeicBuffer(buffer);
    expect(result).toBe(buffer); // No mutation / same reference
  });

  it("normalizes uppercase brands like 'HEIC' to lowercase 'heic'", () => {
    const buffer = new Uint8Array([
      0, 0, 0, 24,
      0x66, 0x74, 0x79, 0x70, // ftyp
      0x48, 0x45, 0x49, 0x43, // HEIC
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    const result = prepareHeicBuffer(buffer);
    const brand = String.fromCharCode(result[8], result[9], result[10], result[11]);
    expect(brand).toBe("heic");
  });

  it("normalizes extended HEIF brands like 'miaf' or 'heim' to 'heic'", () => {
    const buffer = new Uint8Array([
      0, 0, 0, 24,
      0x66, 0x74, 0x79, 0x70, // ftyp
      0x6d, 0x69, 0x61, 0x66, // miaf
      0, 0, 0, 0,
      0x68, 0x65, 0x69, 0x63, // compatible: heic
    ]);
    const result = prepareHeicBuffer(buffer);
    const brand = String.fromCharCode(result[8], result[9], result[10], result[11]);
    expect(brand).toBe("heic");
  });
});

describe("isHeic", () => {
  it("detects HEIC from MIME types", () => {
    const dummy = new Uint8Array([0, 0, 0, 0]);
    expect(isHeic(dummy, "image/heic")).toBe(true);
    expect(isHeic(dummy, "image/heif")).toBe(true);
    expect(isHeic(dummy, "image/heic-sequence")).toBe(true);
    expect(isHeic(dummy, "image/heif-sequence")).toBe(true);
    expect(isHeic(dummy, "IMAGE/HEIC")).toBe(true);
  });

  it("detects HEIC from file extensions", () => {
    const dummy = new Uint8Array([0, 0, 0, 0]);
    expect(isHeic(dummy, undefined, "invoice.heic")).toBe(true);
    expect(isHeic(dummy, undefined, "IMG_1234.HEIC")).toBe(true);
    expect(isHeic(dummy, undefined, "photo.heif")).toBe(true);
    expect(isHeic(dummy, undefined, "PHOTO.HEIF")).toBe(true);
    expect(isHeic(dummy, "application/octet-stream", "hoa-don.heic")).toBe(true);
  });

  it("detects HEIC from ftyp magic bytes", () => {
    // 00 00 00 18 'f' 't' 'y' 'p' 'h' 'e' 'i' 'c'
    const heicBytes = new Uint8Array([
      0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0,
    ]);
    expect(isHeic(heicBytes)).toBe(true);

    // mif1 brand
    const mif1Bytes = new Uint8Array([
      0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31, 0, 0, 0, 0,
    ]);
    expect(isHeic(mif1Bytes)).toBe(true);

    // miaf brand with compatible heic
    const miafBytes = new Uint8Array([
      0, 0, 0, 24,
      0x66, 0x74, 0x79, 0x70,
      0x6d, 0x69, 0x61, 0x66,
      0, 0, 0, 0,
      0x68, 0x65, 0x69, 0x63,
    ]);
    expect(isHeic(miafBytes)).toBe(true);
  });

  it("returns false for standard image formats even when named .heic or with image/heic MIME", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46,
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ]);

    // Standard filename / mime
    expect(isHeic(pngBytes, "image/png", "sample.png")).toBe(false);
    expect(isHeic(jpgBytes, "image/jpeg", "sample.jpg")).toBe(false);
    expect(isHeic(webpBytes, "image/webp", "sample.webp")).toBe(false);

    // iOS Safari / misnamed files: .heic filename but actual content is JPEG/PNG/WebP
    expect(isHeic(jpgBytes, "image/heic", "IMG_1234.HEIC")).toBe(false);
    expect(isHeic(pngBytes, "image/heic", "photo.heic")).toBe(false);
    expect(isHeic(webpBytes, "image/heic", "image.heic")).toBe(false);
  });
});

describe("processImageUpload", () => {
  it("converts genuine HEIC to JPEG", async () => {
    const heic = new Uint8Array([
      0, 0, 0, 24,
      0x66, 0x74, 0x79, 0x70,
      0x68, 0x65, 0x69, 0x63,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    const res = await processImageUpload(heic, "image/heic", "bill.heic");
    expect(res.contentType).toBe("image/jpeg");
    expect(res.ext).toBe("jpg");
    expect(res.data).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));
    expect(convert).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "JPEG",
      }),
    );
  });

  it("handles iOS Safari scenario: JPEG content with .HEIC filename without failing with 'input buffer is not a HEIC image'", async () => {
    // iPhone Safari automatically converts photo to JPEG upon file pick, but keeps original .HEIC filename
    const iosJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const res = await processImageUpload(iosJpeg, "image/heic", "IMG_5678.HEIC");
    expect(res.contentType).toBe("image/jpeg");
    expect(res.ext).toBe("jpg");
    expect(res.data).toBe(iosJpeg);
    // Should NOT call heic convert at all!
    expect(convert).not.toHaveBeenCalledWith(expect.objectContaining({ buffer: iosJpeg }));
  });

  it("normalizes uppercase brand 'HEIC' and converts successfully", async () => {
    const heicUpper = new Uint8Array([
      0, 0, 0, 24,
      0x66, 0x74, 0x79, 0x70,
      0x48, 0x45, 0x49, 0x43, // HEIC
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    const res = await processImageUpload(heicUpper, "image/heic", "photo.heic");
    expect(res.contentType).toBe("image/jpeg");
    expect(res.ext).toBe("jpg");
  });

  it("throws clear error when HEIC conversion fails on corrupt file", async () => {
    const corruptHeic = new Uint8Array([0xde, 0xad, 1, 2]);
    await expect(processImageUpload(corruptHeic, "image/heic", "bad.heic")).rejects.toThrow(
      "Không thể chuyển đổi ảnh HEIC sang JPEG",
    );
  });

  it("passes through PNG images", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = await processImageUpload(png, "image/png", "test.png");
    expect(res.contentType).toBe("image/png");
    expect(res.ext).toBe("png");
    expect(res.data).toBe(png);
  });

  it("passes through JPEG images", async () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const res = await processImageUpload(jpg, "image/jpeg", "test.jpg");
    expect(res.contentType).toBe("image/jpeg");
    expect(res.ext).toBe("jpg");
    expect(res.data).toBe(jpg);
  });

  it("passes through WebP images", async () => {
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46,
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ]);
    const res = await processImageUpload(webp, "image/webp", "test.webp");
    expect(res.contentType).toBe("image/webp");
    expect(res.ext).toBe("webp");
    expect(res.data).toBe(webp);
  });

  it("passes through SVG images", async () => {
    const encoder = new TextEncoder();
    const svg = encoder.encode("<svg width='100' height='100'></svg>");
    const res = await processImageUpload(svg, "image/svg+xml", "icon.svg");
    expect(res.contentType).toBe("image/svg+xml");
    expect(res.ext).toBe("svg");
    expect(res.data).toBe(svg);
  });

  it("rejects unsupported file types", async () => {
    const txt = new Uint8Array([1, 2, 3, 4]);
    await expect(processImageUpload(txt, "application/pdf", "doc.pdf")).rejects.toThrow(
      "Chỉ chấp nhận ảnh PNG, JPG, WebP hoặc HEIC/HEIF",
    );
  });
});
