import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getServerEnv, getPublicEnv } from "./env";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface NotificationEmailParams {
  title: string;
  body?: string | null;
  link?: string | null;
  recipientName?: string | null;
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

    let defaultFrom = '"Minh Tân Phát - Kho & Cấp Phát" <no-reply@minhtanphat.vn>';
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

export function renderNotificationEmailHtml(params: NotificationEmailParams): string {
  let siteUrl = "https://minhtanphat.io.vn";
  try {
    const pubEnv = getPublicEnv();
    if (pubEnv.NEXT_PUBLIC_SITE_URL) siteUrl = pubEnv.NEXT_PUBLIC_SITE_URL;
  } catch {
    if (process.env.NEXT_PUBLIC_SITE_URL) siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  }
  siteUrl = siteUrl.replace(/\/+$/, "");

  const greeting = params.recipientName ? `Xin chào <strong>${params.recipientName}</strong>,` : "Xin chào,";
  const actionUrl = params.link
    ? params.link.startsWith("http")
      ? params.link
      : `${siteUrl}${params.link.startsWith("/") ? params.link : `/${params.link}`}`
    : null;

  const nowStr = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f6f8;
      color: #1f2937;
      margin: 0;
      padding: 24px 12px;
      line-height: 1.5;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #e5e7eb;
    }
    .header {
      background-color: #059669;
      padding: 20px 24px;
      color: #ffffff;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .header p {
      margin: 4px 0 0 0;
      font-size: 13px;
      opacity: 0.9;
    }
    .content {
      padding: 24px;
    }
    .greeting {
      font-size: 15px;
      margin-bottom: 16px;
    }
    .notification-card {
      background-color: #f9fafb;
      border-left: 4px solid #059669;
      padding: 16px;
      border-radius: 4px;
      margin: 16px 0;
    }
    .notification-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 6px;
    }
    .notification-body {
      font-size: 14px;
      color: #4b5563;
      white-space: pre-wrap;
    }
    .action-btn-wrap {
      text-align: center;
      margin: 28px 0 16px 0;
    }
    .action-btn {
      display: inline-block;
      background-color: #059669;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 2px 4px rgba(5, 150, 105, 0.3);
    }
    .footer {
      border-top: 1px solid #f3f4f6;
      background-color: #fafafa;
      padding: 16px 24px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MINH TÂN PHÁT</h1>
      <p>Hệ thống Quản lý Kho & Cấp phát Vật tư</p>
    </div>
    <div class="content">
      <div class="greeting">${greeting}</div>
      <p style="font-size: 14px; color: #374151; margin-top: 0;">Bạn có một thông báo mới từ hệ thống:</p>
      
      <div class="notification-card">
        <div class="notification-title">${params.title}</div>
        ${params.body ? `<div class="notification-body">${params.body}</div>` : ""}
      </div>

      ${
        actionUrl
          ? `
      <div class="action-btn-wrap">
        <a href="${actionUrl}" class="action-btn" target="_blank" rel="noopener noreferrer">Xem chi tiết trên hệ thống &rarr;</a>
      </div>
      `
          : ""
      }
    </div>
    <div class="footer">
      <p>Thời gian gửi: ${nowStr}</p>
      <p>Đây là email thông báo tự động từ hệ thống. Vui lòng không trả lời email này.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
