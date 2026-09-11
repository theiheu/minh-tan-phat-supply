/**
 * Định dạng hiển thị Khu vực và Trại/Xưởng trực thuộc theo chuẩn:
 * - Nếu có cả Khu và Trại: "Khu 1 - Trại 1" (hoặc "Khu 4 - Xưởng phân")
 * - Nếu chỉ có Khu: "Khu 1"
 * - Nếu không có: "—" (hoặc chuỗi fallback tuỳ chọn)
 */
export function formatZoneLabel(
  zone?: { name?: string | null } | string | null,
  subZone?: { name?: string | null } | string | null,
  fallback = "—"
): string {
  const zoneName = typeof zone === "string" ? zone.trim() : zone?.name?.trim() || "";
  const subZoneName = typeof subZone === "string" ? subZone.trim() : subZone?.name?.trim() || "";

  if (zoneName && subZoneName) {
    return `${zoneName} - ${subZoneName}`;
  }
  if (zoneName) {
    return zoneName;
  }
  if (subZoneName) {
    return subZoneName;
  }
  return fallback;
}
