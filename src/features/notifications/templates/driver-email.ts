import { renderEmailLayout, type EmailFourLinesSummary } from "./base-layout";

function formatNumber(val?: number | null): string {
  if (val === undefined || val === null) return "";
  return new Intl.NumberFormat("vi-VN").format(val);
}

export function renderDriverEmail({
  summary4Lines,
  docCode,
  title,
  vehicleCode,
  vehicleName,
  fuelTypeName,
  quantity,
  unit,
  currentOdo,
  odoUnit,
  zoneName,
  dispenserName,
  notes,
  ctaText = "Xem phiếu cấp nhiên liệu",
  ctaUrl,
}: {
  summary4Lines: EmailFourLinesSummary;
  docCode?: string | null;
  title: string;
  vehicleCode?: string;
  vehicleName?: string;
  fuelTypeName: string;
  quantity: number;
  unit: string;
  currentOdo?: number;
  odoUnit?: string;
  zoneName?: string;
  dispenserName?: string;
  notes?: string;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  const odoDisplay = currentOdo ? `${formatNumber(currentOdo)} ${odoUnit ?? "km"}` : undefined;

  const details: Record<string, string | undefined> = {
    "Phương tiện / Máy móc:": vehicleCode ? `${vehicleCode} (${vehicleName ?? ""})` : vehicleName,
    "Loại nhiên liệu:": fuelTypeName,
    "Số lượng cấp phát:": `${formatNumber(quantity)} ${unit}`,
    "Chỉ số ODO / Giờ máy:": odoDisplay,
    "Khu vực cấp:": zoneName,
    "Người thực hiện cấp:": dispenserName,
    "Ghi chú:": notes,
  };

  const rows = Object.entries(details)
    .filter(([_, val]) => val !== undefined && val.trim() !== "")
    .map(([label, val]) => `<tr><td class="label">${label}</td><td class="value">${val}</td></tr>`)
    .join("");

  const summary = `Xác nhận cấp phát ${formatNumber(quantity)} ${unit} ${fuelTypeName} cho phương tiện ${vehicleCode ?? ""}.`;

  const bodyHtml = `
    <div style="background: #fff7ed; border-left: 4px solid #ea580c; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; font-size: 14px; color: #9a3412; font-weight: 500; line-height: 1.5;">
      ${summary}
    </div>
    <table class="info-table">
      ${rows}
    </table>
  `;

  return renderEmailLayout({
    summary4Lines,
    docCode,
    badgeText: "CẤP PHÁT NHIÊN LIỆU",
    badgeBg: "#ea580c",
    badgeColor: "#ffffff",
    title,
    bodyHtml,
    ctaText,
    ctaUrl,
  });
}
