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

/**
 * Một dòng lịch sử yêu cầu/cấp của vật tư: 1 dòng vật tư (theo quy cách)
 * trên 1 phiếu yêu cầu (requisition). Số lượng không đổi giữa các bước
 * duyệt → cấp, nên quantity là cả số yêu cầu lẫn số cấp khi phiếu đã cấp.
 */
export interface ProductHistoryRow {
  /** Id dòng requisition_items — dùng làm key khi render. */
  itemId: string;
  requisitionId: string;
  code: string;
  status: string;
  /** Ngày cấp phát thực tế (fulfilled_at); null khi phiếu chưa cấp. */
  fulfilledAt: string | null;
  requesterName: string | null;
  fulfillerName: string | null;
  zoneName: string | null;
  variantId: string;
  quantity: number;
}
