import type { DocumentItemSummary } from "../server/event-types";
import { renderEmailLayout, type EmailFourLinesSummary } from "./base-layout";

export function renderResultEmail({
  summary4Lines,
  docCode,
  title,
  badgeText = "THÔNG BÁO",
  badgeBg = "#059669",
  badgeColor = "#ffffff",
  badgeBorder,
  summary,
  details = {},
  items,
  ctaText = "Xem chi tiết",
  ctaUrl,
}: {
  summary4Lines: EmailFourLinesSummary;
  docCode?: string | null;
  title: string;
  badgeText?: string;
  badgeBg?: string;
  badgeColor?: string;
  badgeBorder?: string;
  summary: string;
  details?: Record<string, string | number | undefined | null>;
  items?: DocumentItemSummary[] | null;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  const rows = Object.entries(details)
    .filter(([_, val]) => val !== undefined && val !== null && String(val).trim() !== "")
    .map(([label, val]) => `<tr><td class="label">${label}</td><td class="value">${val}</td></tr>`)
    .join("");

  const upperBadge = badgeText.toUpperCase();
  let bannerBg = "#ecfdf5";
  let bannerBorder = "#10b981";
  let bannerColor = "#065f46";

  if (upperBadge.includes("TỪ CHỐI") || upperBadge.includes("BỊ TỪ CHỐI") || upperBadge.includes("THẤT BẠI")) {
    bannerBg = "#fef2f2";
    bannerBorder = "#ef4444";
    bannerColor = "#991b1b";
  } else if (upperBadge.includes("HỦY")) {
    bannerBg = "#f4f4f5";
    bannerBorder = "#71717a";
    bannerColor = "#3f3f46";
  } else if (upperBadge.includes("CẤP PHÁT") || upperBadge.includes("XUẤT KHO") || upperBadge.includes("BÀN GIAO") || upperBadge.includes("NHIÊN LIỆU")) {
    bannerBg = "#fff7ed";
    bannerBorder = "#ea580c";
    bannerColor = "#9a3412";
  }

  const bodyHtml = `
    <div style="background: ${bannerBg}; border-left: 4px solid ${bannerBorder}; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; color: ${bannerColor}; font-weight: 500; line-height: 1.5;">
      ${summary}
    </div>
    ${rows ? `<table class="info-table">${rows}</table>` : ""}
  `;

  return renderEmailLayout({
    summary4Lines,
    docCode,
    badgeText,
    badgeBg,
    badgeColor,
    badgeBorder,
    title,
    bodyHtml,
    items,
    ctaText,
    ctaUrl,
  });
}
