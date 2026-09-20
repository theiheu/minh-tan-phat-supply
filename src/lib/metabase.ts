import crypto from "node:crypto";

export interface MetabaseDashboardConfig {
  id: string;
  numericId: number;
  title: string;
  category: "executive" | "operations" | "inventory" | "fleet" | "maintenance";
  description: string;
  recommendedRole: string[];
  defaultParams?: Record<string, string | number | boolean>;
}

export const METABASE_DASHBOARDS: MetabaseDashboardConfig[] = [
  {
    id: "executive-overview",
    numericId: 1,
    title: "Tổng Quan Ban Giám Đốc (Executive KPIs)",
    category: "executive",
    description: "Chỉ số tổng hợp MTD: Giá trị tài sản tồn kho, chi phí xuất kho, nhập hàng NCC, dầu Diesel và sự cố cơ điện.",
    recommendedRole: ["superuser", "owner", "accountant", "warehouse"],
  },
  {
    id: "subzone-costs",
    numericId: 2,
    title: "Phân Bổ Chi Phí Theo Dãy Trại & Khu Vực",
    category: "operations",
    description: "So sánh chi phí vật tư tiêu hao (thuốc sát trùng, bóng sưởi, cám...) giữa các Trại A1, A2, B1, B2 theo thời gian.",
    recommendedRole: ["superuser", "owner", "accountant", "technician", "warehouse"],
  },
  {
    id: "inventory-health",
    numericId: 3,
    title: "Sức Khỏe Kho & Cảnh Báo An Toàn (XNT)",
    category: "inventory",
    description: "Giám sát tồn kho thực tế, SKU dưới mức an toàn (Safety Stock), tồn kho chết (Dead Stock) và giá trị lưu kho.",
    recommendedRole: ["superuser", "owner", "warehouse", "accountant"],
  },
  {
    id: "fuel-fleet",
    numericId: 4,
    title: "Trạm Bồn Dầu & Đội Xe Cơ Giới",
    category: "fleet",
    description: "Định mức tiêu hao L/100km (xe tải) & L/h máy (máy xúc, máy phát), phát hiện bất thường và tồn bồn Diesel.",
    recommendedRole: ["superuser", "owner", "driver", "warehouse", "technician"],
  },
  {
    id: "defects-maintenance",
    numericId: 5,
    title: "Sự Cố Thiết Bị & Chi Phí Sửa Chữa Ngoài",
    category: "maintenance",
    description: "Tần suất hỏng hóc Motor quạt hút, máy bơm, tủ điện; thời gian sửa chữa và so sánh chi phí sửa vs mua mới.",
    recommendedRole: ["superuser", "owner", "technician", "warehouse"],
  },
  {
    id: "procurement-suppliers",
    numericId: 6,
    title: "Mua Hàng & Biến Động Giá Nhà Cung Cấp",
    category: "inventory",
    description: "Lịch sử biến động đơn giá nhập của từng SKU, hóa đơn VAT, thời gian giao hàng và cơ cấu nhà cung cấp.",
    recommendedRole: ["superuser", "owner", "accountant", "warehouse"],
  },
  {
    id: "tool-borrowings",
    numericId: 7,
    title: "Mượn Trả Dụng Cụ Đồ Nghề & Cảnh Báo Quá Hạn",
    category: "maintenance",
    description: "Theo dõi tủ đồ nghề dùng chung (máy hàn, máy khoan, thang nhôm), tỷ lệ trả đúng hạn và cảnh báo quá hạn.",
    recommendedRole: ["superuser", "owner", "warehouse", "technician"],
  },
];

function base64url(input: string | Buffer): string {
  const base64 = Buffer.isBuffer(input) ? input.toString("base64") : Buffer.from(input).toString("base64");
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function generateMetabaseEmbedToken(
  dashboardNumericId: number,
  params: Record<string, string | number | boolean> = {},
  expiresInSeconds = 3600 // 1 hour
): string {
  const secret = process.env.METABASE_SECRET_KEY;
  if (!secret) throw new Error("Metabase embedding is not configured");
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    resource: { dashboard: dashboardNumericId },
    params,
    exp: Math.round(Date.now() / 1000) + expiresInSeconds,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const encodedSignature = base64url(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export function getMetabaseSiteUrl(): string {
  const siteUrl = process.env.METABASE_SITE_URL || process.env.NEXT_PUBLIC_METABASE_SITE_URL;
  if (!siteUrl) throw new Error("Metabase site URL is not configured");
  return siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
}

export interface MetabaseEmbedOptions {
  dashboardNumericId: number;
  params?: Record<string, string | number | boolean>;
  bordered?: boolean;
  titled?: boolean;
  theme?: "light" | "dark" | "transparent";
}

export function getMetabaseEmbedUrl({
  dashboardNumericId,
  params = {},
  bordered = true,
  titled = true,
  theme = "light",
}: MetabaseEmbedOptions): string {
  const siteUrl = getMetabaseSiteUrl();
  const token = generateMetabaseEmbedToken(dashboardNumericId, params);
  const hashParams = new URLSearchParams();
  if (bordered) hashParams.set("bordered", "true");
  if (titled) hashParams.set("titled", "true");
  if (theme !== "light") hashParams.set("theme", theme);

  const hashStr = hashParams.toString() ? `#${hashParams.toString()}` : "";
  return `${siteUrl}/embed/dashboard/${token}${hashStr}`;
}
