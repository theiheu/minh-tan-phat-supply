"use server";

import { revalidatePath } from "next/cache";
import { materialLabel } from "@/lib/attributes";
import { requireManager, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchProductVariantRows } from "./data";
import {
  productInputSchema,
  productUpdateSchema,
  variantInputSchema,
  type ProductInput,
  type ProductUpdateInput,
  type VariantInput,
} from "./schema";
import type { ProductHistoryRow, ProductVariantsPayload } from "./types";

function parseOptions(options: string): string[] {
  return options
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseAttributes(attributes: string): Record<string, string> {
  return JSON.parse(attributes) as Record<string, string>;
}

function revalidate() {
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

/** Đọc toàn bộ biến thể + tồn + cấu tạo bộ của 1 vật tư (dùng cho dialog quản lý). */
export async function getProductVariants(productId: string): Promise<ProductVariantsPayload> {
  await requireManager();
  const supabase = await createClient();
  const map = await fetchProductVariantRows(supabase, [productId]);
  return { variants: map.get(productId) ?? [] };
}

/**
 * Lịch sử yêu cầu/cấp của 1 vật tư: mọi dòng requisition_items thuộc biến thể
 * của vật tư (trừ phiếu nháp chưa gửi), sắp mới nhất trước, tối đa 100 dòng.
 * Tuân theo RLS: nhân viên thường chỉ thấy phiếu của mình, quản lý kho thấy tất cả.
 */
export async function getProductHistory(productId: string): Promise<ProductHistoryRow[]> {
  await requireProfile();
  const supabase = await createClient();

  const { data: variantRows } = await supabase.from("variants").select("id").eq("product_id", productId);
  const variantIds = (variantRows ?? []).map((v) => v.id);
  if (variantIds.length === 0) return [];

  // Dạng dòng phẳng: 1 requisition_items + phiếu chứa nó (inner join — requisition_id not null).
  type HistoryQueryRow = {
    id: string;
    variant_id: string;
    quantity: number;
    requisition: {
      id: string;
      code: string;
      status: string;
      fulfilled_at: string | null;
      requester: { name: string | null } | null;
      fulfiller: { name: string | null } | null;
      zone: { name: string | null } | null;
    } | null;
  };

  const { data, error } = await supabase
    .from("requisition_items")
    .select(
      "id, variant_id, quantity, requisition:requisitions!requisition_items_requisition_id_fkey!inner(id, code, status, fulfilled_at, requester:profiles!requisitions_requester_id_fkey(name), fulfiller:profiles!requisitions_fulfilled_by_fkey(name), zone:zones!requisitions_zone_id_fkey(name))",
    )
    .in("variant_id", variantIds)
    // Lọc cột của quan hệ to-one đã inner join → bỏ phiếu nháp chưa gửi yêu cầu.
    .neq("requisition.status", "draft")
    // Ngày tạo dòng ≈ ngày tạo phiếu (ghi cùng lúc khi tạo) → đủ để sắp lịch sử.
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const rows: ProductHistoryRow[] = [];
  for (const raw of (data ?? []) as unknown as HistoryQueryRow[]) {
    const req = raw.requisition;
    if (!req) continue;
    rows.push({
      itemId: raw.id,
      requisitionId: req.id,
      code: req.code,
      status: req.status,
      fulfilledAt: req.fulfilled_at,
      requesterName: req.requester?.name ?? null,
      fulfillerName: req.fulfiller?.name ?? null,
      zoneName: req.zone?.name ?? null,
      variantId: raw.variant_id,
      quantity: raw.quantity,
    });
  }
  return rows;
}

export async function createProduct(input: ProductInput) {
  await requireManager();
  const parsed = productInputSchema.parse(input);

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name: parsed.name,
      description: parsed.description || null,
      category_id: parsed.categoryId,
      options: parseOptions(parsed.options),
      images: parsed.images,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Insert biến thể theo thứ tự, giữ id để nối cấu tạo bộ theo index.
  const variantIds: string[] = [];
  for (const [idx, v] of parsed.variants.entries()) {
    const { data: variant, error: verr } = await supabase
      .from("variants")
      .insert({
        product_id: product.id,
        attributes: parseAttributes(v.attributes),
        price: v.price ?? null,
        unit: v.unit ?? null,
        min_stock: v.minStock,
        is_trackable_lot: v.isTrackableLot,
        images: v.images ?? [],
        is_default: idx === 0,
      })
      .select("id")
      .single();
    if (verr) throw new Error(verr.message);
    variantIds.push(variant.id);
  }

  // Cấu tạo bộ (nếu khai khi tạo): dòng bộ = variants[kit.parentIndex],
  // linh kiện = variants[index] kèm định mức.
  if (parsed.kit) {
    await writeKitComponents(product.id, parsed.kit.parentIndex, parsed.kit.components, variantIds);
  }

  revalidate();
  return product.id;
}

/** Ghi/ghi đè cấu tạo bộ từ danh sách index (trong mảng variantIds đã tạo). */
async function writeKitComponents(
  productId: string,
  parentIndex: number,
  components: { index: number; quantity: number }[],
  variantIds: string[],
) {
  const supabase = await createClient();
  const n = variantIds.length;
  if (parentIndex < 0 || parentIndex >= n) throw new Error("Dòng bộ không hợp lệ");
  const parentId = variantIds[parentIndex];
  const seen = new Set<number>();
  for (const c of components) {
    if (c.index < 0 || c.index >= n) throw new Error("Dòng linh kiện không hợp lệ");
    if (c.index === parentIndex) throw new Error("Bộ không được chứa chính nó");
    if (seen.has(c.index)) throw new Error("Trùng linh kiện trong cấu tạo bộ");
    seen.add(c.index);
  }
  for (const c of components) {
    const { error } = await supabase.from("variant_components").insert({
      parent_variant_id: parentId,
      child_variant_id: variantIds[c.index],
      quantity: c.quantity,
    });
    if (error) throw new Error(error.message);
  }
}

export async function updateProduct(id: string, input: ProductUpdateInput) {
  await requireManager();
  const parsed = productUpdateSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.name,
      description: parsed.description || null,
      category_id: parsed.categoryId,
      options: parseOptions(parsed.options),
      images: parsed.images,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidate();
}

/** Đặt/ghi đè cấu tạo bộ cho 1 dòng biến thể (parent). Linh kiện phải cùng vật tư, không phải bộ. */
export async function saveVariantComponents(
  parentVariantId: string,
  components: { variantId: string; quantity: number }[],
) {
  await requireManager();
  const supabase = await createClient();

  const { data: parent, error: perr } = await supabase
    .from("variants")
    .select("id, product_id")
    .eq("id", parentVariantId)
    .single();
  if (perr || !parent) throw new Error(perr?.message ?? "Không tìm thấy biến thể bộ");

  const wanted = components.filter((c) => c.variantId && Number(c.quantity) >= 1);
  const ids = [...new Set(wanted.map((c) => c.variantId))];
  const { data: children } = ids.length
    ? await supabase.from("variants").select("id, product_id").in("id", ids)
    : { data: [] };

  const childById = new Map((children ?? []).map((c) => [c.id, c]));
  for (const c of wanted) {
    const child = childById.get(c.variantId);
    if (!child) throw new Error("Linh kiện không tồn tại");
    if (child.product_id !== parent.product_id) throw new Error("Linh kiện phải thuộc cùng vật tư");
    if (child.id === parent.id) throw new Error("Bộ không được chứa chính nó");
  }
  if (children && children.length > 0) {
    // Linh kiện không được là bộ của bộ khác (không lồng bộ).
    const { data: nested } = await supabase
      .from("variant_components")
      .select("parent_variant_id")
      .in("parent_variant_id", children.map((c) => c.id));
    const nestedIds = new Set((nested ?? []).map((n) => n.parent_variant_id));
    const bad = children.find((c) => nestedIds.has(c.id));
    if (bad) {
      const { data: meta } = await supabase
        .from("variants")
        .select("attributes, unit")
        .eq("id", bad.id)
        .single();
      const label = meta ? materialLabel(meta.attributes as unknown, meta.unit) : bad.id;
      throw new Error(`Không dùng được "${label}" làm linh kiện — nó đang là một bộ khác`);
    }
  }

  // Xoá cấu tạo cũ rồi ghi đè cấu tạo mới.
  const { error: delErr } = await supabase
    .from("variant_components")
    .delete()
    .eq("parent_variant_id", parentVariantId);
  if (delErr) throw new Error(delErr.message);

  for (const c of wanted) {
    const { error: insErr } = await supabase.from("variant_components").insert({
      parent_variant_id: parentVariantId,
      child_variant_id: c.variantId,
      quantity: c.quantity,
    });
    if (insErr) throw new Error(insErr.message);
  }

  revalidate();
}

export async function createVariant(productId: string, input: VariantInput): Promise<string> {
  await requireManager();
  const parsed = variantInputSchema.parse(input);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variants")
    .insert({
      product_id: productId,
      attributes: parseAttributes(parsed.attributes),
      price: parsed.price ?? null,
      unit: parsed.unit ?? null,
      min_stock: parsed.minStock,
      is_trackable_lot: parsed.isTrackableLot,
      images: parsed.images ?? [],
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidate();
  return data.id;
}

export async function updateVariant(id: string, input: VariantInput) {
  await requireManager();
  const parsed = variantInputSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("variants")
    .update({
      attributes: parseAttributes(parsed.attributes),
      price: parsed.price ?? null,
      unit: parsed.unit ?? null,
      min_stock: parsed.minStock,
      is_trackable_lot: parsed.isTrackableLot,
      images: parsed.images ?? [],
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidate();
}

export async function deleteVariant(id: string) {
  await requireManager();
  const supabase = await createClient();

  // Không cho xoá linh kiện đang được bộ tham chiếu.
  const { data: refs } = await supabase
    .from("variant_components")
    .select("parent_variant_id")
    .eq("child_variant_id", id)
    .limit(1);
  if (refs && refs.length > 0) {
    const { data: parentMeta } = await supabase
      .from("variants")
      .select("attributes, unit")
      .eq("id", refs[0].parent_variant_id)
      .single();
    const parentLabel = parentMeta ? materialLabel(parentMeta.attributes as unknown, parentMeta.unit) : "bộ";
    throw new Error(`Không xoá được linh kiện đang nằm trong bộ "${parentLabel}" — hãy bỏ linh kiện khỏi bộ trước`);
  }

  const { error } = await supabase.from("variants").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidate();
}

export async function setDefaultVariant(productId: string, variantId: string) {
  await requireManager();
  const supabase = await createClient();

  // Bỏ mặc định của các biến thể khác trong cùng vật tư.
  const { error: unsetErr } = await supabase
    .from("variants")
    .update({ is_default: false })
    .eq("product_id", productId)
    .eq("is_default", true);
  if (unsetErr) throw new Error(unsetErr.message);

  const { error } = await supabase
    .from("variants")
    .update({ is_default: true })
    .eq("id", variantId);
  if (error) throw new Error(error.message);

  revalidate();
}

export async function deleteProduct(id: string) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}
