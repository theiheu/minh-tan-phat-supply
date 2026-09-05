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

export const RECEIPT_STATUS: Record<string, string> = {
  draft: "Nháp",
  posted: "Đã ghi nhận",
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

// Màu badge trạng thái (mục 12.1): draft/cancelled=gray, pending=amber,
// approved=sky, issued/completed/posted/returned=emerald, received=teal, rejected=red.
export const STATUS_BADGE_CLASSES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-sky-100 text-sky-700",
  issued: "bg-emerald-100 text-emerald-700",
  received: "bg-teal-100 text-teal-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
  posted: "bg-emerald-100 text-emerald-700",
  staging: "bg-amber-100 text-amber-700",
  in_repair: "bg-sky-100 text-sky-700",
  returned: "bg-emerald-100 text-emerald-700",
  liquidated: "bg-gray-100 text-gray-600",
  completed: "bg-emerald-100 text-emerald-700",
};

export function statusLabel(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return map[key] ?? key;
}

export function statusBadgeClass(key: string | null | undefined): string {
  if (!key) return "bg-gray-100 text-gray-600";
  return STATUS_BADGE_CLASSES[key] ?? "bg-gray-100 text-gray-600";
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
