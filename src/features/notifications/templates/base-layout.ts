import type { DocumentItemSummary } from "../server/event-types";

export interface EmailFourLinesSummary {
  /** Dòng 1: Hành động & Người liên quan */
  actionLine: string;
  /** Dòng 2: Mã phiếu & Khu vực / Đối tác */
  codeAndLocationLine: string;
  /** Dòng 3: Danh mục vật tư / Thiết bị tóm tắt */
  itemsSummaryLine: string;
  /** Dòng 4: Mục đích / Lý do / Ghi chú */
  purposeOrNoteLine?: string;
}

export interface EmailLayoutOptions {
  summary4Lines: EmailFourLinesSummary;
  docCode?: string | null;
  badgeText: string;
  badgeBg?: string;
  badgeColor?: string;
  badgeBorder?: string;
  title: string;
  bodyHtml?: string;
  items?: DocumentItemSummary[] | null;
  ctaText?: string;
  ctaUrl?: string;
}

export function formatItemsToSummaryString(items?: DocumentItemSummary[] | null, fallback?: string): string {
  if (items && items.length > 0) {
    return items.map((i) => `${i.quantity}${i.unit ? ` ${i.unit}` : ""} ${i.name}`).join(", ");
  }
  return fallback || "Chi tiết trong phiếu";
}

