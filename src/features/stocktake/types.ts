// Kiểu dữ liệu hiển thị của module kiểm kê (tách khỏi truy vấn DB).
// page.tsx map dữ liệu Supabase → các kiểu này rồi truyền xuống client components.

export interface StocktakeItemView {
  id: string;
  /** Người kiểm đã đếm xong dòng này chưa (tick checkbox). */
  checked: boolean;
  /** Ghi chú của người kiểm cho dòng này. */
  notes: string;
  // --- Vật tư chính (products) — dùng để gom nhóm "thẻ vật tư chính" ---
  productId: string;
  productName: string;
  description: string | null;
  categoryName: string | null;
  productImages: string[];
  // --- Biến thể ---
  attributes: unknown;
  unit: string | null;
  variantImages: string[];
  systemQty: number;
  actualQty: number;
}

export interface StocktakeSessionView {
  id: string;
  code: string;
  /** Tên phiếu người dùng đặt khi tạo (null/"" với phiếu cũ → hiển thị fallback code). */
  name: string | null;
  locationName: string;
  status: string;
  /** Ngày tạo phiếu (luôn có); postedAt null khi còn draft. */
  createdAt: string | null;
  postedAt: string | null;
  items: StocktakeItemView[];
}
