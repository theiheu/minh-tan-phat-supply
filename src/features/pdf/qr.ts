import QRCode from "qrcode";

/**
 * Tạo chuỗi base64 Data URI cho mã QR dạng ảnh PNG để nhúng trực tiếp vào react-pdf.
 */
export async function generateQrDataUri(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 160,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}

/**
 * Xây dựng URL tuyệt đối dẫn tới phiếu từ Request và đường dẫn tương đối.
 */
export function getSlipUrl(req: Request, path: string): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  let origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin && host) {
    const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
    origin = `${proto}://${host}`;
  }
  if (!origin) {
    try {
      origin = new URL(req.url).origin;
    } catch {
      origin = "http://localhost:3000";
    }
  }
  const cleanOrigin = origin.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanOrigin}${cleanPath}`;
}
