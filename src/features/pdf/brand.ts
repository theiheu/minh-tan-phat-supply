// Hằng số thương hiệu + logo (đọc file public/brand/logo.jpg → data URI, cache).
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export const BRAND = {
  name: "TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG",
  address: "Ấp Tân Tiến, xã Minh Tân, huyện Dầu Tiếng, tỉnh Bình Dương",
  phone: "SĐT: 0988 365 238 – 0963 077 879",
};

let cachedLogo: string | null | undefined;
export function brandLogoDataUri(): string | null {
  if (cachedLogo !== undefined) return cachedLogo;
  const pngPath = path.join(process.cwd(), "public", "brand", "logo.png");
  if (existsSync(pngPath)) {
    cachedLogo = `data:image/png;base64,${readFileSync(pngPath).toString("base64")}`;
    return cachedLogo;
  }
  const jpgPath = path.join(process.cwd(), "public", "brand", "logo.jpg");
  if (existsSync(jpgPath)) {
    cachedLogo = `data:image/jpeg;base64,${readFileSync(jpgPath).toString("base64")}`;
    return cachedLogo;
  }
  cachedLogo = null;
  return null;
}
