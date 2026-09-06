// Đọc dữ liệu biến thể + tồn + cấu tạo bộ cho 1 nhóm vật tư — dùng chung cho trang
// quản trị (server component) và server action trả dữ liệu cho dialog quản lý biến thể.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { materialLabel, parseAttributesObject } from "@/lib/attributes";
import type { AdminVariantRow } from "./types";

type DB = Database;

/** Id của mọi dòng "bộ" (composite parent) — các màn nhập/chuyển kho vật lý cần loại chúng ra. */
export async function fetchCompositeVariantIds(client: SupabaseClient<DB>): Promise<Set<string>> {
  const { data } = await client.from("variant_components").select("parent_variant_id");
  return new Set((data ?? []).map((c) => c.parent_variant_id));
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

  const { data: variantRows } = await client
    .from("variants")
    .select("*")
    .in("product_id", ids)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  const variants = variantRows ?? [];

  const variantIds = variants.map((v) => v.id);
  const [{ data: stockRows }, compData, childMeta] = await Promise.all([
    variantIds.length
      ? client.from("variant_stock").select("variant_id, quantity").in("variant_id", variantIds)
      : Promise.resolve({ data: [] as { variant_id: string; quantity: number | null }[] }),
    (async () => {
      if (!variantIds.length) return [];
      const { data } = await client
        .from("variant_components")
        .select("parent_variant_id, child_variant_id, quantity")
        .in("parent_variant_id", variantIds);
      return data ?? [];
    })(),
    (async () => {
      if (!variantIds.length) return [] as { id: string; attributes: unknown; unit: string | null }[];
      const { data } = await client
        .from("variants")
        .select("id, attributes, unit")
        .in("id", variantIds);
      return (data ?? []) as { id: string; attributes: unknown; unit: string | null }[];
    })(),
  ]);

  const stockMap = new Map((stockRows ?? []).map((s) => [s.variant_id, s.quantity ?? 0]));

  // Nhãn linh kiện: cần attributes + unit của từng child variant.
  const compRefs = compData ?? [];
  const metaById = new Map((childMeta ?? []).map((c) => [c.id, c]));
  const compLabel = (childId: string) => {
    const meta = metaById.get(childId);
    return materialLabel(meta?.attributes, meta?.unit);
  };

  const compsByParent = new Map<string, NonNullable<AdminVariantRow["components"]>>();
  for (const c of compRefs) {
    const list = compsByParent.get(c.parent_variant_id) ?? [];
    list.push({
      variantId: c.child_variant_id,
      label: compLabel(c.child_variant_id),
      unit: metaById.get(c.child_variant_id)?.unit ?? null,
      quantity: c.quantity,
    });
    compsByParent.set(c.parent_variant_id, list);
  }

  for (const v of variants) {
    const attributes = parseAttributesObject(v.attributes as unknown) ?? {};
    const row: AdminVariantRow = {
      id: v.id,
      productId: v.product_id,
      attributes,
      label: materialLabel(attributes, v.unit),
      price: v.price,
      images: v.images ?? [],
      unit: v.unit,
      minStock: v.min_stock ?? 0,
      isTrackableLot: v.is_trackable_lot ?? false,
      isDefault: v.is_default ?? false,
      isComposite: compsByParent.has(v.id),
      quantity: stockMap.get(v.id) ?? 0,
      components: compsByParent.get(v.id) ?? [],
    };
    map.get(v.product_id)?.push(row);
  }
  return map;
}
