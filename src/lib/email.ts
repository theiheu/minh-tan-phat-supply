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
    env = {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      SMTP_FROM: process.env.SMTP_FROM,
      SMTP_SECURE: process.env.SMTP_SECURE === "true",
    };
  }

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }

  const port = env.SMTP_PORT || 587;
  const isSecure = env.SMTP_SECURE !== undefined ? env.SMTP_SECURE : port === 465;

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: isSecure,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return cachedTransporter;
}

export function isEmailConfigured(): boolean {
  try {
    const env = getServerEnv();
    return Boolean(env.SMTP_HOST);
  } catch {
    return Boolean(process.env.SMTP_HOST);
  }
}

export const DEFAULT_ERP_FROM = '"MTP-ERP Minh Tân Phát" <noreply@minhtanphat.io.vn>';
export const DEFAULT_ERN_FROM = DEFAULT_ERP_FROM;

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

function extractDocCode(title: string, body?: string | null): string | null {
  const text = `${title} ${body || ""}`;
  const match = text.match(/(?:YCCP|PNK|PXK|PBH|PSC|PTL|PKK|PMDC|PCNL|PNNL|PDM)-[A-Z0-9-]+/i);
  return match ? match[0].toUpperCase() : null;
}

function detectStatusInfo(title: string, body?: string | null, variant?: DocumentStatusVariant) {
  const text = `${title} ${body || ""}`.toLowerCase();

  if (variant === "danger" || text.includes("từ chối") || text.includes("hủy") || text.includes("bị từ chối") || text.includes("quá hạn")) {
    return {
      label: "BỊ TỪ CHỐI / ĐÃ HỦY",
      color: "#dc2626",
      bg: "#fef2f2",
      border: "#fca5a5",
      text: "#991b1b"
    };
  }

  if (variant === "warning" || text.includes("chờ duyệt") || text.includes("yêu cầu") || text.includes("cần xử lý") || text.includes("sắp hết hạn") || text.includes("báo hỏng")) {
    return {
      label: "CẦN XỬ LÝ",
      color: "#ea580c",
      bg: "#fff7ed",
      border: "#fdba74",
      text: "#9a3412"
    };
  }

  if (variant === "success" || text.includes("đã duyệt") || text.includes("hoàn tất") || text.includes("đã cấp") || text.includes("nhập kho") || text.includes("đã xuất") || text.includes("thành công")) {
    return {
      label: "ĐÃ HOÀN TẤT",
      color: "#059669",
      bg: "#ecfdf5",
      border: "#6ee7b7",
      text: "#065f46"
    };
  }

  return {
    label: "THÔNG BÁO",
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    text: "#9a3412"
  };
}

