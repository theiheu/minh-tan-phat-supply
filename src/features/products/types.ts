import type { Variant } from "@/lib/types";

export interface VariantWithStock extends Variant {
  stock: number;
  isComposite: boolean;
}

// Biến thể kèm tồn kho, dùng trong bảng quản trị vật tư.
export interface AdminProductVariant {
  id: string;
  label: string;
  quantity: number;
}

// Dòng dữ liệu vật tư trong màn quản trị (đủ thông tin để mở modal sửa).
export interface AdminProductRow {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  options: string[];
  categoryId: string | null;
  categoryName: string | null;
  createdAt: string;
  variants: AdminProductVariant[];
  totalStock: number;
}
