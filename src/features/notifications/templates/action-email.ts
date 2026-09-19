import type { DocumentItemSummary } from "../server/event-types";
import { renderEmailLayout, type EmailFourLinesSummary } from "./base-layout";

export function renderActionEmail({
  summary4Lines,
  docCode,
  title,
  instructions,
  details = {},
  items,
  ctaText = "Mở phiếu để xử lý",
  ctaUrl,
}: {
  summary4Lines: EmailFourLinesSummary;
  docCode?: string | null;
  title: string;
  instructions: string;
  details?: Record<string, string | number | undefined | null>;
  items?: DocumentItemSummary[] | null;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  const rows = Object.entries(details)
    .filter(([_, val]) => val !== undefined && val !== null && String(val).trim() !== "")
    .map(([label, val]) => `<tr><td class="label">${label}</td><td class="value">${val}</td></tr>`)
    .join("");

  const bodyHtml = `
    <div style="background: #fff7ed; border-left: 4px solid #ea580c; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; color: #9a3412; font-weight: 500; line-height: 1.5;">
      ${instructions}
    </div>
    ${rows ? `<table class="info-table">${rows}</table>` : ""}
  `;

  return renderEmailLayout({
    summary4Lines,
    docCode,
    badgeText: "CẦN XỬ LÝ",
    badgeBg: "#ea580c",
    badgeColor: "#ffffff",
    title,
    bodyHtml,
    items,
    ctaText,
    ctaUrl,
  });
}
