import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { variantLabel } from "@/lib/labels";
import type {
  Category,
  Customer,
  StockLocation,
  SubZone,
  Supplier,
  Zone,
} from "@/lib/types";

export interface CachedVariantOption {
  id: string;
  productId: string;
  productName: string;
  detail: string;
  unit: string | null;
  price: number | null;
  isTrackableLot: boolean;
}

/**
 * Lấy danh sách danh mục vật tư có bộ nhớ đệm (1 giờ hoặc revalidate khi admin cập nhật).
 */
export const getCachedCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("categories")
      .select("*")
      .is("deleted_at", null)
      .order("display_order");
    return (data as Category[]) ?? [];
  },
  ["cached-categories"],
  { revalidate: 3600, tags: ["metadata:categories"] }
);

/**
 * Lấy danh sách kho / vị trí kho có bộ nhớ đệm.
 */
export const getCachedStockLocations = unstable_cache(
  async (): Promise<StockLocation[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("stock_locations")
      .select("*")
      .eq("is_active", true)
      .order("code");
    return (data as StockLocation[]) ?? [];
  },
  ["cached-stock-locations"],
  { revalidate: 3600, tags: ["metadata:locations"] }
);

/**
 * Lấy danh sách khu vực (zones) có bộ nhớ đệm.
 */
export const getCachedZones = unstable_cache(
  async (): Promise<Zone[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("zones")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    return (data as Zone[]) ?? [];
  },
  ["cached-zones"],
  { revalidate: 3600, tags: ["metadata:zones"] }
);

/**
 * Lấy danh sách dãy chuồng (sub_zones) có bộ nhớ đệm.
 */
export const getCachedSubZones = unstable_cache(
  async (): Promise<SubZone[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("sub_zones")
      .select("*")
      .is("deleted_at", null)
      .order("display_order");
    return (data as SubZone[]) ?? [];
  },
  ["cached-sub-zones"],
  { revalidate: 3600, tags: ["metadata:sub_zones"] }
);

/**
 * Lấy danh sách nhà cung cấp có bộ nhớ đệm.
 */
export const getCachedSuppliers = unstable_cache(
  async (): Promise<Supplier[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("suppliers")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    return (data as Supplier[]) ?? [];
  },
  ["cached-suppliers"],
  { revalidate: 3600, tags: ["metadata:suppliers"] }
);

/**
 * Lấy danh sách khách hàng có bộ nhớ đệm.
 */
export const getCachedCustomers = unstable_cache(
  async (): Promise<Customer[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("customers")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    return (data as Customer[]) ?? [];
  },
  ["cached-customers"],
  { revalidate: 3600, tags: ["metadata:customers"] }
);

/**
 * Lấy danh sách id của mọi dòng 'bộ' (composite parent).
 */
export const getCachedCompositeVariantIds = unstable_cache(
  async (): Promise<string[]> => {
    const admin = createAdminClient();
    const { data } = await admin.from("variant_components").select("parent_variant_id");
    return Array.from(new Set((data ?? []).map((c) => c.parent_variant_id)));
  },
  ["cached-composite-variant-ids"],
  { revalidate: 300, tags: ["metadata:variants"] }
);

/**
 * Lấy danh sách các biến thể vật tư (dùng cho các dropdown tạo phiếu nhập/xuất/báo hỏng/sửa chữa)
 * được lưu trong bộ nhớ đệm 5 phút hoặc revalidate ngay khi tạo/sửa vật tư.
 */
export const getCachedVariantOptions = unstable_cache(
  async (): Promise<CachedVariantOption[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("variants")
      .select("id, product_id, attributes, unit, price, is_trackable_lot, products!inner(name, deleted_at)")
      .is("products.deleted_at", null)
      .order("id");

    return (data ?? []).map((v) => {
      const product = v.products as unknown as { name: string } | null;
      return {
        id: v.id,
        productId: v.product_id,
        productName: product?.name ?? "Vật tư",
        detail: variantLabel(v.attributes, v.unit),
        unit: v.unit,
        price: v.price,
        isTrackableLot: v.is_trackable_lot ?? false,
      };
    });
  },
  ["cached-variant-options"],
  { revalidate: 300, tags: ["metadata:variants"] }
);
