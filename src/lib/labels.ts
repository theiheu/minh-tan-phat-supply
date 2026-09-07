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
  draft: "Chờ duyệt đặt hàng",
  approved: "Đã duyệt (Chờ hàng về)",
  posted: "Đã nhập kho",
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
  defect_collect_in: "Thu đồ hỏng về kho",
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
  | "orange"
  | "success"
  | "danger"
  | "violet";

export const STATUS_BADGE_VARIANTS: Record<string, StatusBadgeVariant> = {
  draft: "neutral",
  pending: "warning",
  approved: "info",
  issued: "orange",
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

/**
 * Chuyển trạng thái DB (tiếng Anh) thành nhãn tiếng Việt theo loại phiếu.
 */
export function slipStatusLabel(entityType: string | null | undefined, status: string | null | undefined): string {
  if (!status) return "—";
  const t = entityType?.toLowerCase().trim() ?? "";
  if (t.startsWith("requisition")) return REQUISITION_STATUS[status] ?? status;
  if (t.startsWith("receipt")) return RECEIPT_STATUS[status] ?? status;
  if (t.startsWith("issue")) return ISSUE_STATUS[status] ?? status;
  if (t.startsWith("exchange")) return EXCHANGE_STATUS[status] ?? status;
  if (t.startsWith("defect")) return DEFECT_STATUS[status] ?? status;
  if (t.startsWith("repair")) return REPAIR_STATUS[status] ?? status;
  if (t.startsWith("liquidation")) return LIQUIDATION_STATUS[status] ?? status;
  if (t.startsWith("stocktake")) return STOCKTAKE_STATUS[status] ?? status;
  return (
    REQUISITION_STATUS[status] ??
    RECEIPT_STATUS[status] ??
    ISSUE_STATUS[status] ??
    EXCHANGE_STATUS[status] ??
    DEFECT_STATUS[status] ??
    LIQUIDATION_STATUS[status] ??
    REPAIR_STATUS[status] ??
    STOCKTAKE_STATUS[status] ??
    status
  );
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

// Map nhãn và tone cho nhật ký hoạt động (audit_logs)
export const AUDIT_ACTION_INFO: Record<string, { label: string; tone: StatusBadgeVariant; entityLabel?: string }> = {
  // Phiếu yêu cầu
  "requisition.create": { label: "Tạo phiếu yêu cầu", tone: "info", entityLabel: "Phiếu yêu cầu" },
  "requisition.submit": { label: "Gửi phiếu yêu cầu", tone: "warning", entityLabel: "Phiếu yêu cầu" },
  "requisition.approve": { label: "Duyệt phiếu yêu cầu", tone: "info", entityLabel: "Phiếu yêu cầu" },
  "requisition.fulfill": { label: "Cấp phát vật tư", tone: "warning", entityLabel: "Phiếu yêu cầu" },
  "requisition.receive": { label: "Xác nhận nhận hàng", tone: "success", entityLabel: "Phiếu yêu cầu" },
  "requisition.reject": { label: "Từ chối phiếu yêu cầu", tone: "danger", entityLabel: "Phiếu yêu cầu" },
  "requisition.cancel": { label: "Hủy phiếu yêu cầu", tone: "neutral", entityLabel: "Phiếu yêu cầu" },
  "requisition.return": { label: "Trả lại vật tư", tone: "info", entityLabel: "Phiếu yêu cầu" },
  "requisition.revert": { label: "Hoàn tác phiếu yêu cầu", tone: "warning", entityLabel: "Phiếu yêu cầu" },
  "requisition.delete": { label: "Xóa phiếu yêu cầu", tone: "danger", entityLabel: "Phiếu yêu cầu" },

  // Nhập kho / Đặt hàng
  "receipt.create": { label: "Tạo phiếu đặt hàng", tone: "info", entityLabel: "Phiếu đặt hàng" },
  "receipt.submit": { label: "Gửi đơn đặt hàng", tone: "warning", entityLabel: "Phiếu đặt hàng" },
  "receipt.approve": { label: "Duyệt đơn đặt hàng", tone: "info", entityLabel: "Phiếu đặt hàng" },
  "receipt.post": { label: "Nhập kho", tone: "success", entityLabel: "Phiếu nhập kho" },
  "receipt.reject": { label: "Từ chối đặt hàng", tone: "danger", entityLabel: "Phiếu đặt hàng" },
  "receipt.cancel": { label: "Hủy phiếu nhập", tone: "neutral", entityLabel: "Phiếu nhập kho" },
  "receipt.update": { label: "Cập nhật phiếu nhập", tone: "info", entityLabel: "Phiếu nhập kho" },
  "receipt.update_notes": { label: "Cập nhật ghi chú", tone: "neutral", entityLabel: "Phiếu nhập kho" },
  "receipt.update_invoices": { label: "Cập nhật hóa đơn/ảnh", tone: "neutral", entityLabel: "Phiếu nhập kho" },
  "receipt.revert": { label: "Hoàn tác nhập kho", tone: "warning", entityLabel: "Phiếu nhập kho" },
  "receipt.delete": { label: "Xóa phiếu nhập", tone: "danger", entityLabel: "Phiếu nhập kho" },

  // Xuất kho
  "issue.create": { label: "Tạo phiếu xuất kho", tone: "info", entityLabel: "Phiếu xuất kho" },
  "issue.post": { label: "Xuất kho", tone: "success", entityLabel: "Phiếu xuất kho" },
  "issue.cancel": { label: "Hủy phiếu xuất kho", tone: "neutral", entityLabel: "Phiếu xuất kho" },
  "issue.update_invoices": { label: "Cập nhật ảnh hóa đơn", tone: "neutral", entityLabel: "Phiếu xuất kho" },
  "issue.revert": { label: "Hoàn tác xuất kho", tone: "warning", entityLabel: "Phiếu xuất kho" },
  "issue.delete": { label: "Xóa phiếu xuất kho", tone: "danger", entityLabel: "Phiếu xuất kho" },

  // Đổi mới
  "exchange.create": { label: "Tạo phiếu đổi mới", tone: "info", entityLabel: "Phiếu đổi mới" },
  "exchange.approve": { label: "Duyệt phiếu đổi mới", tone: "info", entityLabel: "Phiếu đổi mới" },
  "exchange.issue": { label: "Cấp phát đổi mới", tone: "success", entityLabel: "Phiếu đổi mới" },
  "exchange.receive": { label: "Xác nhận nhận đổi mới", tone: "success", entityLabel: "Phiếu đổi mới" },
  "exchange.reject": { label: "Từ chối đổi mới", tone: "danger", entityLabel: "Phiếu đổi mới" },
  "exchange.cancel": { label: "Hủy phiếu đổi mới", tone: "neutral", entityLabel: "Phiếu đổi mới" },

  // Báo hỏng
  "defect.create": { label: "Báo hỏng vật tư", tone: "warning", entityLabel: "Phiếu báo hỏng" },
  "defect.record": { label: "Báo hỏng vật tư", tone: "warning", entityLabel: "Phiếu báo hỏng" },
  "defect.inspect": { label: "Kiểm tra đồ hỏng", tone: "info", entityLabel: "Phiếu báo hỏng" },
  "defect.collect": { label: "Thu đồ hỏng về kho", tone: "success", entityLabel: "Phiếu báo hỏng" },
  "defect.request_repair": { label: "Yêu cầu sửa chữa", tone: "warning", entityLabel: "Phiếu báo hỏng" },
  "defect.cancel_repair_request": { label: "Hủy yêu cầu sửa chữa", tone: "neutral", entityLabel: "Phiếu báo hỏng" },
  "defect.update_images": { label: "Cập nhật ảnh hỏng", tone: "neutral", entityLabel: "Phiếu báo hỏng" },
  "defect.cancel": { label: "Hủy báo hỏng", tone: "neutral", entityLabel: "Phiếu báo hỏng" },
  "defect.delete": { label: "Xóa phiếu báo hỏng", tone: "danger", entityLabel: "Phiếu báo hỏng" },

  // Sửa chữa
  "repair.create": { label: "Tạo phiếu sửa chữa", tone: "info", entityLabel: "Phiếu sửa chữa" },
  "repair.send": { label: "Đưa đi sửa chữa", tone: "warning", entityLabel: "Phiếu sửa chữa" },
  "repair.complete": { label: "Hoàn tất sửa chữa", tone: "success", entityLabel: "Phiếu sửa chữa" },
  "repair.cancel": { label: "Hủy phiếu sửa chữa", tone: "neutral", entityLabel: "Phiếu sửa chữa" },
  "repair.revert": { label: "Hoàn tác sửa chữa", tone: "warning", entityLabel: "Phiếu sửa chữa" },
  "repair.delete": { label: "Xóa phiếu sửa chữa", tone: "danger", entityLabel: "Phiếu sửa chữa" },

  // Thanh lý
  "liquidation.create": { label: "Tạo phiếu thanh lý", tone: "info", entityLabel: "Phiếu thanh lý" },
  "liquidation.approve": { label: "Duyệt thanh lý", tone: "info", entityLabel: "Phiếu thanh lý" },
  "liquidation.complete": { label: "Hoàn tất thanh lý", tone: "success", entityLabel: "Phiếu thanh lý" },
  "liquidation.reject": { label: "Từ chối thanh lý", tone: "danger", entityLabel: "Phiếu thanh lý" },
  "liquidation.cancel": { label: "Hủy phiếu thanh lý", tone: "neutral", entityLabel: "Phiếu thanh lý" },
  "liquidation.revert": { label: "Hoàn tác thanh lý", tone: "warning", entityLabel: "Phiếu thanh lý" },
  "liquidation.delete": { label: "Xóa phiếu thanh lý", tone: "danger", entityLabel: "Phiếu thanh lý" },

  // Kiểm kê
  "stocktake.create": { label: "Tạo đợt kiểm kê", tone: "info", entityLabel: "Đợt kiểm kê" },
  "stocktake.post": { label: "Chốt kiểm kê", tone: "success", entityLabel: "Đợt kiểm kê" },
  "stocktake.cancel": { label: "Hủy đợt kiểm kê", tone: "neutral", entityLabel: "Đợt kiểm kê" },
  "stocktake.update_notes": { label: "Cập nhật ghi chú kiểm kê", tone: "neutral", entityLabel: "Đợt kiểm kê" },
  "stocktake.revert": { label: "Hoàn tác kiểm kê", tone: "warning", entityLabel: "Đợt kiểm kê" },
  "stocktake.delete": { label: "Xóa đợt kiểm kê", tone: "danger", entityLabel: "Đợt kiểm kê" },

  // Kho & Tài khoản
  transfer: { label: "Điều chuyển kho", tone: "info", entityLabel: "Kho" },
  "stock.transfer": { label: "Điều chuyển kho", tone: "info", entityLabel: "Kho" },
  adjust: { label: "Điều chỉnh tồn kho", tone: "warning", entityLabel: "Kho" },
  "stock.adjust": { label: "Điều chỉnh tồn kho", tone: "warning", entityLabel: "Kho" },
  "user.create": { label: "Tạo tài khoản", tone: "info", entityLabel: "Tài khoản" },
  "user.update": { label: "Cập nhật tài khoản", tone: "info", entityLabel: "Tài khoản" },
  "user.deactivate": { label: "Khóa tài khoản", tone: "warning", entityLabel: "Tài khoản" },
  "user.activate": { label: "Kích hoạt tài khoản", tone: "success", entityLabel: "Tài khoản" },
  "user.delete": { label: "Xóa tài khoản", tone: "danger", entityLabel: "Tài khoản" },
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  requisition: "Phiếu yêu cầu",
  requisitions: "Phiếu yêu cầu",
  receipt: "Phiếu đặt hàng / nhập kho",
  receipts: "Phiếu đặt hàng / nhập kho",
  issue: "Phiếu xuất kho",
  issues: "Phiếu xuất kho",
  exchange: "Phiếu đổi mới",
  exchange_note: "Phiếu đổi mới",
  exchange_notes: "Phiếu đổi mới",
  defect: "Phiếu báo hỏng",
  defect_note: "Phiếu báo hỏng",
  defect_notes: "Phiếu báo hỏng",
  repair: "Phiếu sửa chữa",
  repair_order: "Phiếu sửa chữa",
  repair_orders: "Phiếu sửa chữa",
  liquidation: "Phiếu thanh lý",
  liquidation_note: "Phiếu thanh lý",
  liquidation_notes: "Phiếu thanh lý",
  stocktake: "Đợt kiểm kê",
  stocktake_session: "Đợt kiểm kê",
  stocktake_sessions: "Đợt kiểm kê",
  profile: "Tài khoản",
  profiles: "Tài khoản",
  user: "Tài khoản",
  stock: "Tồn kho",
};

export function auditActionLabel(action: string | null | undefined): string {
  if (!action) return "—";
  return AUDIT_ACTION_INFO[action]?.label ?? action;
}

export function auditActionTone(action: string | null | undefined): StatusBadgeVariant {
  if (!action) return "neutral";
  return AUDIT_ACTION_INFO[action]?.tone ?? "neutral";
}

export function auditEntityLabel(entityType: string | null | undefined, action?: string | null): string {
  if (action && AUDIT_ACTION_INFO[action]?.entityLabel) {
    return AUDIT_ACTION_INFO[action].entityLabel!;
  }
  if (!entityType) return "—";
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType;
}

export function auditEntityHref(entityType: string | null | undefined, entityId: string | null | undefined): string | null {
  if (!entityId) return null;
  const t = entityType?.toLowerCase();
  if (!t) return null;
  if (t === "requisition" || t === "requisitions") return `/requisitions/${entityId}`;
  if (t === "receipt" || t === "receipts") return `/receipts/${entityId}`;
  if (t === "issue" || t === "issues") return `/issues/${entityId}`;
  if (t.startsWith("exchange")) return `/exchanges/${entityId}`;
  if (t.startsWith("defect")) return `/defects/${entityId}`;
  if (t.startsWith("repair")) return `/repairs/${entityId}`;
  if (t.startsWith("liquidation")) return `/liquidations/${entityId}`;
  if (t.startsWith("stocktake")) return `/stocktake/${entityId}`;
  if (t === "profile" || t === "profiles" || t === "user") return `/admin`;
  return null;
}

