"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireManager, requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isOwner, isWarehouse } from "@/lib/types";
import {
  assemblyOrderSchema,
  disassemblyOrderSchema,
  type AssemblyOrderInput,
  type DisassemblyOrderInput,
} from "./schema";
import type {
  AssemblyExecutionResult,
  BomItemRequirement,
  BomVersionOption,
  DisassemblyExecutionResult,
  SkuBomDetails,
} from "./types";

function checkAssemblyRole(role: string | null | undefined) {
  if (!isWarehouse(role) && !isOwner(role)) {
    throw new Error("Bạn không có quyền thao tác lắp ráp/tháo dỡ. Cần quyền Quản kho hoặc Ban quản lý.");
  }
}

function revalidateAssemblyPaths() {
  revalidatePath("/assemblies");
  revalidatePath("/products");
  revalidatePath("/admin/products");
  revalidatePath("/reports");
  revalidatePath("/transfers");
  revalidatePath("/defects");
  revalidateTag("metadata:locations");
  revalidateTag("catalog:skus");
}

/**
 * Thực hiện lệnh lắp ráp thành phẩm (Stocked Assembly) từ các linh kiện theo BOM.
 */
export async function executeAssembly(
  input: AssemblyOrderInput
): Promise<AssemblyExecutionResult> {
  const profile = await requireManager();
  checkAssemblyRole(profile.role);

  const parsed = assemblyOrderSchema.parse(input);
  const admin = createAdminClient();

  // 1. Kiểm tra SKU có chính sách stocked_assembly
  const { data: sku, error: skuErr } = await admin
    .from("skus")
    .select("id, sku_code, inventory_policy")
    .eq("id", parsed.kitSkuId)
    .single();

  if (skuErr || !sku) {
    throw new Error("Không tìm thấy SKU bộ thành phẩm.");
  }
  if (sku.inventory_policy !== "stocked_assembly") {
    throw new Error("SKU này không phải bộ ráp sẵn (stocked_assembly).");
  }

  // 2. Kiểm tra BOM Version
  const { data: bomHeader, error: headerErr } = await admin
    .from("bom_headers")
    .select("id")
    .eq("sku_id", parsed.kitSkuId)
    .single();

  if (headerErr || !bomHeader) {
    throw new Error("SKU bộ chưa có BOM.");
  }

  const { data: bomVersion, error: versionErr } = await admin
    .from("bom_versions")
    .select("id, status")
    .eq("id", parsed.bomVersionId)
    .eq("bom_header_id", bomHeader.id)
    .single();

  if (versionErr || !bomVersion) {
    throw new Error("Phiên bản BOM không thuộc SKU bộ này.");
  }

  const documentId = parsed.documentId || crypto.randomUUID();
  const idempotencyKey = parsed.idempotencyKey || `asm-${documentId}`;

  // 3. Gọi RPC post_assembly
  const { data: movementId, error: rpcErr } = await (admin.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: Error | null }>)("post_assembly", {
    p_kit_sku_id: parsed.kitSkuId,
    p_bom_version_id: parsed.bomVersionId,
    p_quantity: parsed.quantity,
    p_component_location_id: parsed.componentLocationId,
    p_finished_location_id: parsed.finishedLocationId,
    p_document_id: documentId,
    p_idempotency_key: idempotencyKey,
    p_actor: profile.id,
  });

  if (rpcErr) {
    throw new Error(rpcErr.message || "Lỗi khi thực hiện lệnh lắp ráp");
  }

  revalidateAssemblyPaths();

  return {
    success: true,
    movementId: movementId as string,
  };
}

/**
 * Thực hiện lệnh tháo dỡ thành phẩm để thu hồi/ghi nhận hư hỏng/thất thoát linh kiện theo BOM.
 */