export function renderItemsTableHtml(items?: DocumentItemSummary[] | null): string {
  if (!items || items.length === 0) return "";

  const hasNotes = items.some((it) => it.note && it.note.trim().length > 0);

  const rows = items
    .map((it, idx) => {
      const isEven = idx % 2 === 1;
      const bgStyle = isEven ? "background-color: #fafaf9;" : "background-color: #ffffff;";
      return `
      <tr style="border-bottom: 1px solid #e7e5e4; ${bgStyle}">
        <td style="padding: 10px 12px; text-align: center; font-size: 12px; color: #78716c;">${idx + 1}</td>
        <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #1c1917;">${it.name}</td>
        <td style="padding: 10px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #ea580c;">${it.quantity}</td>
        <td style="padding: 10px 12px; font-size: 12px; color: #57534e;">${it.unit || "-"}</td>
        ${hasNotes ? `<td style="padding: 10px 12px; font-size: 12px; color: #78716c; font-style: italic;">${it.note || ""}</td>` : ""}
      </tr>`;
    })
    .join("");

  return `
    <div style="margin-top: 24px;">
      <div style="font-size: 12px; font-weight: 700; color: #44403c; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
        Chi tiết danh mục vật tư (${items.length} mục):
      </div>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #e7e5e4; border-radius: 8px; overflow: hidden; font-size: 13px;">
        <thead>
          <tr style="background-color: #f5f5f4; border-bottom: 1px solid #d6d3d1; color: #44403c;">
            <th style="padding: 9px 12px; text-align: center; font-size: 12px; font-weight: 700; width: 36px;">STT</th>
            <th style="padding: 9px 12px; text-align: left; font-size: 12px; font-weight: 700;">Tên vật tư / Thiết bị</th>
            <th style="padding: 9px 12px; text-align: right; font-size: 12px; font-weight: 700; width: 70px;">Số lượng</th>
            <th style="padding: 9px 12px; text-align: left; font-size: 12px; font-weight: 700; width: 50px;">ĐVT</th>
            ${hasNotes ? `<th style="padding: 9px 12px; text-align: left; font-size: 12px; font-weight: 700;">Ghi chú</th>` : ""}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

export function renderEmailLayout({
  summary4Lines,
  docCode: _docCode,
  badgeText,
  badgeBg = "#ea580c",
  badgeColor = "#ffffff",
  badgeBorder,
  title,
  bodyHtml = "",
  items,
  ctaText,
  ctaUrl,
}: EmailLayoutOptions): string {
  const borderStyle = badgeBorder ? `border: 1px solid ${badgeBorder};` : "";

  // Chuỗi xem trước cho thanh thông báo điện thoại / danh sách hộp thư đến (Preheader)
  const preheaderText = [
    summary4Lines.actionLine,
    summary4Lines.codeAndLocationLine,
    summary4Lines.itemsSummaryLine,
    summary4Lines.purposeOrNoteLine,
  ]
    .filter(Boolean)
    .join(" • ");

  const previewPadding = "&#847;&zwnj;&nbsp;".repeat(40);
  const itemsTableHtml = renderItemsTableHtml(items);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafaf9; color: #1c1917; margin: 0; padding: 20px 12px; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e7e5e4; overflow: hidden; box-shadow: 0 4px 16px rgba(28, 25, 23, 0.06); }
    .content { padding: 20px 24px; }
    
    /* Khung tóm tắt 4 dòng hiển thị ưu tiên hàng đầu */
    .summary-box {
      background-color: #fff7ed;
      border: 1px solid #fed7aa;
      border-left: 5px solid #ea580c;
      border-radius: 8px;
      padding: 16px 18px;
      margin-bottom: 20px;
    }
    .summary-line {
      font-size: 13px;
      line-height: 1.6;
      color: #292524;
      margin-bottom: 8px;
    }
    .summary-line:last-child {
      margin-bottom: 0;
    }
    .summary-line strong {
      color: #1c1917;
    }
    .summary-line .tag {
      display: inline-block;
      font-weight: 700;
      color: #ea580c;
      margin-right: 4px;
    }
    .subject-title { margin: 0 0 14px; font-size: 16px; font-weight: 700; color: #1c1917; line-height: 1.4; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .info-table td { padding: 7px 0; border-bottom: 1px solid #f5f5f4; vertical-align: top; }
    .info-table td.label { width: 36%; color: #78716c; font-weight: 500; }
    .info-table td.value { color: #1c1917; font-weight: 600; }
    .btn-wrap { text-align: center; margin: 28px 0 10px; }
    .btn { display: inline-block; padding: 12px 28px; background-color: #ea580c; color: #ffffff !important; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; letter-spacing: 0.3px; box-shadow: 0 3px 8px rgba(234, 88, 12, 0.25); }
    .footer { padding: 16px 24px; background: #f5f5f4; border-top: 1px solid #e7e5e4; font-size: 11px; color: #78716c; text-align: center; line-height: 1.6; }
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

  <div class="container">
    <!-- Header thương hiệu chuẩn Minh Tân Phát - ERP và Badge căn chỉnh vững chắc không bị vỡ dòng -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse; background-color: #1c1917; border-top: 4px solid #ea580c;">
      <tr>
        <td valign="middle" align="left" style="padding: 14px 20px; vertical-align: middle;">
          <div style="font-size: 15px; font-weight: 800; color: #ea580c; letter-spacing: 0.5px; text-transform: uppercase; margin: 0; line-height: 1.2;">
            MINH TÂN PHÁT - ERP
          </div>
          <div style="font-size: 11px; color: #a8a29e; margin-top: 3px; line-height: 1.2;">Hệ Thống MTP-ERP</div>
        </td>
        <td valign="middle" align="right" style="padding: 14px 20px; text-align: right; vertical-align: middle; white-space: nowrap;">
          <span style="display: inline-block; padding: 5px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; border-radius: 20px; letter-spacing: 0.4px; background-color: ${badgeBg}; color: ${badgeColor}; ${borderStyle} white-space: nowrap;">
            ${badgeText}
          </span>
        </td>
      </tr>
    </table>

    <div class="content">
      <!-- 4 DÒNG THÔNG TIN CỤ THỂ HIỂN THỊ ĐẦU TIÊN -->
      <div class="summary-box">
        <div class="summary-line" style="font-size: 14px; font-weight: 700; color: #9a3412;">
          ${summary4Lines.actionLine}
        </div>
        <div class="summary-line">
          <span class="tag">📄 Phiếu & Nơi nhận:</span>
          <strong>${summary4Lines.codeAndLocationLine}</strong>
        </div>
        <div class="summary-line">
          <span class="tag">📦 Vật tư:</span>
          ${summary4Lines.itemsSummaryLine}
        </div>
        ${
          summary4Lines.purposeOrNoteLine
            ? `<div class="summary-line">
                <span class="tag">📝 Ghi chú / Mục đích:</span>
                ${summary4Lines.purposeOrNoteLine}
              </div>`
            : ""
        }
      </div>

      ${bodyHtml}
      ${itemsTableHtml}

      ${
        ctaText && ctaUrl
          ? `<div class="btn-wrap"><a href="${ctaUrl}" class="btn" target="_blank">${ctaText} &rarr;</a></div>`
          : ""
      }
    </div>

    <div class="footer">
      <div style="font-weight: 700; color: #292524; margin-bottom: 2px;">CÔNG TY TNHH MINH TÂN PHÁT - ERP</div>
      <div>Email này được gửi tự động từ Hệ thống MTP-ERP. Vui lòng không phản hồi trực tiếp qua email này.</div>
    </div>
  </div>
</body>
</html>`;
}
