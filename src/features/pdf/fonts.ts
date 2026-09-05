import { existsSync } from "node:fs";
import { join } from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Đăng ký font tiếng Việt cho react-pdf.
 *
 * Font chuẩn của PDF (Helvetica, ...) không có glyph dấu tiếng Việt (ế, ơ, ạ, đ…)
 * nên mọi phiếu in phải dùng font TTF có hỗ trợ tiếng Việt — Roboto (public/fonts).
 *
 * Chỉ chạy trên server (route handler); gọi 1 lần trước renderToBuffer.
 */
let registered = false;

const FONT_FILES: { file: string; weight: "normal" | "bold" }[] = [
  { file: "Roboto-Regular.ttf", weight: "normal" },
  { file: "Roboto-Bold.ttf", weight: "bold" },
];

function resolveFontDir(): string {
  // Chạy từ thư mục dự án (dev: `bun run dev`; prod: Docker WORKDIR /app có public/).
  const candidates = [join(process.cwd(), "public", "fonts")];
  for (const dir of candidates) {
    if (FONT_FILES.every((f) => existsSync(join(dir, f.file)))) return dir;
  }
  throw new Error(
    `Thiếu font PDF tiếng Việt tại public/fonts (${candidates.join(", ")}). ` +
      "Roboto-Regular.ttf + Roboto-Bold.ttf bắt buộc để in đúng dấu tiếng Việt.",
  );
}

export function ensurePdfFonts(): void {
  if (registered) return;
  const dir = resolveFontDir();
  Font.register({
    family: "Roboto",
    fonts: FONT_FILES.map(({ file, weight }) => ({
      src: join(dir, file),
      fontWeight: weight,
    })),
  });
  registered = true;
}