/**
 * Render email HTML chuẩn nhận diện website Công Ty TNHH Minh Tân Phát - MTP-ERP:
 * - 4 dòng thông tin cụ thể hiển thị ngay đầu email và trên thanh thông báo
 * - Danh mục bảng vật tư chi tiết
 * - Màu chủ đạo Cam Đất (#ea580c) đồng bộ website
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

  const doc = params.document || {};
  const docCode = doc.code || extractDocCode(params.title, params.body);
  const statusInfo = detectStatusInfo(params.title, params.body, doc.statusVariant);
  const displayStatus = doc.status ? doc.status.toUpperCase() : statusInfo.label;

  // 4 DÒNG THÔNG TIN CỤ THỂ
  const actionLine = `🔔 ${params.title}`;
  const locationOrPartner = doc.locationName || doc.departmentOrZone || "";
  const handlerStr = doc.handlerName ? ` (Người xử lý: ${doc.handlerName})` : "";
  const codeAndLocationLine = locationOrPartner
    ? `Mã: ${docCode || "CHỨNG TỪ"} | Khu vực / Nơi nhận: ${locationOrPartner}${handlerStr}`
    : `Mã phiếu: ${docCode || "CHỨNG TỪ"}${handlerStr}`;

  const itemsSummaryLine = doc.items && doc.items.length > 0
    ? doc.items.map((i) => `${i.quantity}${i.unit ? ` ${i.unit}` : ""} ${i.name}`).join(", ")
    : "Chi tiết trong phiếu";

  const purposeOrNoteLine = doc.notes || (params.body ? params.body : undefined);

  const preheaderText = [actionLine, codeAndLocationLine, `Vật tư: ${itemsSummaryLine}`, purposeOrNoteLine]
    .filter(Boolean)
    .join(" • ");
  const previewPadding = "&#847;&zwnj;&nbsp;".repeat(40);

  // Bảng danh sách mặt hàng (nếu có)
  let itemsTableHtml = "";
  if (doc.items && doc.items.length > 0) {
    const hasNotes = doc.items.some((it) => it.note && it.note.trim().length > 0);
    const rows = doc.items
      .map(
        (it, idx) => `
      <tr style="border-bottom: 1px solid #e7e5e4; ${idx % 2 === 1 ? "background-color: #fafaf9;" : ""}">
        <td style="padding: 9px 10px; text-align: center; font-size: 12px; color: #78716c;">${idx + 1}</td>
        <td style="padding: 9px 10px; font-size: 13px; font-weight: 600; color: #1c1917;">${it.name}</td>
        <td style="padding: 9px 10px; text-align: right; font-size: 13px; font-weight: 700; color: #ea580c;">${it.quantity}</td>
        <td style="padding: 9px 10px; font-size: 12px; color: #57534e;">${it.unit || "-"}</td>
        ${hasNotes ? `<td style="padding: 9px 10px; font-size: 12px; color: #78716c; font-style: italic;">${it.note || ""}</td>` : ""}
      </tr>`
      )
      .join("");

    itemsTableHtml = `
    <div style="margin-top: 22px;">
      <div style="font-size: 12px; font-weight: 700; color: #44403c; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
        Chi tiết danh mục vật tư (${doc.items.length} mục):
      </div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e7e5e4; border-radius: 8px; overflow: hidden; font-size: 13px;">
        <thead>
          <tr style="background-color: #f5f5f4; border-bottom: 1px solid #d6d3d1; color: #44403c;">
            <th style="padding: 9px 10px; text-align: center; font-size: 12px; font-weight: 700; width: 36px;">STT</th>
            <th style="padding: 9px 10px; text-align: left; font-size: 12px; font-weight: 700;">Tên vật tư / Thiết bị</th>
            <th style="padding: 9px 10px; text-align: right; font-size: 12px; font-weight: 700; width: 70px;">SL</th>
            <th style="padding: 9px 10px; text-align: left; font-size: 12px; font-weight: 700; width: 50px;">ĐVT</th>
            ${hasNotes ? `<th style="padding: 9px 10px; text-align: left; font-size: 12px; font-weight: 700;">Ghi chú</th>` : ""}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafaf9; color: #1c1917; margin: 0; padding: 20px 12px; line-height: 1.5; }
    .erp-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(28, 25, 23, 0.06); border: 1px solid #e7e5e4; }
    .summary-box { background-color: #fff7ed; border: 1px solid #fed7aa; border-left: 5px solid #ea580c; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px; }
    .summary-line { font-size: 13px; line-height: 1.6; color: #292524; margin-bottom: 8px; }
    .summary-line:last-child { margin-bottom: 0; }
    .summary-line strong { color: #1c1917; }
    .summary-line .tag { display: inline-block; font-weight: 700; color: #ea580c; margin-right: 4px; }
    .action-btn-wrap { text-align: center; margin: 28px 0 10px 0; }
    .action-btn { display: inline-block; background-color: #ea580c; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.3px; box-shadow: 0 3px 8px rgba(234, 88, 12, 0.25); }
    .erp-footer { border-top: 1px solid #e7e5e4; background-color: #f5f5f4; padding: 16px 24px; font-size: 11px; color: #78716c; text-align: center; line-height: 1.6; }
  </style>
</head>
<body>
  <!-- Preheader cho thanh thông báo -->
  <div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    ${preheaderText}
  </div>
  <div style="display:none;max-height:0px;overflow:hidden;mso-hide:all;">
    ${previewPadding}
  </div>

  <div class="erp-container">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse; background-color: #1c1917; border-top: 4px solid #ea580c;">
      <tr>
        <td valign="middle" align="left" style="padding: 14px 20px; vertical-align: middle;">
          <div style="font-size: 15px; font-weight: 800; color: #ea580c; letter-spacing: 0.5px; text-transform: uppercase; margin: 0; line-height: 1.2;">
            MINH TÂN PHÁT - ERP
          </div>
          <div style="font-size: 11px; color: #a8a29e; margin-top: 3px; line-height: 1.2;">Hệ Thống MTP-ERP</div>
        </td>
        <td valign="middle" align="right" style="padding: 14px 20px; text-align: right; vertical-align: middle; white-space: nowrap;">
          <span style="display: inline-block; padding: 5px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; border-radius: 20px; letter-spacing: 0.4px; background-color: ${statusInfo.bg}; color: ${statusInfo.text}; border: 1px solid ${statusInfo.border}; white-space: nowrap;">
            ${displayStatus}
          </span>
        </td>
      </tr>
    </table>

    <div style="padding: 20px 24px;">
      <div style="font-size: 13px; color: #44403c; margin-bottom: 12px;">${greeting}</div>
      <!-- 4 DÒNG THÔNG TIN CỤ THỂ HIỂN THỊ ĐẦU TIÊN -->
      <div class="summary-box">
        <div class="summary-line" style="font-size: 14px; font-weight: 700; color: #9a3412;">
          ${actionLine}
        </div>
        <div class="summary-line">
          <span class="tag">📄 Phiếu & Nơi nhận:</span>
          <strong>${codeAndLocationLine}</strong>
        </div>
        <div class="summary-line">
          <span class="tag">📦 Vật tư:</span>
          ${itemsSummaryLine}
        </div>
        ${
          purposeOrNoteLine
            ? `<div class="summary-line">
                <span class="tag">📝 Ghi chú / Mục đích:</span>
                ${purposeOrNoteLine}
              </div>`
            : ""
        }
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
      <div style="font-weight: 700; color: #292524; margin-bottom: 2px;">CÔNG TY TNHH MINH TÂN PHÁT - ERP</div>
      <div>Email này được gửi tự động từ Hệ thống MTP-ERP. Vui lòng không phản hồi trực tiếp qua email này.</div>
    </div>
  </div>
</body>
</html>`.trim();
}