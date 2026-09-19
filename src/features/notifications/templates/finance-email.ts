import type { DocumentItemSummary } from "../server/event-types";
import { renderEmailLayout, type EmailFourLinesSummary } from "./base-layout";

function formatVND(amount?: number | null): string {
  if (amount === undefined || amount === null) return "0 ₫";
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

export function renderFinanceEmail({
  summary4Lines,
  docCode,
  title,
  summary,
  details = {},
  items,
  totalAmount,
  invoiceNumber,
  ctaText = "Kiểm tra chứng từ",
  ctaUrl,
}: {
  summary4Lines: EmailFourLinesSummary;
  docCode?: string | null;
  title: string;
  summary: string;
  details?: Record<string, string | number | undefined | null>;
  items?: DocumentItemSummary[] | null;
  totalAmount?: number;
  invoiceNumber?: string;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  const rows = Object.entries(details)
    .filter(([_, val]) => val !== undefined && val !== null && String(val).trim() !== "")
    .map(([label, val]) => `<tr><td class="label">${label}</td><td class="value">${val}</td></tr>`)
    .join("");

  const financeBlock = totalAmount !== undefined
    ? `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin: 18px 0; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 13px; color: #166534; font-weight: 600;">Tổng giá trị giao dịch:</span>
        <span style="font-size: 18px; color: #15803d; font-weight: 800;">${formatVND(totalAmount)}</span>
      </div>`
    : "";

  const invoiceRow = invoiceNumber
    ? `<tr><td class="label">Số hóa đơn / Chứng từ:</td><td class="value" style="color: #ea580c; font-weight: 700;">${invoiceNumber}</td></tr>`
    : "";

  const bodyHtml = `
    <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; font-size: 14px; color: #166534; font-weight: 500; line-height: 1.5;">
      ${summary}
    </div>
    ${financeBlock}
    <table class="info-table">
      ${invoiceRow}
      ${rows}
    </table>
  `;

  return renderEmailLayout({
    summary4Lines,
    docCode,
    badgeText: "KIỂM TRA CHỨNG TỪ TÀI CHÍNH",
    badgeBg: "#059669",
    badgeColor: "#ffffff",
    title,
    bodyHtml,
    items,
    ctaText,
    ctaUrl,
  });
}