export async function executeDisassembly(
  input: DisassemblyOrderInput
): Promise<DisassemblyExecutionResult> {
  const profile = await requireManager();
  checkAssemblyRole(profile.role);

  const parsed = disassemblyOrderSchema.parse(input);
  const admin = createAdminClient();

  // 1. Kiểm tra SKU có chính sách stocked_assembly
  const { data: sku, error: skuErr } = await admin
    .from("skus")
    .select("id, sku_code, inventory_policy")
    .eq("id", parsed.kitSkuId)
    .single();

  if (skuErr || !sku) {
    throw new Error("Không tìm thấy SKU bộ thành phẩm.");
  }
  if (sku.inventory_policy !== "stocked_assembly") {
    throw new Error("SKU này không phải bộ ráp sẵn (stocked_assembly).");
  }

  // 2. Kiểm tra BOM Header & Version
  const { data: bomHeader, error: headerErr } = await admin
    .from("bom_headers")
    .select("id")
    .eq("sku_id", parsed.kitSkuId)
    .single();

  if (headerErr || !bomHeader) {
    throw new Error("SKU bộ chưa có BOM.");
  }

  const { data: bomVersion, error: versionErr } = await admin
    .from("bom_versions")
    .select("id, status")
    .eq("id", parsed.bomVersionId)
    .eq("bom_header_id", bomHeader.id)
    .single();

  if (versionErr || !bomVersion) {
    throw new Error("Phiên bản BOM không thuộc SKU bộ này.");
  }

  // 3. Kiểm tra số lượng phân bổ của từng linh kiện khớp với định mức BOM
  const { data: bomItems, error: itemsErr } = await admin
    .from("bom_items")
    .select("component_sku_id, base_quantity")
    .eq("bom_version_id", parsed.bomVersionId);

  if (itemsErr || !bomItems || bomItems.length === 0) {
    throw new Error("Không có linh kiện nào trong phiên bản BOM này.");
  }

  const bomMap = new Map<string, number>();
  for (const bi of bomItems) {
    bomMap.set(bi.component_sku_id, Number(bi.base_quantity));
  }

  for (const item of parsed.items) {
    const baseQty = bomMap.get(item.componentSkuId);
    if (baseQty === undefined) {
      throw new Error(`Linh kiện ${item.componentSkuId} không thuộc BOM.`);
    }
    const expectedQty = baseQty * parsed.quantity;
    const totalAllocated = item.recoveredQuantity + item.damagedQuantity + item.lostQuantity;
    if (Math.abs(totalAllocated - expectedQty) > 0.000001) {
      throw new Error(
        `Tổng thu hồi (${item.recoveredQuantity}) + hỏng (${item.damagedQuantity}) + mất (${item.lostQuantity}) = ${totalAllocated} không khớp định mức ${expectedQty}.`
      );
    }
  }

  const documentId = parsed.documentId || crypto.randomUUID();
  const idempotencyKey = parsed.idempotencyKey || `disasm-${documentId}`;

  const rpcItems = parsed.items.map((item) => ({
    component_sku_id: item.componentSkuId,
    recovered_quantity: item.recoveredQuantity,
    damaged_quantity: item.damagedQuantity,
    lost_quantity: item.lostQuantity,
    recovery_location_id: item.recoveryLocationId,
    damaged_location_id: item.damagedQuantity > 0 ? (item.damagedLocationId ?? null) : null,
  }));

  // 4. Gọi RPC post_disassembly
  const { data: movementId, error: rpcErr } = await (admin.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: Error | null }>)("post_disassembly", {
    p_kit_sku_id: parsed.kitSkuId,
    p_bom_version_id: parsed.bomVersionId,
    p_quantity: parsed.quantity,
    p_from_location_id: parsed.fromLocationId,
    p_items: rpcItems,
    p_document_id: documentId,
    p_idempotency_key: idempotencyKey,
    p_actor: profile.id,
  });

  if (rpcErr) {
    throw new Error(rpcErr.message || "Lỗi khi thực hiện lệnh tháo dỡ");
  }

  revalidateAssemblyPaths();

  return {
    success: true,
    movementId: movementId as string,
  };
}

/**
 * Lấy chi tiết BOM và tồn kho linh kiện của SKU thành phẩm (stocked_assembly).
 */
