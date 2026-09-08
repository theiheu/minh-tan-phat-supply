import { describe, it, expect, vi } from "vitest";
import { isHeic, processImageUpload } from "./server-image";
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
  });

  it("returns false for standard image formats", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(isHeic(pngBytes, "image/png", "sample.png")).toBe(false);
    expect(isHeic(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg", "sample.jpg")).toBe(false);
    expect(isHeic(new Uint8Array([1, 2, 3]), "image/webp", "sample.webp")).toBe(false);
  });
});

describe("processImageUpload", () => {
  it("converts HEIC to JPEG", async () => {
    const heic = new Uint8Array([1, 2, 3, 4]);
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

  it("throws clear error when HEIC conversion fails", async () => {
    const corruptHeic = new Uint8Array([0xde, 0xad, 1, 2]);
    await expect(processImageUpload(corruptHeic, "image/heic", "bad.heic")).rejects.toThrow(
      "Không thể chuyển đổi ảnh HEIC sang JPEG",
    );
  });

  it("passes through PNG images", async () => {
    const png = new Uint8Array([1, 2, 3, 4]);
    const res = await processImageUpload(png, "image/png", "test.png");
    expect(res.contentType).toBe("image/png");
    expect(res.ext).toBe("png");
    expect(res.data).toBe(png);
  });

  it("passes through JPEG images", async () => {
    const jpg = new Uint8Array([1, 2, 3, 4]);
    const res = await processImageUpload(jpg, "image/jpeg", "test.jpg");
    expect(res.contentType).toBe("image/jpeg");
    expect(res.ext).toBe("jpg");
    expect(res.data).toBe(jpg);
  });

  it("passes through WebP images", async () => {
    const webp = new Uint8Array([1, 2, 3, 4]);
    const res = await processImageUpload(webp, "image/webp", "test.webp");
    expect(res.contentType).toBe("image/webp");
    expect(res.ext).toBe("webp");
    expect(res.data).toBe(webp);
  });

  it("passes through SVG images", async () => {
    const svg = new Uint8Array([1, 2, 3, 4]);
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
