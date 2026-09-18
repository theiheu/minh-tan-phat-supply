// Đọc dữ liệu biến thể + tồn + cấu tạo bộ cho 1 nhóm vật tư — dùng chung cho trang
// quản trị (server component) và server action trả dữ liệu cho dialog quản lý biến thể.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { materialLabel } from "@/lib/attributes";
import type { AdminVariantRow, VariantComponentType } from "./types";

type DB = Database;

/** Id của mọi dòng "bộ" / quy đổi (composite parent) — các màn nhập/chuyển kho vật lý cần loại chúng ra. */
export async function fetchCompositeVariantIds(client: SupabaseClient<DB>): Promise<Set<string>> {
  const { data } = await client.from("bom_headers").select("sku_id").eq("inventory_policy", "virtual_kit");
  return new Set((data ?? []).map((c) => c.sku_id));
}

/**
 * Trả về Map product_id → danh sách dòng biến thể đầy đủ (label, tồn Kho chính, cấu tạo bộ).
 * Tồn của biến thể bộ = số bộ còn ráp được do view variant_stock tính (min linh kiện/định mức).
 */
export async function fetchProductVariantRows(
  client: SupabaseClient<DB>,
  productIds: string[],
): Promise<Map<string, AdminVariantRow[]>> {
  const map = new Map<string, AdminVariantRow[]>();
  const ids = productIds.filter(Boolean);
  if (ids.length === 0) return map;
  for (const id of ids) map.set(id, []);

  const [{ data: variantRows }, { data: padRows }] = await Promise.all([
    client
      .from("variants")
      .select(`
        id, product_id, sku_code, is_default, images, min_stock, sku_status, price, tracking_policy, inventory_policy, created_at,
        units(name, symbol),
        sku_attribute_values(
          text_value, numeric_value, boolean_value, legacy_text_value, option_value_id,
          attribute_definitions(name),
          units(symbol),
          attribute_option_values:attribute_option_values!sku_attribute_values_option_value_id_fkey(label, code)
        )
      `)
      .in("product_id", ids)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    client
      .from("product_attribute_definitions")
      .select("product_id, attribute_definition_id, display_order, attribute_definitions(name)")
      .in("product_id", ids)
      .order("display_order"),
  ]);
  const variants = variantRows ?? [];

  const padByProduct = new Map<string, Map<string, number>>();
  for (const pad of padRows || []) {
    const m = padByProduct.get(pad.product_id) || new Map<string, number>();
    const attrName = (pad.attribute_definitions as { name?: string } | null)?.name;
    if (attrName) {
      m.set(attrName, pad.display_order);
    }
    padByProduct.set(pad.product_id, m);
  }

  const variantIds = variants.map((v) => v.id);
  const [{ data: stockRows }, { data: bomData }] = await Promise.all([
    variantIds.length
      ? client.from("variant_stock").select("variant_id, quantity").in("variant_id", variantIds)
      : Promise.resolve({ data: [] as { variant_id: string; quantity: number | null }[] }),
    variantIds.length
      ? client
          .from("bom_headers")
          .select(`
            sku_id, inventory_policy,
            bom_versions(
              id,
              bom_items(
                component_sku_id, base_quantity,
                variants:variants!bom_items_component_sku_id_fkey(
                  id, product_id, sku_code,
                  units(name, symbol),
                  products(id, name)
                )
              )
            )
          `)
          .in("sku_id", variantIds)
      : Promise.resolve({ data: [] }),
  ]);

  const stockMap = new Map((stockRows ?? []).map((s) => [s.variant_id, s.quantity ?? 0]));

  const compsByParent = new Map<string, NonNullable<AdminVariantRow["components"]>>();
  const typeByParent = new Map<string, VariantComponentType>();

  for (const bh of (bomData ?? []) as unknown as Array<{
    sku_id: string;
    inventory_policy: string;
    bom_versions?: Array<{
      id: string;
      bom_items?: Array<{
        component_sku_id: string;
        base_quantity: number | null;
        variants?: {
          id: string;
          product_id: string;
          sku_code?: string | null;
          units?: { name?: string | null; symbol?: string | null } | null;
          products?: { id: string; name?: string | null } | null;
        } | null;
      }>;
    }> | {
      id: string;
      bom_items?: Array<{
        component_sku_id: string;
        base_quantity: number | null;
        variants?: {
          id: string;
          product_id: string;
          sku_code?: string | null;
          units?: { name?: string | null; symbol?: string | null } | null;
          products?: { id: string; name?: string | null } | null;
        } | null;
      }>;
    };
  }>) {
    const list: NonNullable<AdminVariantRow["components"]> = [];
    const versions = Array.isArray(bh.bom_versions) ? bh.bom_versions : (bh.bom_versions ? [bh.bom_versions] : []);
    for (const bv of versions) {
      for (const bi of bv.bom_items ?? []) {
        const v = bi.variants;
        const uSymbol = v?.units?.symbol || v?.units?.name || null;
        const pName = v?.products?.name || v?.sku_code || "Linh kiện";
        list.push({
          variantId: bi.component_sku_id,
          label: pName,
          unit: uSymbol,
          quantity: Number(bi.base_quantity ?? 1),
          productId: v?.product_id,
          productName: pName,
        });
      }
    }
    compsByParent.set(bh.sku_id, list);
    typeByParent.set(bh.sku_id, bh.inventory_policy === "unit_conversion" ? "unit_conversion" : "assembly");
  }

  for (const v of variants) {
    const unitObj = v.units as unknown as { name?: string; symbol?: string } | null;
    const unit = unitObj?.symbol || unitObj?.name || null;
    const attrObj: Record<string, string> = {};
    const padMap = padByProduct.get(v.product_id);
    const rawAvs = [...((v.sku_attribute_values ?? []) as Array<{
      attribute_definitions?: { name?: string } | null;
      text_value?: string | null;
      legacy_text_value?: string | null;
      numeric_value?: number | null;
      units?: { symbol?: string | null } | null;
      attribute_option_values?: { label?: string; code?: string } | null;
    }>)];

    if (padMap) {
      rawAvs.sort((a, b) => {
        const nameA = a.attribute_definitions?.name || "";
        const nameB = b.attribute_definitions?.name || "";
        return (padMap.get(nameA) ?? 999) - (padMap.get(nameB) ?? 999);
      });
    }

    for (const av of rawAvs) {
      const key = av.attribute_definitions?.name || "Thuộc tính";
      const val = av.text_value || av.attribute_option_values?.label || av.attribute_option_values?.code || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : "");
      if (val) attrObj[key] = val;
    }

    const row: AdminVariantRow = {
      id: v.id,
      productId: v.product_id,
      attributes: attrObj,
      label: materialLabel(attrObj, unit),
      price: v.price ? Number(v.price) : null,
      images: v.images ?? [],
      unit,
      minStock: v.min_stock ?? 0,
      isTrackableLot: v.tracking_policy === "lot_expiry" || v.tracking_policy === "lot_only",
      isDefault: v.is_default ?? false,
      isComposite: compsByParent.has(v.id),
      componentType: typeByParent.get(v.id) ?? null,
      quantity: stockMap.get(v.id) ?? 0,
      components: compsByParent.get(v.id) ?? [],
    };
    map.get(v.product_id)?.push(row);
  }
  return map;
}
