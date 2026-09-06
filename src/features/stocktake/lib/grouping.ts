// Helpers thuần của bảng kiểm kê: gom nhóm theo vật tư chính, lọc, chia trang.
import { variantLabel } from "@/lib/labels";
import type { StocktakeItemView } from "../types";

export type CheckFilter = "all" | "checked" | "unchecked" | "diff";

/** Một nhóm = một vật tư chính (product) cùng các biến thể có trong phiếu. */
export interface StocktakeGroup {
  productId: string;
  productName: string;
  description: string | null;
  categoryName: string | null;
  /** Ảnh dùng cho thẻ vật tư chính: ảnh sản phẩm, thiếu thì lấy ảnh biến thể. */
  images: string[];
  variants: StocktakeItemView[];
}

/** Gom danh sách biến thể → nhóm theo vật tư chính, sắp theo tên (biến thể theo nhãn). */
export function groupByProduct(items: StocktakeItemView[]): StocktakeGroup[] {
  const map = new Map<string, StocktakeGroup>();
  for (const it of items) {
    let g = map.get(it.productId);
    if (!g) {
      g = {
        productId: it.productId,
        productName: it.productName,
        description: it.description,
        categoryName: it.categoryName,
        images: [],
        variants: [],
      };
      map.set(it.productId, g);
    }
    g.variants.push(it);
  }
  const groups = [...map.values()];
  groups.sort((a, b) => a.productName.localeCompare(b.productName, "vi"));
  for (const g of groups) {
    g.variants.sort((a, b) =>
      variantLabel(a.attributes, a.unit).localeCompare(variantLabel(b.attributes, b.unit), "vi"),
    );
    // Ảnh đại diện: ảnh sản phẩm trước, thiếu thì gom ảnh các biến thể.
    const productImages = g.variants[0]?.productImages ?? [];
    if (productImages.length > 0) {
      g.images = productImages;
    } else {
      g.images = [...new Set(g.variants.flatMap((v) => v.variantImages ?? []))];
    }
  }
  return groups;
}

/** Chia nhóm thành trang theo tổng dòng, KHÔNG tách một nhóm qua hai trang. */
export function paginateGroups(groups: StocktakeGroup[], pageSize: number): StocktakeGroup[][] {
  const pages: StocktakeGroup[][] = [];
  let cur: StocktakeGroup[] = [];
  let curRows = 0;
  for (const g of groups) {
    if (curRows > 0 && curRows + g.variants.length > pageSize) {
      pages.push(cur);
      cur = [];
      curRows = 0;
    }
    cur.push(g);
    curRows += g.variants.length;
  }
  if (cur.length > 0) pages.push(cur);
  return pages.length > 0 ? pages : [[]];
}
