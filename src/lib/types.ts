import type { Database } from "@/types/database.types";

export type Role =
  | "superuser"
  | "owner"
  | "accountant"
  | "warehouse"
  | "technician"
  | "requester"
  | "driver";

/** true nếu vai trò có quyền quản lý cấp cao / quản kho (warehouse, accountant, owner hoặc superuser). */
export function isPrivileged(role: string | null | undefined): boolean {
  return (
    role === "warehouse" ||
    role === "accountant" ||
    role === "owner" ||
    role === "superuser"
  );
}

/** true nếu là tài khoản superuser (quyền cao nhất). */
export function isSuperuser(role: string | null | undefined): boolean {
  return role === "superuser";
}

/** true nếu là chủ trại hoặc superuser. */
export function isOwner(role: string | null | undefined): boolean {
  return role === "owner" || role === "superuser";
}

/** true nếu là kế toán, chủ trại hoặc superuser. */
export function isAccountant(role: string | null | undefined): boolean {
  return role === "accountant" || role === "owner" || role === "superuser";
}

/** true nếu là quản kho, chủ trại hoặc superuser. */
export function isWarehouse(role: string | null | undefined): boolean {
  return (
    role === "warehouse" ||
    role === "owner" ||
    role === "superuser"
  );
}

/** true nếu là kỹ thuật (quản lý khu/cơ sở), quản kho, chủ trại hoặc superuser. */
export function isTechnician(role: string | null | undefined): boolean {
  return role === "technician" || isPrivileged(role);
}

/** true nếu là tài xế. */
export function isDriver(role: string | null | undefined): boolean {
  return role === "driver";
}

/** true nếu có quyền quản trị tài khoản người dùng (chỉ superuser / quản trị viên). */
export function canDeleteUsers(role: string | null | undefined): boolean {
  return role === "superuser";
}

/** true nếu có quyền quản trị viên/chủ trại/dev được xóa và mở lại phiếu (owner, superuser). */
export function canDeleteDoc(role: string | null | undefined): boolean {
  return role === "superuser" || role === "owner";
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type VariantRow = Database["public"]["Tables"]["skus"]["Row"];

/** Runtime projection for product catalog view. */
export type Product = Omit<ProductRow, "catalog_status" | "internal_notes" | "search_keywords"> & {
  options?: string[];
  categoryName?: string | null;
};
/** Runtime projection for SKU/variant with computed display fields. */
export type Variant = Omit<
  VariantRow,
  "allow_fraction" | "base_unit_id" | "inventory_policy" | "sku_code" | "sku_status" | "tracking_policy"
> & {
  unit?: string | null;
  attributes?: Record<string, string> | null;
  is_trackable_lot?: boolean;
};
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Zone = Database["public"]["Tables"]["zones"]["Row"];
export type SubZone = Database["public"]["Tables"]["sub_zones"]["Row"];
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type StockLocation = Database["public"]["Tables"]["stock_locations"]["Row"];
export type StockBalance = Database["public"]["Tables"]["stock_balances"]["Row"];
export type StockMovement = Database["public"]["Tables"]["stock_movements"]["Row"];
export type Requisition = Database["public"]["Tables"]["requisitions"]["Row"];
export type RequisitionItem = Database["public"]["Tables"]["requisition_items"]["Row"];
export type Receipt = Database["public"]["Tables"]["receipts"]["Row"];
export type ReceiptItem = Database["public"]["Tables"]["receipt_items"]["Row"];
export type Issue = Database["public"]["Tables"]["issues"]["Row"];
export type IssueItem = Database["public"]["Tables"]["issue_items"]["Row"];
/** Đích xuất kho: khu vực nội bộ (zone) hoặc khách hàng bên ngoài (customer). */
export type IssueDestinationType = "zone" | "customer";
export type DefectNote = Database["public"]["Tables"]["defect_notes"]["Row"];
export type DefectNoteItem = Database["public"]["Tables"]["defect_note_items"]["Row"];
export type RepairOrder = Database["public"]["Tables"]["repair_orders"]["Row"];
export type RepairOrderItem = Database["public"]["Tables"]["repair_order_items"]["Row"];
export type LiquidationNote = Database["public"]["Tables"]["liquidation_notes"]["Row"];
export type LiquidationItem = Database["public"]["Tables"]["liquidation_items"]["Row"];
export type StocktakeSession = Database["public"]["Tables"]["stocktake_sessions"]["Row"];
export type StocktakeItem = Database["public"]["Tables"]["stocktake_items"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type FuelType = Database["public"]["Tables"]["fuel_types"]["Row"];
export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type FuelReceipt = Database["public"]["Tables"]["fuel_receipts"]["Row"];
export type FuelDispense = Database["public"]["Tables"]["fuel_dispenses"]["Row"];
export type FuelMovement = Database["public"]["Tables"]["fuel_movements"]["Row"];
