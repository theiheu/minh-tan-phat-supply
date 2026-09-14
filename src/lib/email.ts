import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getServerEnv, getPublicEnv } from "./env";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface DocumentItemSummary {
  name: string;
  quantity: number | string;
  unit?: string | null;
  note?: string | null;
}

export type DocumentStatusVariant = "warning" | "success" | "danger" | "info" | "neutral";

export interface DocumentInfo {
  code?: string | null;
  type?: string | null;
  status?: string | null;
  statusVariant?: DocumentStatusVariant;
  creatorName?: string | null;
  handlerName?: string | null;
  locationName?: string | null;
  departmentOrZone?: string | null;
  notes?: string | null;
  items?: DocumentItemSummary[] | null;
  totalAmount?: number | string | null;
  expectedDate?: string | null;
}

export interface NotificationEmailParams {
  title: string;
  body?: string | null;
  link?: string | null;
  recipientName?: string | null;
  document?: DocumentInfo | null;
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;

  let env;
  try {
    env = getServerEnv();
  } catch {
    // Nếu chạy trong môi trường test hoặc chưa có server env đầy đủ
    env = {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      SMTP_SECURE: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : undefined,
      SMTP_FROM: process.env.SMTP_FROM,
    };
  }

  const host = env.SMTP_HOST || process.env.SMTP_HOST;
  const port = env.SMTP_PORT || (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587);
  const user = env.SMTP_USER || process.env.SMTP_USER;
  const pass = env.SMTP_PASS || process.env.SMTP_PASS;
  const secure =
    env.SMTP_SECURE !== undefined
      ? Boolean(env.SMTP_SECURE)
      : process.env.SMTP_SECURE === "true"
        ? true
        : port === 465;

  if (!host) {
    return null;
  }

  const auth = user && pass ? { user, pass } : undefined;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });

  return cachedTransporter;
}

export function isEmailConfigured(): boolean {
  const host = process.env.SMTP_HOST;
  return Boolean(host && host.trim().length > 0);
}

/** Tên người gửi chuẩn doanh nghiệp MTP-ERP */
export const DEFAULT_ERP_FROM = '"Công Ty TNHH Minh Tân Phát (MTP-ERP)" <no-reply@minhtanphat.vn>';
export const DEFAULT_ERN_FROM = DEFAULT_ERP_FROM; // Alias hỗ trợ

export async function sendEmail(options: SendEmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  reason?: string;
  error?: unknown;
}> {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      if (process.env.NODE_ENV !== "test") {
        console.log(`[Email] SMTP chưa được cấu hình. Bỏ qua gửi email tới: ${Array.isArray(options.to) ? options.to.join(", ") : options.to}`);
      }
      return { success: false, reason: "SMTP_NOT_CONFIGURED" };
    }

    let defaultFrom = DEFAULT_ERP_FROM;
    try {
      const env = getServerEnv();
      if (env.SMTP_FROM) defaultFrom = env.SMTP_FROM;
    } catch {
      if (process.env.SMTP_FROM) defaultFrom = process.env.SMTP_FROM;
    }

    const recipients = Array.isArray(options.to) ? options.to.filter(Boolean).join(", ") : options.to;
    if (!recipients) {
      return { success: false, reason: "NO_RECIPIENTS" };
    }

    const info = await transporter.sendMail({
      from: defaultFrom,
      to: recipients,
      subject: options.subject,
      text: options.text || options.html.replace(/<[^>]*>?/gm, ""),
      html: options.html,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email] Lỗi khi gửi email:", error);
    return { success: false, error };
  }
}

/** Helper tự động phân tích mã chứng từ từ chuỗi text */
function extractDocCode(title: string, body?: string | null): string | null {
  const text = `${title} ${body || ""}`;
  const match = text.match(/(?:YCCP|PNK|PXK|PBH|PDM|PMDC|PSC|PKK|PTL|PDC|PNNL|PCNL|REQ|DM|HONG|TB|SC|TL)-[A-Za-z0-9_-]+/i)
    || text.match(/(?:Phiếu|chứng từ|Đổi Mới)s+([A-Za-z0-9_-]+)/i);
  return match ? match[0].replace(/^Phiếus+/i, "").replace(/^chứng từs+/i, "").trim() : null;
}

