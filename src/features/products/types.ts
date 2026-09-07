import type { Variant } from "@/lib/types";

export interface VariantWithStock extends Variant {
  stock: number;
  isComposite: boolean;
  /** Nếu là bộ: danh sách linh kiện (cùng vật tư) kèm định mức — dùng để hiển thị cấu tạo. */
  components?: { variantId: string; label: string; unit: string | null; quantity: number }[];
}

/** Một dòng biến thể (kèm tồn kho + cấu tạo bộ) dùng chung cho bảng quản trị và dialog quản lý biến thể. */
export interface AdminVariantRow {
  id: string;
  productId: string;
  /** Attributes dạng object đã parse từ jsonb. */
  attributes: Record<string, string> | null;
  /** Nhãn hiển thị (nối giá trị attributes; rơi về đơn vị). */
  label: string;
  price: number | null;
  images: string[];
  unit: string | null;
  minStock: number;
  isTrackableLot: boolean;
  isDefault: boolean;
  /** Biến thể này có cấu tạo bộ (parent trong variant_components). */
  isComposite: boolean;
  /** Tồn Kho chính: bộ = số bộ còn ráp được (tự động theo linh kiện); thường = tồn thực. */
  quantity: number;
  /** Cấu tạo bộ khi isComposite (rỗng nếu chưa khai). */
  components: { variantId: string; label: string; unit: string | null; quantity: number }[];
}

export function isKitVariant(v: AdminVariantRow | VariantWithStock): boolean {
  return v.isComposite;
}

export function hasKitVariant(rows: { isComposite: boolean }[]): boolean {
  return rows.some((r) => r.isComposite);
}

/** Dòng dữ liệu vật tư trong màn quản trị (đủ thông tin để mở modal sửa + quản lý biến thể/bộ). */
export interface AdminProductRow {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  options: string[];
  categoryId: string | null;
  categoryName: string | null;
  createdAt: string;
  variants: AdminVariantRow[];
  /** Vật tư có dòng bộ (lắp ráp) — tồn vật tư = số bộ còn ráp được. */
  isKit: boolean;
  /** Số tồn hiển thị: bộ → số bộ còn ráp được; còn lại → tổng theo từng dòng. */
  totalStock: number;
}

/** Payload trả về cho dialog quản lý biến thể của 1 vật tư. */
export interface ProductVariantsPayload {
  variants: AdminVariantRow[];
}

/** Loại phiếu xuất một dòng lịch sử của vật tư. */
export type ProductHistoryKind = "requisition" | "issue";

/**
 * Một dòng lịch sử cấp/xuất của vật tư: 1 dòng vật tư (theo quy cách) trên một
 * phiếu — phiếu yêu cầu/cấp phát (requisition) hoặc phiếu xuất kho (issue).
 * Số lượng không đổi giữa các bước duyệt → cấp, nên quantity là cả số yêu cầu
 * lẫn số cấp khi phiếu đã cấp.
 */
export interface ProductHistoryRow {
  kind: ProductHistoryKind;
  /** Id dòng (requisition_items / issue_items) — dùng làm key khi render. */
  itemId: string;
  /** Mã phiếu (REQ-… / PXK-…). */
  code: string;
  status: string;
  /** Thời điểm cấp phát/xuất kho: requisition.fulfilled_at hoặc thời điểm phiếu
   *  xuất kho được xác nhận (posted — updated_at lúc post); null khi chưa cấp/xuất. */
  occurredAt: string | null;
  /** Người yêu cầu (chỉ phiếu yêu cầu có; phiếu xuất kho để trống). */
  requesterName: string | null;
  /** Người cấp: requisition.fulfiller; với phiếu xuất kho là người lập và xuất phiếu. */
  fulfillerName: string | null;
  /** Nơi/bên nhận: khu (cả 2 loại phiếu) hoặc khách hàng (xuất bán). */
  destinationName: string | null;
  variantId: string;
  quantity: number;
}
