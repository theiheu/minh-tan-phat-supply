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
 * Lịch sử cấp/xuất của 1 vật tư: mọi dòng requisition_items (phiếu yêu cầu/cấp
 * phát — trừ phiếu nháp chưa gửi) cộng các dòng issue_items của phiếu xuất kho
 * đã xác nhận xuất (posted). Sắp theo thời điểm cấp/xuất mới nhất trước (dòng
 * chưa cấp xếp cuối), tối đa 100 dòng.
 * Tuân theo RLS: nhân viên thường chỉ thấy phiếu yêu cầu của mình; dữ liệu
 * phiếu xuất kho chỉ quản lý kho đọc được → dòng issue tự bị RLS lọc với vai khác.
 */
export async function getProductHistory(productId: string): Promise<ProductHistoryRow[]> {
  await requireProfile();
  const supabase = await createClient();

  const { data: variantRows } = await supabase.from("variants").select("id").eq("product_id", productId);
  const variantIds = (variantRows ?? []).map((v) => v.id);
  if (variantIds.length === 0) return [];

  // ---- Phiếu yêu cầu/cấp phát: 1 requisition_items + phiếu chứa nó (inner join). ----
  type RequisitionRow = {
    id: string;
    variant_id: string;
    quantity: number;
    requisition: {
      code: string;
      status: string;
      fulfilled_at: string | null;
      requester: { name: string | null } | null;
      fulfiller: { name: string | null } | null;
      zone: { name: string | null } | null;
    } | null;
  };
  const { data: reqData, error: reqErr } = await supabase
    .from("requisition_items")
    .select(
      "id, variant_id, quantity, requisition:requisitions!requisition_items_requisition_id_fkey!inner(code, status, fulfilled_at, requester:profiles!requisitions_requester_id_fkey(name), fulfiller:profiles!requisitions_fulfilled_by_fkey(name), zone:zones!requisitions_zone_id_fkey(name))",
    )
    .in("variant_id", variantIds)
    // Lọc cột của quan hệ to-one đã inner join → bỏ phiếu nháp chưa gửi yêu cầu.
    .neq("requisition.status", "draft")
    .order("created_at", { ascending: false })
    .limit(100);
  if (reqErr) throw new Error(reqErr.message);

  // ---- Phiếu xuất kho đã xuất (posted): 1 issue_items + phiếu chứa nó. ----
  type IssueRow = {
    id: string;
    variant_id: string;
    quantity: number;
    issue: {
      code: string;
      status: string;
      updated_at: string;
      creator: { name: string | null } | null;
      zone: { name: string | null } | null;
      customer: { name: string | null } | null;
    } | null;
  };
  const { data: issueData, error: issueErr } = await supabase
    .from("issue_items")
    .select(
      "id, variant_id, quantity, issue:issues!issue_items_issue_id_fkey!inner(code, status, updated_at, creator:profiles!issues_creator_id_fkey(name), zone:zones!issues_zone_id_fkey(name), customer:customers!issues_customer_id_fkey(name))",
    )
    .in("variant_id", variantIds)
    // Chỉ phiếu đã thực sự xuất kho mới tính là lịch sử cấp/xuất của vật tư.
    .eq("issue.status", "posted")
    .order("created_at", { ascending: false })
    .limit(100);
  if (issueErr) throw new Error(issueErr.message);

  const rows: ProductHistoryRow[] = [];
  for (const raw of (reqData ?? []) as unknown as RequisitionRow[]) {
    const req = raw.requisition;
    if (!req) continue;
    rows.push({
      kind: "requisition",
      itemId: raw.id,
      code: req.code,
      status: req.status,
      occurredAt: req.fulfilled_at,
      requesterName: req.requester?.name ?? null,
      fulfillerName: req.fulfiller?.name ?? null,
      destinationName: req.zone?.name ?? null,
      variantId: raw.variant_id,
      quantity: raw.quantity,
    });
  }
  for (const raw of (issueData ?? []) as unknown as IssueRow[]) {
    const iss = raw.issue;
    if (!iss) continue;
    rows.push({
      kind: "issue",
      itemId: raw.id,
      code: iss.code,
      status: iss.status,
      // updated_at lúc post = thời điểm xuất kho (post_issue ghi updated_at = now()).
      occurredAt: iss.updated_at,
      requesterName: null,
      fulfillerName: iss.creator?.name ?? null,
      destinationName: iss.zone?.name ?? iss.customer?.name ?? null,
      variantId: raw.variant_id,
      quantity: raw.quantity,
    });
  }

  // Mặc định: thời điểm cấp/xuất mới nhất trước; dòng chưa cấp (null) xếp cuối.
  rows.sort((a, b) => {
    if (a.occurredAt && b.occurredAt) return b.occurredAt.localeCompare(a.occurredAt);
    if (a.occurredAt) return -1;
    if (b.occurredAt) return 1;
    return 0;
  });
  return rows.slice(0, 100);
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