/** Helper tự động phát hiện trạng thái nghiệp vụ và màu sắc nhận diện */
function detectStatusInfo(title: string, body?: string | null, customVariant?: DocumentStatusVariant): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  const combined = `${title} ${body || ""}`.toLowerCase();

  if (customVariant === "warning" || combined.includes("chờ duyệt") || combined.includes("chờ xử lý") || combined.includes("chờ phê duyệt") || combined.includes("tập kết") || combined.includes("tiếp nhận")) {
    return { label: "CHỜ PHÊ DUYỆT", bg: "#fff7ed", text: "#c2410c", border: "#ffedd5" };
  }
  if (customVariant === "success" || combined.includes("đã được duyệt") || combined.includes("đã duyệt") || combined.includes("đã hoàn tất") || combined.includes("đã nhận hàng") || combined.includes("đã chốt") || combined.includes("thành công") || combined.includes("hoàn tất")) {
    return { label: "ĐÃ PHÊ DUYỆT / HOÀN TẤT", bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" };
  }
  if (customVariant === "info" || combined.includes("đã cấp phát") || combined.includes("đã xuất kho") || combined.includes("đã xuất cấp") || combined.includes("đã bàn giao") || combined.includes("đang mượn") || combined.includes("trả lại") || combined.includes("thu hồi")) {
    return { label: "ĐÃ XUẤT KHO / CẤP PHÁT", bg: "#ffedd5", text: "#9a3412", border: "#fed7aa" };
  }
  if (customVariant === "danger" || combined.includes("từ chối") || combined.includes("bị từ chối") || combined.includes("không duyệt")) {
    return { label: "BỊ TỪ CHỐI", bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" };
  }
  if (customVariant === "neutral" || combined.includes("đã hủy") || combined.includes("hủy bỏ") || combined.includes("hủy phiếu")) {
    return { label: "ĐÃ HỦY BỎ", bg: "#f4f4f5", text: "#52525b", border: "#e4e4e7" };
  }

  return { label: "THÔNG BÁO HỆ THỐNG", bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" };
}

/**
 * Render email HTML chuẩn nhận diện website Công Ty TNHH Minh Tân Phát - MTP-ERP:
 * - Màu chủ đạo: Cam Đất (#ea580c / Terracotta) chuẩn website
 * - Header thương hiệu: CÔNG TY TNHH MINH TÂN PHÁT | MTP-ERP
 * - Badge mã chứng từ và trạng thái rõ ràng
 * - Bảng thông tin chứng từ chi tiết (metadata card)
 * - Bảng danh sách vật tư (nếu có)
 * - Nút hành động trực tiếp vào hệ thống MTP-ERP
 * - Footer nhật ký kiểm toán & Bản quyền
 */
export function renderNotificationEmailHtml(params: NotificationEmailParams): string {
  let siteUrl = "https://minhtanphat.io.vn";
  try {
    const pubEnv = getPublicEnv();
    if (pubEnv.NEXT_PUBLIC_SITE_URL) siteUrl = pubEnv.NEXT_PUBLIC_SITE_URL;
  } catch {
    if (process.env.NEXT_PUBLIC_SITE_URL) siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  }
  siteUrl = siteUrl.replace(/\/+$/, "");

  const greeting = params.recipientName
    ? `Kính gửi Ông/Bà <strong>${params.recipientName}</strong>,`
    : "Kính gửi Quý nhân sự,";

  const actionUrl = params.link
    ? params.link.startsWith("http")
      ? params.link
      : `${siteUrl}${params.link.startsWith("/") ? params.link : `/${params.link}`}`
    : null;

  const now = new Date();
  const nowStr = now.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  const doc = params.document || {};
  const docCode = doc.code || extractDocCode(params.title, params.body);
  const statusInfo = detectStatusInfo(params.title, params.body, doc.statusVariant);
  const displayStatus = doc.status ? doc.status.toUpperCase() : statusInfo.label;

  // Xây dựng các hàng thông tin chi tiết chứng từ
  const detailRows: Array<{ label: string; value: string }> = [];

  if (docCode) {
    detailRows.push({ label: "Mã chứng từ / Phiếu", value: `<strong style="color: #ea580c; font-family: monospace, sans-serif; font-size: 15px; letter-spacing: 0.5px;">${docCode}</strong>` });
  }
  if (doc.type) {
    detailRows.push({ label: "Phân hệ / Loại nghiệp vụ", value: doc.type });
  }
  detailRows.push({ label: "Thời điểm ghi nhận", value: `${nowStr} (ICT - GMT+7)` });
  if (doc.creatorName) {
    detailRows.push({ label: "Người lập / Khởi tạo", value: doc.creatorName });
  }
  if (doc.handlerName) {
    detailRows.push({ label: "Người xử lý / Phê duyệt", value: doc.handlerName });
  }
  if (doc.locationName || doc.departmentOrZone) {
    detailRows.push({ label: "Khu vực / Trại / Điểm giao", value: doc.locationName || doc.departmentOrZone || "" });
  }
  if (doc.expectedDate) {
    detailRows.push({ label: "Hạn trả / Ngày dự kiến", value: doc.expectedDate });
  }
  if (doc.totalAmount != null) {
    const formattedAmount = typeof doc.totalAmount === "number" ? doc.totalAmount.toLocaleString("vi-VN") + " đ" : String(doc.totalAmount);
    detailRows.push({ label: "Tổng giá trị", value: `<strong style="color: #ea580c;">${formattedAmount}</strong>` });
  }
  if (doc.notes) {
    detailRows.push({ label: "Diễn giải / Ghi chú / Lý do", value: doc.notes });
  }

  // Bảng danh sách mặt hàng (nếu có)
  let itemsTableHtml = "";
  if (doc.items && doc.items.length > 0) {
    const rows = doc.items
      .map(
        (it, idx) => `
      <tr style="border-bottom: 1px solid #e7e5e4; ${idx % 2 === 1 ? "background-color: #fafaf9;" : ""}">
        <td style="padding: 8px 10px; text-align: center; font-size: 12px; color: #78716c;">${idx + 1}</td>
        <td style="padding: 8px 10px; font-size: 13px; font-weight: 500; color: #1c1917;">${it.name}</td>
        <td style="padding: 8px 10px; text-align: right; font-size: 13px; font-weight: 700; color: #ea580c;">${it.quantity}</td>
        <td style="padding: 8px 10px; font-size: 12px; color: #57534e;">${it.unit || "-"}</td>
        ${it.note ? `<td style="padding: 8px 10px; font-size: 12px; color: #78716c; font-style: italic;">${it.note}</td>` : ""}
      </tr>`
      )
      .join("");

    itemsTableHtml = `
    <div style="margin-top: 18px;">
      <div style="font-size: 13px; font-weight: 700; color: #292524; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Danh mục vật tư / chi tiết:</div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e7e5e4; border-radius: 6px; overflow: hidden; font-size: 13px;">
        <thead>
          <tr style="background-color: #f5f5f4; border-bottom: 1px solid #d6d3d1; color: #292524;">
            <th style="padding: 8px 10px; text-align: center; font-size: 12px; font-weight: 600; width: 35px;">STT</th>
            <th style="padding: 8px 10px; text-align: left; font-size: 12px; font-weight: 600;">Tên vật tư / Quy cách</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 12px; font-weight: 600; width: 65px;">SL</th>
            <th style="padding: 8px 10px; text-align: left; font-size: 12px; font-weight: 600; width: 50px;">ĐVT</th>
            <th style="padding: 8px 10px; text-align: left; font-size: 12px; font-weight: 600;">Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
  }

  const metadataTableHtml = detailRows.length > 0
    ? `
    <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px;">
      ${detailRows
        .map(
          (r, idx) => `
        <tr style="border-bottom: 1px solid ${idx === detailRows.length - 1 ? "transparent" : "#f5f5f4"};">
          <td style="padding: 7px 0; color: #78716c; width: 38%; vertical-align: top;">${r.label}:</td>
          <td style="padding: 7px 0; color: #1c1917; font-weight: 500; vertical-align: top;">${r.value}</td>
        </tr>`
        )
        .join("")}
    </table>`
    : "";

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #fafaf9;
      color: #1c1917;
      margin: 0;
      padding: 24px 12px;
      line-height: 1.5;
    }
    .erp-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(28, 25, 23, 0.08);
      border: 1px solid #e7e5e4;
    }
    .erp-header {
      background: linear-gradient(135deg, #1c1917 0%, #292524 100%);
      border-top: 4px solid #ea580c;
      padding: 22px 24px;
      color: #ffffff;
      text-align: center;
    }
    .erp-header .brand-title {
      margin: 0;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.8px;
      color: #ffffff;
      text-transform: uppercase;
    }
    .erp-header .erp-badge {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 12px;
      background-color: rgba(234, 88, 12, 0.2);
      border: 1px solid rgba(234, 88, 12, 0.6);
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
      color: #fb923c;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .erp-header .sub-title {
      margin: 6px 0 0 0;
      font-size: 12px;
      color: #a8a29e;
    }
    .erp-status-bar {
      background-color: #f5f5f4;
      border-bottom: 1px solid #e7e5e4;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    .erp-content {
      padding: 24px;
    }
    .greeting {
      font-size: 14px;
      color: #292524;
      margin-bottom: 8px;
    }
    .intro-text {
      font-size: 13px;
      color: #78716c;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .notification-card {
      background-color: #fafaf9;
      border-left: 4px solid #ea580c;
      border-top: 1px solid #e7e5e4;
      border-right: 1px solid #e7e5e4;
      border-bottom: 1px solid #e7e5e4;
      padding: 16px 18px;
      border-radius: 6px;
      margin: 16px 0;
    }
    .notification-title {
      font-size: 15px;
      font-weight: 700;
      color: #1c1917;
      margin-bottom: 6px;
    }
    .notification-body {
      font-size: 13px;
      color: #44403c;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .action-btn-wrap {
      text-align: center;
      margin: 28px 0 16px 0;
    }
    .action-btn {
      display: inline-block;
      background-color: #ea580c;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.3px;
      box-shadow: 0 3px 8px rgba(234, 88, 12, 0.35);
    }
    .erp-footer {
      border-top: 1px solid #e7e5e4;
      background-color: #f5f5f4;
      padding: 18px 24px;
      font-size: 11px;
      color: #78716c;
      line-height: 1.6;
    }
    .erp-footer p {
      margin: 4px 0;
    }
    .erp-footer .audit-note {
      color: #a8a29e;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="erp-container">
    <div class="erp-header">
      <div class="brand-title">CÔNG TY TNHH MINH TÂN PHÁT</div>
      <div class="erp-badge">MTP-ERP</div>
      <div class="sub-title">Quản lý Kho vận & Cung ứng Vật tư</div>
    </div>

    <table style="width: 100%; border-collapse: collapse; background-color: #f5f5f4; border-bottom: 1px solid #e7e5e4; padding: 10px 24px;">
      <tr>
        <td style="padding: 10px 24px; font-size: 12px; color: #57534e; text-align: left;">
          ${docCode ? `MÃ CHỨNG TỪ: <strong style="color: #1c1917; font-family: monospace, sans-serif; font-size: 13px;">${docCode}</strong>` : `CHỨNG TỪ ĐIỆN TỬ`}
        </td>
        <td style="padding: 10px 24px; text-align: right;">
          <span style="display: inline-block; padding: 4px 10px; background-color: ${statusInfo.bg}; color: ${statusInfo.text}; border: 1px solid ${statusInfo.border}; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">
            ${displayStatus}
          </span>
        </td>
      </tr>
    </table>

    <div class="erp-content">
      <div class="greeting">${greeting}</div>
      <p class="intro-text">Hệ thống MTP-ERP xin trân trọng thông báo về tiến trình xử lý chứng từ giao dịch sau:</p>

      <div class="notification-card">
        <div class="notification-title">${params.title}</div>
        ${params.body ? `<div class="notification-body">${params.body}</div>` : ""}
        ${metadataTableHtml}
      </div>

      ${itemsTableHtml}

      ${
        actionUrl
          ? `
      <div class="action-btn-wrap">
        <a href="${actionUrl}" class="action-btn" target="_blank" rel="noopener noreferrer">
          XEM CHI TIẾT TRÊN HỆ THỐNG MTP-ERP &rarr;
        </a>
      </div>
      `
          : ""
      }
    </div>

    <div class="erp-footer">
      <p style="font-weight: 700; color: #292524;">CÔNG TY TNHH MINH TÂN PHÁT - MTP-ERP</p>
      <p class="audit-note">&#128274; Chứng từ điện tử được xác thực và ghi nhận tự động trên hệ thống MTP-ERP. Mọi thay đổi đều được lưu vết trong Nhật ký Kiểm toán (Audit Trail).</p>
      <p>&#9993; Đây là email thông báo tự động từ hệ thống. Vui lòng không phản hồi trực tiếp vào địa chỉ email này.</p>
      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #d6d3d1; font-size: 10px; color: #a8a29e; display: flex; justify-content: space-between;">
        <span>Thời gian phát hành: ${nowStr}</span>
        <span style="float: right;">&copy; ${now.getFullYear()} Công Ty TNHH Minh Tân Phát</span>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
