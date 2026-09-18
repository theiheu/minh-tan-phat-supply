import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
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
  image?: string | null;
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
    const { data } = await admin
      .from("bom_headers")
      .select("sku_id")
      .eq("inventory_policy", "virtual_kit");
    return Array.from(new Set((data ?? []).map((c) => c.sku_id)));
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
    const [{ data }, { data: padRows }] = await Promise.all([
      admin
        .from("variants")
        .select(`
          id, product_id, sku_code, price, tracking_policy, images,
          units(name, symbol),
          products!inner(name, images, deleted_at),
          sku_attribute_values(
            text_value, numeric_value, boolean_value, legacy_text_value, option_value_id,
            attribute_definitions(name),
            units(symbol),
            attribute_option_values:attribute_option_values!sku_attribute_values_option_value_id_fkey(label, code)
          )
        `)
        .is("products.deleted_at", null)
        .order("id"),
      admin
        .from("product_attribute_definitions")
        .select("product_id, display_order, attribute_definitions(name)")
        .order("display_order"),
    ]);

    const padByProduct = new Map<string, Map<string, number>>();
    for (const pad of padRows || []) {
      const m = padByProduct.get(pad.product_id) || new Map<string, number>();
      const attrName = (pad.attribute_definitions as { name?: string } | null)?.name;
      if (attrName) {
        m.set(attrName, pad.display_order);
      }
      padByProduct.set(pad.product_id, m);
    }

    return (data ?? []).map((v) => {
      const product = v.products as unknown as { name: string; images?: string[] } | null;
      const variantImage = (v.images && v.images.length > 0 ? v.images[0] : null) || (product?.images && product.images.length > 0 ? product.images[0] : null);
      const unitObj = v.units as unknown as { name: string; symbol: string } | null;
      const unit = unitObj?.symbol || unitObj?.name || null;

      const padMap = padByProduct.get(v.product_id);
      const rawAvs = [...((v as unknown as { sku_attribute_values?: Array<{ text_value?: string | null; legacy_text_value?: string | null; numeric_value?: number | null; units?: { symbol?: string | null } | null; attribute_definitions?: { name?: string } | null; attribute_option_values?: { label?: string; code?: string } | null }> }).sku_attribute_values ?? [])];
      if (padMap) {
        rawAvs.sort((a, b) => {
          const nameA = a.attribute_definitions?.name || "";
          const nameB = b.attribute_definitions?.name || "";
          return (padMap.get(nameA) ?? 999) - (padMap.get(nameB) ?? 999);
        });
      }

      const attrVals = rawAvs.map((av) => {
        return av.text_value || av.attribute_option_values?.label || av.attribute_option_values?.code || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : null);
      }).filter(Boolean);
      const detail = attrVals.length > 0 ? attrVals.join(" · ") : (unit ?? "Mặc định");

      return {
        id: v.id,
        productId: v.product_id,
        productName: product?.name ?? "Vật tư",
        detail,
        unit,
        price: v.price ? Number(v.price) : null,
        isTrackableLot: v.tracking_policy === "lot_expiry" || v.tracking_policy === "lot_only",
        image: variantImage,
      };
    });
  },
  ["cached-variant-options"],
  { revalidate: 300, tags: ["metadata:variants"] }
);
