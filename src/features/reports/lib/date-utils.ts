import type { DatePreset } from "../types";

export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Hôm nay" },
  { id: "7days", label: "7 ngày qua" },
  { id: "this_month", label: "Tháng này" },
  { id: "last_month", label: "Tháng trước" },
  { id: "this_quarter", label: "Quý này" },
  { id: "this_year", label: "Năm nay" },
  { id: "custom", label: "Tùy chọn ngày" },
];

/**
 * Format date to YYYY-MM-DD using local time
 */
export function toYmd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calculate from and to date ranges for standard presets
 */
export function getPresetRange(
  preset: DatePreset,
  now: Date = new Date()
): { from: string; to: string } {
  switch (preset) {
    case "today": {
      const today = toYmd(now);
      return { from: today, to: today };
    }
    case "7days": {
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 6
      );
      return { from: toYmd(start), to: toYmd(now) };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: toYmd(start), to: toYmd(end) };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toYmd(start), to: toYmd(end) };
    }
    case "this_quarter": {
      const quarterIndex = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarterIndex * 3, 1);
      const end = new Date(now.getFullYear(), quarterIndex * 3 + 3, 0);
      return { from: toYmd(start), to: toYmd(end) };
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { from: toYmd(start), to: toYmd(end) };
    }
    case "custom":
    default: {
      const today = toYmd(now);
      return { from: today, to: today };
    }
  }
}