export async function getSkuBomDetails(
  skuId: string,
  locationId?: string,
  targetVersionId?: string
): Promise<SkuBomDetails | null> {
  await requireProfile();
  const supabase = await createClient();

  // 1. Lấy thông tin SKU
  const { data: sku, error: skuErr } = await supabase
    .from("skus")
    .select(`
      id, sku_code, inventory_policy,
      products(name),
      units(symbol)
    `)
    .eq("id", skuId)
    .single();

  if (skuErr || !sku) return null;

  const product = sku.products as { name: string } | null;
  const unit = sku.units as { symbol: string } | null;

  // 2. Lấy BOM Header
  const { data: header } = await supabase
    .from("bom_headers")
    .select("id, active_version_id")
    .eq("sku_id", skuId)
    .maybeSingle();

  if (!header) {
    return {
      skuId: sku.id,
      skuCode: sku.sku_code || sku.id,
      productName: product?.name || "",
      summary: "",
      baseUnitSymbol: unit?.symbol || "",
      inventoryPolicy: sku.inventory_policy || "normal",
      activeVersionId: null,
      selectedVersionId: null,
      versions: [],
      items: [],
      onHandQuantity: 0,
    };
  }

  // 3. Lấy danh sách BOM Versions
  const { data: versionRows } = await supabase
    .from("bom_versions")
    .select("id, bom_header_id, version_number, status, change_reason, created_at")
    .eq("bom_header_id", header.id)
    .order("version_number", { ascending: false });

  const versions: BomVersionOption[] = (versionRows || []).map((v) => ({
    id: v.id,
    bomHeaderId: v.bom_header_id,
    versionNumber: v.version_number,
    status: v.status,
    changeReason: v.change_reason,
    createdAt: v.created_at,
  }));

  const effectiveVersionId =
    targetVersionId ||
    header.active_version_id ||
    versions.find((v) => v.status === "active")?.id ||
    versions[0]?.id ||
    null;

  if (!effectiveVersionId) {
    return {
      skuId: sku.id,
      skuCode: sku.sku_code || sku.id,
      productName: product?.name || "",
      summary: "",
      baseUnitSymbol: unit?.symbol || "",
      inventoryPolicy: sku.inventory_policy || "normal",
      activeVersionId: header.active_version_id,
      selectedVersionId: null,
      versions,
      items: [],
      onHandQuantity: 0,
    };
  }

  // 4. Lấy BOM Items
  const { data: itemRows } = await supabase
    .from("bom_items")
    .select("id, component_sku_id, base_quantity, wastage_percent")
    .eq("bom_version_id", effectiveVersionId);

  const componentSkuIds = (itemRows || []).map((i) => i.component_sku_id);

  // 5. Lấy thông tin các component SKU và stock balances
  const componentMap = new Map<string, { code: string; name: string; symbol: string }>();
  const balanceMap = new Map<string, number>();

  if (componentSkuIds.length > 0) {
    const { data: compSkus } = await supabase
      .from("skus")
      .select("id, sku_code, products(name), units(symbol)")
      .in("id", componentSkuIds);

    for (const c of compSkus || []) {
      const p = c.products as { name: string } | null;
      const u = c.units as { symbol: string } | null;
      componentMap.set(c.id, {
        code: c.sku_code || c.id,
        name: p?.name || "",
        symbol: u?.symbol || "",
      });
    }

    let balQuery = supabase
      .from("stock_balances")
      .select("sku_id, location_id, quantity, reserved_quantity")
      .in("sku_id", [...componentSkuIds, skuId]);

    if (locationId) {
      balQuery = balQuery.eq("location_id", locationId);
    }

    const { data: balances } = await balQuery;

    for (const b of balances || []) {
      const avail = Math.max(0, Number(b.quantity || 0) - Number(b.reserved_quantity || 0));
      const cur = balanceMap.get(b.sku_id) || 0;
      balanceMap.set(b.sku_id, cur + avail);
    }
  }

  const items: BomItemRequirement[] = (itemRows || []).map((row) => {
    const comp = componentMap.get(row.component_sku_id);
    const baseQty = Number(row.base_quantity);
    const wastage = Number(row.wastage_percent || 0);
    const reqQty = baseQty * (1 + wastage / 100);
    const avail = balanceMap.get(row.component_sku_id) || 0;

    return {
      id: row.id,
      componentSkuId: row.component_sku_id,
      componentSkuCode: comp?.code || row.component_sku_id,
      componentProductName: comp?.name || "Linh kiện",
      componentSummary: "",
      baseQuantity: baseQty,
      wastagePercent: wastage,
      baseUnitSymbol: comp?.symbol || "cái",
      requiredQuantity: reqQty,
      availableOnHand: avail,
      isAvailable: avail >= reqQty,
    };
  });

  const onHand = balanceMap.get(skuId) || 0;

  return {
    skuId: sku.id,
    skuCode: sku.sku_code || sku.id,
    productName: product?.name || "",
    summary: "",
    baseUnitSymbol: unit?.symbol || "",
    inventoryPolicy: sku.inventory_policy || "stocked_assembly",
    activeVersionId: header.active_version_id,
    selectedVersionId: effectiveVersionId,
    versions,
    items,
    onHandQuantity: onHand,
  };
}
