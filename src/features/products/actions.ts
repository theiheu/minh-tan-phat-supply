"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireManager, requireProfile } from "@/lib/auth";
import { formatZoneLabel } from "@/lib/format-zone";
import { createClient } from "@/lib/supabase/server";
import { fetchProductVariantRows } from "./data";
import type { ProductHistoryRow, ProductVariantsPayload } from "./types";

function revalidate() {
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidateTag("metadata:variants");
}

/** Đọc toàn bộ biến thể + tồn + cấu tạo bộ của 1 vật tư (dùng cho dialog quản lý). */
export async function getProductVariants(productId: string): Promise<ProductVariantsPayload> {
  await requireManager();
  const supabase = await createClient();
  const map = await fetchProductVariantRows(supabase, [productId]);
  return { skus: map.get(productId) ?? [] };
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

  const { data: variantRows } = await supabase.from("skus").select("id").eq("product_id", productId);
  const variantIds = (variantRows ?? []).map((v) => v.id);
  if (variantIds.length === 0) return [];

  // ---- Phiếu yêu cầu/cấp phát: 1 requisition_items + phiếu chứa nó (inner join). ----
  type RequisitionRow = {
    id: string;
    sku_id: string;
    quantity: number;
    requisition: {
      code: string;
      status: string;
      fulfilled_at: string | null;
      requester: { name: string | null } | null;
      fulfiller: { name: string | null } | null;
      zone: { name: string | null } | null;
      sub_zone: { name: string | null } | null;
    } | null;
  };
  const { data: reqData, error: reqErr } = await supabase
    .from("requisition_items")
    .select(
      "id, sku_id, quantity, requisition:requisitions!requisition_items_requisition_id_fkey!inner(code, status, fulfilled_at, requester:profiles!requisitions_requester_id_fkey(name), fulfiller:profiles!requisitions_fulfilled_by_fkey(name), zone:zones!requisitions_zone_id_fkey(name), sub_zone:sub_zones!requisitions_sub_zone_id_fkey(name))",
    )
    .in("sku_id", variantIds)
    // Lọc cột của quan hệ to-one đã inner join → bỏ phiếu nháp chưa gửi yêu cầu.
    .neq("requisition.status", "draft")
    .order("created_at", { ascending: false })
    .limit(100);
  if (reqErr) throw new Error(reqErr.message);

  // ---- Phiếu xuất kho đã xuất (posted): 1 issue_items + phiếu chứa nó. ----
  type IssueRow = {
    id: string;
    sku_id: string;
    quantity: number;
    issue: {
      code: string;
      status: string;
      updated_at: string;
      creator: { name: string | null } | null;
      zone: { name: string | null } | null;
      sub_zone: { name: string | null } | null;
      customer: { name: string | null } | null;
    } | null;
  };
  const { data: issueData, error: issueErr } = await supabase
    .from("issue_items")
    .select(
      "id, sku_id, quantity, issue:issues!issue_items_issue_id_fkey!inner(code, status, updated_at, creator:profiles!issues_creator_id_fkey(name), zone:zones!issues_zone_id_fkey(name), sub_zone:sub_zones!issues_sub_zone_id_fkey(name), customer:customers!issues_customer_id_fkey(name))",
    )
    .in("sku_id", variantIds)
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
      destinationName: formatZoneLabel(req.zone?.name, req.sub_zone?.name),
      variantId: raw.sku_id,
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
      destinationName: iss.customer?.name ?? formatZoneLabel(iss.zone?.name, iss.sub_zone?.name),
      variantId: raw.sku_id,
      quantity: raw.quantity,
    });
  }

  // Sắp theo thời điểm cấp/xuất mới nhất trước; dòng chưa cấp xếp cuối.
  rows.sort((a, b) => {
    if (a.occurredAt && b.occurredAt) return b.occurredAt.localeCompare(a.occurredAt);
    if (a.occurredAt && !b.occurredAt) return -1;
    if (!a.occurredAt && b.occurredAt) return 1;
    return 0;
  });

  return rows.slice(0, 100);
}

export async function setDefaultVariant(productId: string, variantId: string) {
  await requireManager();
  const supabase = await createClient();

  // Bỏ mặc định của các biến thể khác trong cùng vật tư.
  const { error: unsetErr } = await supabase
    .from("skus")
    .update({ is_default: false })
    .eq("product_id", productId)
    .eq("is_default", true);
  if (unsetErr) throw new Error(unsetErr.message);

  const { error } = await supabase
    .from("skus")
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

export async function lookupVariantByQrAction(variantId: string) {
  const supabase = await createClient();
  const { data: vRow } = await supabase
    .from("skus")
    .select("*, products(id, name, images), units(name, symbol)")
    .eq("id", variantId)
    .single();

  if (!vRow) return null;

  const { data: stockRow } = await supabase
    .from("sku_stock")
    .select("quantity")
    .eq("sku_id", vRow.id)
    .maybeSingle();

  const pMeta = vRow.products as { name?: string; images?: string[] } | null;
  const unitObj = vRow.units as { name?: string; symbol?: string } | null;
  const firstImage = (vRow.images && vRow.images.length > 0) ? vRow.images[0] : undefined;

  return {
    productName: pMeta?.name || "Vật tư",
    variant: {
      ...vRow,
      unit: unitObj?.symbol || unitObj?.name || null,
      stock: stockRow?.quantity ?? 0,
      isComposite: false,
      components: [],
    },
    image: firstImage,
  };
}
