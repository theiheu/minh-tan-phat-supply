// Label map (mục 7.2): enum tiếng Anh (DB) → nhãn tiếng Việt (UI).
// Không hardcode tiếng Việt trong logic — dùng map này.
import type { LucideIcon } from "lucide-react";
import { Hammer, Home, Package, Pill, Shield, Sparkles, Wheat, Wrench } from "lucide-react";

export const REQUISITION_STATUS: Record<string, string> = {
  draft: "Nháp",
  pending: "Đang chờ",
  approved: "Đã duyệt",
  issued: "Đã cấp phát",
  received: "Đã nhận",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

export const EXCHANGE_STATUS: Record<string, string> = {
  pending: "Đang chờ",
  approved: "Đã duyệt",
  issued: "Đã cấp phát",
  received: "Đã nhận",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

export const RECEIPT_STATUS: Record<string, string> = {
  draft: "Nháp",
  posted: "Đã ghi nhận",
  cancelled: "Đã hủy",
};

export const ISSUE_DESTINATION: Record<string, string> = {
  zone: "Nội bộ khu",
  customer: "Bán cho khách",
};

export const ISSUE_STATUS: Record<string, string> = {
  draft: "Nháp",
  posted: "Đã xuất",
  cancelled: "Đã hủy",
};

export const DEFECT_STATUS: Record<string, string> = {
  staging: "Đang tập kết",
  in_repair: "Đang sửa",
  returned: "Đã nhập lại",
  liquidated: "Đã thanh lý",
  cancelled: "Đã hủy",
};

export const REPAIR_STATUS: Record<string, string> = {
  in_repair: "Đang sửa",
  returned: "Đã về",
  cancelled: "Đã hủy",
};

export const LIQUIDATION_STATUS: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  completed: "Hoàn tất",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

export const LIQUIDATION_METHOD: Record<string, string> = {
  sale: "Bán",
  dispose: "Tiêu hủy",
};

export const REQUISITION_TYPE: Record<string, string> = {
  new_supply: "Cấp mới",
  replacement: "Đổi mới",
};

export const STOCKTAKE_STATUS: Record<string, string> = {
  draft: "Nháp",
  posted: "Đã chốt",
  cancelled: "Đã hủy",
};

export const SEVERITY_LEVEL: Record<string, string> = {
  light: "Nhẹ",
  medium: "Vừa",
  severe: "Nặng",
};

export const DAMAGE_TYPE: Record<string, string> = {
  cracked: "Nứt",
  chipped: "Mẻ",
  broken: "Gãy",
  worn: "Mòn",
  electrical: "Hỏng điện",
  chemical: "Hỏng hóa chất",
  other: "Khác",
};

export const DEFECT_RESOLUTION: Record<string, string> = {
  repaired: "Đã sửa",
  liquidated: "Đã thanh lý",
};

export const REPAIR_OUTCOME: Record<string, string> = {
  returned_to_stock: "Nhập lại kho",
  liquidation: "Thanh lý",
};

export const MOVEMENT_TYPE: Record<string, string> = {
  receipt_in: "Nhập kho",
  requisition_out: "Cấp phát",
  return_in: "Nhập trả lại",
  defect_out: "Chuyển kho hỏng",
  repair_out: "Đưa đi sửa",
  repair_return_in: "Nhập lại kho (sửa xong)",
  exchange_out: "Cấp đổi mới",
  liquidation_out: "Thanh lý",
  adjustment_in: "Điều chỉnh +",
  adjustment_out: "Điều chỉnh -",
  transfer: "Chuyển kho",
};

export const LOCATION_TYPE: Record<string, string> = {
  main: "Kho chính",
  defect: "Kho hỏng",
  repair: "Đang sửa",
  other: "Khác",
};

// Variant badge trạng thái (mục 12.1): draft/cancelled=neutral (xám),
// pending/staging=warning (vàng), approved/in_repair=info (xanh dương),
// issued/posted/returned/received/completed=success (xanh lá), rejected=danger (đỏ).
export type StatusBadgeVariant =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "danger";

export const STATUS_BADGE_VARIANTS: Record<string, StatusBadgeVariant> = {
  draft: "neutral",
  pending: "warning",
  approved: "info",
  issued: "success",
  received: "success",
  rejected: "danger",
  cancelled: "neutral",
  posted: "success",
  staging: "warning",
  in_repair: "info",
  returned: "success",
  liquidated: "neutral",
  completed: "success",
};

export function statusBadgeVariant(key: string | null | undefined): StatusBadgeVariant {
  if (!key) return "neutral";
  return STATUS_BADGE_VARIANTS[key] ?? "neutral";
}

// Icon danh mục (key lưu trong categories.icon: 'feed', 'medicine', ...).
export const categoryIcons: Record<string, LucideIcon> = {
  feed: Wheat,
  medicine: Pill,
  tool: Wrench,
  coop: Home,
  clean: Sparkles,
  ppe: Shield,
  repair: Hammer,
  other: Package,
};

export function categoryIcon(key: string | null | undefined): LucideIcon {
  if (!key) return Package;
  return categoryIcons[key] ?? Package;
}

// Nhãn biến thể: nối các giá trị attributes (VD {"Trọng lượng":"Bao 10kg"} → "Bao 10kg").
export function variantLabel(attributes: unknown, unit?: string | null): string {
  if (attributes && typeof attributes === "object" && !Array.isArray(attributes)) {
    const values = Object.values(attributes as Record<string, unknown>).filter(
      (v) => typeof v === "string" && v.length > 0,
    );
    if (values.length > 0) return values.join(" · ");
  }
  return unit ?? "—";
}

// Nhãn vai trò tài khoản (UI) — tránh ternary rải rác.
export const ROLE_LABELS: Record<string, string> = {
  requester: "Người yêu cầu",
  manager: "Quản lý kho",
  superuser: "Quản trị hệ thống",
};

export function roleLabel(role: string | null | undefined): string {
  if (role && role in ROLE_LABELS) return ROLE_LABELS[role];
  return "—";
}
