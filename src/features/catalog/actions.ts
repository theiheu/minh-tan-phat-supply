"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireManager, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProductMeta, SkuInput, SkuStatusInput, TransactionUomInput, UpdateDraftInput, UpdateProductAxesInput, UpdateSkuImagesInput, UpdateSkuInput, UpdateTransactionUomInput } from "./schema";
import { productMetaSchema, skuInputSchema, skuStatusSchema, transactionUomInputSchema, updateDraftSchema, updateProductAxesSchema, updateSkuImagesSchema, updateSkuSchema, updateTransactionUomSchema } from "./schema";



// ── Unit helper ─────────────────────────────────────────────────────────────

export async function ensureUnit(unitIdOrName: string, supabaseClient?: unknown): Promise<string> {
  const supabase = (supabaseClient as Awaited<ReturnType<typeof createClient>>) ?? (await createClient());
  const input = unitIdOrName?.trim() || "Cái";

  // 1. If it's already a UUID, check if it exists in units
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
  if (isUuid) {
    const { data: existingById } = await supabase
      .from("units")
      .select("id")
      .eq("id", input)
      .maybeSingle();
    if (existingById?.id) return existingById.id;
  }

  // 2. Search case-insensitive by name, symbol, or code
  const { data: matchedUnits } = await supabase
    .from("units")
    .select("id, code, name, symbol")
    .eq("is_active", true);

  const lower = input.toLowerCase();
  const found = (matchedUnits ?? []).find(
    (u: { id: string; code: string; name: string; symbol: string }) =>
      u.name.toLowerCase() === lower ||
      u.symbol.toLowerCase() === lower ||
      u.code.toLowerCase() === lower ||
      (lower === "cái" && (u.code === "cai" || u.name.toLowerCase() === "cái")) ||
      (lower === "cai" && (u.code === "cai" || u.name.toLowerCase() === "cái"))
  );
  if (found) return found.id;

  // 3. Create a new unit if not found
  const rawCode = lower
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const code = rawCode.length >= 2 ? rawCode : "u_" + Buffer.from(input).toString("hex").slice(0, 16);

  const { data: newUnit, error: insertErr } = await supabase
    .from("units")
    .insert({
      name: input,
      symbol: input.toLowerCase(),
      code: code,
      dimension: "count",
      factor_to_reference: 1,
      decimal_scale: 0,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertErr || !newUnit) {
    const { data: existingByCode } = await supabase
      .from("units")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (existingByCode?.id) return existingByCode.id;
    throw new Error(insertErr?.message || `Lỗi tạo đơn vị '${input}'`);
  }

  return newUnit.id;
}

// ── Read APIs for Client Components ──────────────────────────────────────────

export async function clientSearchSkus(query: string, limit = 30) {
  await requireProfile();
  const { searchSkus } = await import("./data");
  return searchSkus(query, limit);
}

export async function clientResolveBarcode(barcode: string) {
  await requireProfile();
  const { resolveBarcode } = await import("./data");
  return resolveBarcode(barcode);
}

export async function clientGetTransactionUoms(skuId: string) {
  await requireProfile();
  const { getTransactionUoms } = await import("./data");
  return getTransactionUoms(skuId);
}

// ── Cache invalidation ────────────────────────────────────────────────────────
function revalidateCatalog(productId?: string) {
  revalidateTag("catalog:skus");
  revalidateTag("metadata:variants");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  if (productId) {
    revalidatePath(`/admin/products/${productId}`);
    revalidateTag(`catalog:product:${productId}`);
  }
}


// ── Draft Workflow ────────────────────────────────────────────────────────────

export async function createCatalogDraft(): Promise<string> {
  const profile = await requireManager();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_drafts")
    .insert({ owner_id: profile.id, status: "draft", revision: 1, payload: {} })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateCatalogDraft(input: UpdateDraftInput): Promise<number> {
  await requireManager();
  const parsed = updateDraftSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_drafts")
    .update({ payload: parsed.payload as unknown as string, revision: parsed.revision + 1, updated_at: new Date().toISOString() })
    .eq("id", parsed.id)
    .eq("revision", parsed.revision)
    .select("revision")
    .single();
  if (error || !data) throw new Error("Cập nhật nháp thất bại hoặc phiên bản đã thay đổi. Vui lòng tải lại.");
  return data.revision;
}

// ── Product metadata ─────────────────────────────────────────────────────────

/** Tạo Product mới ở trạng thái nháp. */
export async function createProduct(input: ProductMeta): Promise<string> {
  const profile = await requireManager();
  const parsed = productMetaSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: parsed.name,
      category_id: parsed.categoryId ?? null,
      description: parsed.description ?? null,
      search_keywords: parsed.searchKeywords ?? [],
      internal_notes: parsed.internalNotes ?? null,
      images: parsed.images ?? [],
      catalog_status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "catalog.product.create",
    entity_type: "product",
    entity_id: data.id,
    after: { name: parsed.name, catalog_status: "draft" },
  });
  revalidateCatalog();
  return data.id;
}

/** Cập nhật metadata của Product (tên, mô tả, ảnh, từ khóa). */
export async function updateProductMeta(productId: string, input: ProductMeta): Promise<void> {
  const profile = await requireManager();
  const parsed = productMetaSchema.parse(input);
  const supabase = await createClient();
  const { data: before } = await supabase.from("products").select("name,description").eq("id", productId).single();
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.name,
      category_id: parsed.categoryId ?? null,
      description: parsed.description ?? null,
      search_keywords: parsed.searchKeywords ?? [],
      internal_notes: parsed.internalNotes ?? null,
      images: parsed.images ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) throw new Error(error.message);
  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "catalog.product.update_meta",
    entity_type: "product",
    entity_id: productId,
    before: before ?? null,
    after: { name: parsed.name },
  });
  revalidateCatalog(productId);
}

/** Kích hoạt Product draft. */
export async function activateProduct(productId: string): Promise<void> {
  const profile = await requireManager();
  const supabase = await createClient();
  const { data: skuCount } = await supabase
    .from("variants")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("sku_status", "active");
  if ((skuCount as unknown as number) === 0) throw new Error("Phải có ít nhất một SKU active trước khi kích hoạt Product");
  const { error } = await supabase.from("products").update({ catalog_status: "active", updated_at: new Date().toISOString() }).eq("id", productId);
  if (error) throw new Error(error.message);
  await supabase.from("audit_logs").insert({ actor_id: profile.id, action: "catalog.product.activate", entity_type: "product", entity_id: productId, after: { catalog_status: "active" } });
  revalidateCatalog(productId);
}

/** Lưu trữ Product (không xóa). */
export async function archiveProduct(productId: string): Promise<void> {
  const profile = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ catalog_status: "archived", updated_at: new Date().toISOString() }).eq("id", productId);
  if (error) throw new Error(error.message);
  await supabase.from("audit_logs").insert({ actor_id: profile.id, action: "catalog.product.archive", entity_type: "product", entity_id: productId, after: { catalog_status: "archived" } });
  revalidateCatalog(productId);
}

/** Xóa vật tư (soft-delete đánh dấu deleted_at). */
export async function deleteProduct(productId: string): Promise<void> {
  const profile = await requireManager();
  const supabase = await createClient();

  const { data: before, error: fetchErr } = await supabase
    .from("products")
    .select("id, name, catalog_status")
    .eq("id", productId)
    .single();
  if (fetchErr || !before) throw new Error("Không tìm thấy vật tư cần xóa.");

  const { error } = await supabase
    .from("products")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "catalog.product.delete",
    entity_type: "product",
    entity_id: productId,
    before: { name: before.name, catalog_status: before.catalog_status },
    after: { deleted_at: new Date().toISOString() },
  });

  revalidateCatalog(productId);
}

// ── SKU mutations ─────────────────────────────────────────────────────────────


async function resolveAttrDef(
  av: { attributeDefinitionId?: string; attributeName?: string },
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ id: string; dataType: string } | null> {
  if (av.attributeDefinitionId) {
    const { data: ad } = await supabase
      .from("attribute_definitions")
      .select("id, data_type")
      .eq("id", av.attributeDefinitionId)
      .maybeSingle();
    if (ad) return { id: ad.id, dataType: ad.data_type };
  }
  if (av.attributeName?.trim()) {
    const name = av.attributeName.trim();
    let { data: ad } = await supabase
      .from("attribute_definitions")
      .select("id, data_type")
      .eq("name", name)
      .maybeSingle();
    if (!ad) {
      const code = "attr_" + Buffer.from(name).toString("hex").slice(0, 24);
      const { data: newAd, error: newAdErr } = await supabase
        .from("attribute_definitions")
        .insert({
          name,
          code,
          data_type: "text",
          allow_custom_value: true,
        })
        .select("id, data_type")
        .single();
      if (newAdErr || !newAd) throw new Error(newAdErr?.message || `Lỗi tạo thuộc tính '${name}'`);
      ad = newAd;
    }
    return { id: ad.id, dataType: ad.data_type };
  }
  return null;
}

/** Thêm SKU mới vào Product. */
export async function addSku(input: SkuInput): Promise<string> {
  const profile = await requireManager();
  const parsed = skuInputSchema.parse(input);
  const supabase = await createClient();
  const resolvedBaseUnitId = await ensureUnit(parsed.baseUnitId, supabase);
  // Conflict check for duplicate attribute combination is enforced by DB unique index.
  const { data, error } = await supabase
    .from("variants")
    .insert({
      product_id: parsed.productId,
      sku_code: parsed.skuCode || null,
      base_unit_id: resolvedBaseUnitId,
      min_stock: parsed.minStock ?? 0,
      price: parsed.price ?? null,
      tracking_policy: parsed.trackingPolicy,
      inventory_policy: parsed.inventoryPolicy,
      allow_fraction: parsed.allowFraction,
      images: parsed.images ?? [],
      sku_status: "active",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Always ensure base transaction unit exists for new SKU
  await supabase.from("sku_transaction_units").insert({
    sku_id: data.id,
    unit_id: resolvedBaseUnitId,
    code: "BASE",
    display_name: "Đơn vị chuẩn",
    factor_to_base: 1,
    allow_receipt: true,
    allow_issue: true,
    allow_fraction: Boolean(parsed.allowFraction),
    is_base: true,
    is_active: true,
  });

  if (parsed.attributeValues?.length) {
    for (const av of parsed.attributeValues) {
      const ad = await resolveAttrDef(av, supabase);
      if (!ad) continue;

      const textVal = av.textValue?.trim() || av.legacyTextValue?.trim() || "";
      const hasValue = Boolean(textVal || av.numericValue != null || av.booleanValue != null || av.optionValueId);
      if (!hasValue) continue;

      // Ensure product_attribute_definitions is linked
      const { data: pad } = await supabase
        .from("product_attribute_definitions")
        .select("display_order")
        .eq("product_id", parsed.productId)
        .eq("attribute_definition_id", ad.id)
        .maybeSingle();

      if (!pad) {
        const { count } = await supabase
          .from("product_attribute_definitions")
          .select("attribute_definition_id", { count: "exact", head: true })
          .eq("product_id", parsed.productId);
        await supabase.from("product_attribute_definitions").insert({
          product_id: parsed.productId,
          attribute_definition_id: ad.id,
          display_order: Number(count) || 0,
          is_variant_axis: true,
          is_required: true,
        });
      }

      if (ad.dataType === "option") {
        let optId = av.optionValueId;
        if (!optId && textVal) {
          let { data: opt } = await supabase
            .from("attribute_option_values")
            .select("id")
            .eq("attribute_definition_id", ad.id)
            .eq("label", textVal)
            .maybeSingle();

          if (!opt) {
            const optCode = "opt_" + Buffer.from(textVal).toString("hex").slice(0, 24);
            const { data: newOpt, error: optErr } = await supabase
              .from("attribute_option_values")
              .insert({
                attribute_definition_id: ad.id,
                code: optCode,
                label: textVal,
              })
              .select("id")
              .single();
            if (optErr) throw new Error(optErr.message);
            opt = newOpt;
          }
          optId = opt?.id ?? null;
        }

        if (optId) {
          const { error: savErr } = await supabase.from("sku_attribute_values").upsert({
            sku_id: data.id,
            attribute_definition_id: ad.id,
            option_value_id: optId,
            legacy_text_value: textVal || null,
          }, { onConflict: "sku_id,attribute_definition_id" });
          if (savErr) throw new Error(savErr.message);
        }
      } else {
        const { error: savErr } = await supabase.from("sku_attribute_values").upsert({
          sku_id: data.id,
          attribute_definition_id: ad.id,
          text_value: av.textValue ?? (textVal || null),
          numeric_value: av.numericValue ?? null,
          boolean_value: av.booleanValue ?? null,
          unit_id: av.unitId ?? null,
          legacy_text_value: textVal || (av.numericValue != null ? String(av.numericValue) : null),
        }, { onConflict: "sku_id,attribute_definition_id" });
        if (savErr) throw new Error(savErr.message);
      }
    }
  }
  await supabase.from("audit_logs").insert({ actor_id: profile.id, action: "catalog.sku.add", entity_type: "variant", entity_id: data.id, after: { product_id: parsed.productId, sku_status: "active" } });
  revalidateCatalog(parsed.productId);
  return data.id;
}

/** Đổi trạng thái SKU (active/inactive). SKU có lịch sử không bị xóa cứng. */
export async function changeSkuStatus(input: SkuStatusInput): Promise<void> {
  const profile = await requireManager();
  const parsed = skuStatusSchema.parse(input);
  const supabase = await createClient();
  if (parsed.status === "inactive") {
    const { count } = await supabase.from("stock_balances").select("id", { count: "exact", head: true }).eq("variant_id", parsed.skuId).gt("quantity", 0);
    if (Number(count) > 0) throw new Error("Không thể ngừng SKU đang có tồn kho.");
    const { count: resCount } = await supabase.from("stock_reservations").select("id", { count: "exact", head: true }).eq("sku_id", parsed.skuId).in("status", ["active", "partially_consumed"]);
    if (Number(resCount) > 0) throw new Error("Không thể ngừng SKU đang có reservation active.");
  }
  const { data: before } = await supabase.from("variants").select("sku_status,product_id").eq("id", parsed.skuId).single();
  await supabase.from("variants").update({ sku_status: parsed.status, updated_at: new Date().toISOString() }).eq("id", parsed.skuId);
  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: `catalog.sku.set_${parsed.status}`,
    entity_type: "variant",
    entity_id: parsed.skuId,
    before: before ? { sku_status: before.sku_status } : null,
    after: { sku_status: parsed.status, reason: parsed.reason },
  });
  revalidateCatalog(before?.product_id ?? undefined);
}

/** Cập nhật danh sách hình ảnh cho 1 SKU cụ thể. */
export async function updateSkuImages(input: UpdateSkuImagesInput): Promise<void> {
  const profile = await requireManager();
  const parsed = updateSkuImagesSchema.parse(input);
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("variants")
    .select("id, product_id, sku_code, images")
    .eq("id", parsed.skuId)
    .single();

  if (!before) throw new Error("Không tìm thấy SKU");

  const { error } = await supabase
    .from("variants")
    .update({
      images: parsed.images || [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.skuId);

  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "catalog.sku.update_images",
    entity_type: "variant",
    entity_id: parsed.skuId,
    before: { images: before.images },
    after: { images: parsed.images },
  });

  revalidateCatalog(before.product_id);
}

/** Cập nhật thông tin chi tiết của 1 SKU (Mã SKU, ĐVT, Tồn tối thiểu, Đơn giá, Thuộc tính/Quy cách, Ảnh). */
export async function updateSku(input: UpdateSkuInput): Promise<void> {
  const profile = await requireManager();
  const parsed = updateSkuSchema.parse(input);
  const supabase = await createClient();
  const resolvedBaseUnitId = await ensureUnit(parsed.baseUnitId, supabase);

  const { data: before, error: bErr } = await supabase
    .from("variants")
    .select("id, product_id, sku_code, base_unit_id, min_stock, price, tracking_policy, inventory_policy, allow_fraction, images")
    .eq("id", parsed.skuId)
    .single();

  if (bErr || !before) throw new Error("Không tìm thấy SKU cần chỉnh sửa.");

  // Update variants record
  const { error: updErr } = await supabase
    .from("variants")
    .update({
      sku_code: parsed.skuCode || null,
      base_unit_id: resolvedBaseUnitId,
      min_stock: parsed.minStock ?? 0,
      price: parsed.price ?? null,
      tracking_policy: parsed.trackingPolicy,
      inventory_policy: parsed.inventoryPolicy,
      allow_fraction: parsed.allowFraction,
      images: parsed.images ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.skuId);

  if (updErr) throw new Error(updErr.message);

  // Synchronize base unit in sku_transaction_units
  await supabase
    .from("sku_transaction_units")
    .update({
      unit_id: resolvedBaseUnitId,
      allow_fraction: Boolean(parsed.allowFraction),
      updated_at: new Date().toISOString(),
    })
    .eq("sku_id", parsed.skuId)
    .eq("is_base", true);

  // Update attribute values
  if (parsed.attributeValues !== undefined) {
    const updatedAttrDefIds: string[] = [];

    for (const av of parsed.attributeValues) {
      const ad = await resolveAttrDef(av, supabase);
      if (!ad) continue;

      const textVal = av.textValue?.trim() || av.legacyTextValue?.trim() || "";
      const hasValue = Boolean(textVal || av.numericValue != null || av.booleanValue != null || av.optionValueId);
      if (!hasValue) continue;

      updatedAttrDefIds.push(ad.id);

      // Ensure link in product_attribute_definitions
      const { data: pad } = await supabase
        .from("product_attribute_definitions")
        .select("display_order")
        .eq("product_id", before.product_id)
        .eq("attribute_definition_id", ad.id)
        .maybeSingle();

      if (!pad) {
        const { count } = await supabase
          .from("product_attribute_definitions")
          .select("attribute_definition_id", { count: "exact", head: true })
          .eq("product_id", before.product_id);
        await supabase.from("product_attribute_definitions").insert({
          product_id: before.product_id,
          attribute_definition_id: ad.id,
          display_order: Number(count) || 0,
          is_variant_axis: true,
          is_required: true,
        });
      }

      if (ad.dataType === "option") {
        let optId = av.optionValueId;
        if (!optId && textVal) {
          let { data: opt } = await supabase
            .from("attribute_option_values")
            .select("id")
            .eq("attribute_definition_id", ad.id)
            .eq("label", textVal)
            .maybeSingle();

          if (!opt) {
            const optCode = "opt_" + Buffer.from(textVal).toString("hex").slice(0, 24);
            const { data: newOpt, error: optErr } = await supabase
              .from("attribute_option_values")
              .insert({
                attribute_definition_id: ad.id,
                code: optCode,
                label: textVal,
              })
              .select("id")
              .single();
            if (optErr) throw new Error(optErr.message);
            opt = newOpt;
          }
          optId = opt?.id ?? null;
        }

        if (optId) {
          const { error: savErr } = await supabase.from("sku_attribute_values").upsert({
            sku_id: parsed.skuId,
            attribute_definition_id: ad.id,
            option_value_id: optId,
            legacy_text_value: textVal || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "sku_id,attribute_definition_id" });
          if (savErr) throw new Error(savErr.message);
        }
      } else {
        const { error: savErr } = await supabase.from("sku_attribute_values").upsert({
          sku_id: parsed.skuId,
          attribute_definition_id: ad.id,
          text_value: av.textValue ?? (textVal || null),
          numeric_value: av.numericValue ?? null,
          boolean_value: av.booleanValue ?? null,
          unit_id: av.unitId ?? null,
          legacy_text_value: textVal || (av.numericValue != null ? String(av.numericValue) : null),
          updated_at: new Date().toISOString(),
        }, { onConflict: "sku_id,attribute_definition_id" });
        if (savErr) throw new Error(savErr.message);
      }
    }

    // Clean up any removed/cleared attributes for this SKU
    if (updatedAttrDefIds.length > 0) {
      await supabase
        .from("sku_attribute_values")
        .delete()
        .eq("sku_id", parsed.skuId)
        .not("attribute_definition_id", "in", `(${updatedAttrDefIds.join(",")})`);
    } else {
      await supabase
        .from("sku_attribute_values")
        .delete()
        .eq("sku_id", parsed.skuId);
    }
  }

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "catalog.sku.update",
    entity_type: "variant",
    entity_id: parsed.skuId,
    before: { sku_code: before.sku_code, base_unit_id: before.base_unit_id, min_stock: before.min_stock, price: before.price },
    after: { sku_code: parsed.skuCode, base_unit_id: parsed.baseUnitId, min_stock: parsed.minStock, price: parsed.price },
  });

  revalidateCatalog(before.product_id);
}

/** Cập nhật danh sách trục nhóm quy cách cho Product. */
export async function updateProductAxes(input: UpdateProductAxesInput): Promise<void> {
  const profile = await requireManager();
  const parsed = updateProductAxesSchema.parse(input);
  const supabase = await createClient();

  const productId = parsed.productId;
  const newAxisNames = parsed.axes.map((a) => a.trim()).filter(Boolean);

  // 1. Lấy danh sách PAD hiện tại
  const { data: currentPads } = await supabase
    .from("product_attribute_definitions")
    .select("attribute_definition_id, display_order, attribute_definitions(id, name, data_type)")
    .eq("product_id", productId);

  const currentMap = new Map<string, string>(); // name -> attribute_definition_id
  for (const pad of currentPads ?? []) {
    const name = (pad.attribute_definitions as { name?: string } | null)?.name;
    if (name && pad.attribute_definition_id) {
      currentMap.set(name, pad.attribute_definition_id);
    }
  }

  // 2. Thêm mới / cập nhật các trục theo thứ tự
  const keptOrNewDefIds: string[] = [];
  for (const [idx, axisName] of newAxisNames.entries()) {
    let adId = currentMap.get(axisName);
    if (!adId) {
      let { data: ad } = await supabase
        .from("attribute_definitions")
        .select("id")
        .eq("name", axisName)
        .maybeSingle();

      if (!ad) {
        const code = "attr_" + Buffer.from(axisName).toString("hex").slice(0, 24);
        const { data: newAd, error: newAdErr } = await supabase
          .from("attribute_definitions")
          .insert({
            name: axisName,
            code,
            data_type: "text",
            allow_custom_value: true,
          })
          .select("id")
          .single();
        if (newAdErr || !newAd) throw new Error(newAdErr?.message || `Lỗi tạo thuộc tính '${axisName}'`);
        ad = newAd;
      }
      adId = ad.id;
    }

    keptOrNewDefIds.push(adId);

    await supabase.from("product_attribute_definitions").upsert(
      {
        product_id: productId,
        attribute_definition_id: adId,
        display_order: idx,
        is_variant_axis: true,
        is_required: true,
      },
      { onConflict: "product_id,attribute_definition_id" }
    );
  }

  // 3. Xóa các PAD đã bị gỡ khỏi cấu hình
  for (const pad of currentPads ?? []) {
    if (!keptOrNewDefIds.includes(pad.attribute_definition_id)) {
      await supabase
        .from("product_attribute_definitions")
        .delete()
        .eq("product_id", productId)
        .eq("attribute_definition_id", pad.attribute_definition_id);

      // Xóa giá trị thuộc tính tương ứng trên các SKU của sản phẩm này
      const { data: skuRows } = await supabase.from("variants").select("id").eq("product_id", productId);
      const skuIds = (skuRows ?? []).map((s) => s.id);
      if (skuIds.length > 0) {
        await supabase
          .from("sku_attribute_values")
          .delete()
          .in("sku_id", skuIds)
          .eq("attribute_definition_id", pad.attribute_definition_id);
      }
    }
  }

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "catalog.product.update_axes",
    entity_type: "product",
    entity_id: productId,
    after: { axes: newAxisNames },
  });

  revalidateCatalog(productId);
}

/** Xóa SKU an toàn (chỉ cho phép nếu chưa từng phát sinh chứng từ giao dịch hoặc tồn kho). */
export async function deleteSku(skuId: string): Promise<void> {
  const profile = await requireManager();
  const supabase = await createClient();

  const { data: variant, error: vErr } = await supabase
    .from("variants")
    .select("id, product_id, sku_code")
    .eq("id", skuId)
    .single();

  if (vErr || !variant) throw new Error("Không tìm thấy SKU cần xóa.");

  // 1. Check stock balances
  const { data: balances } = await supabase
    .from("stock_balances")
    .select("quantity, reserved_quantity")
    .eq("variant_id", skuId);

  const hasStock = (balances ?? []).some(
    (b) => Number(b.quantity ?? 0) > 0 || Number(b.reserved_quantity ?? 0) > 0
  );
  if (hasStock) {
    throw new Error("SKU này đang có số dư tồn kho hoặc đang giữ chỗ, không thể xóa. Bạn vui lòng chọn 'Tạm ngừng' để ẩn SKU.");
  }

  // 2. Check transaction usage in documents
  const [
    { count: reqCount },
    { count: recCount },
    { count: issCount },
    { count: stCount },
    { count: repCount },
    { count: exCount },
  ] = await Promise.all([
    supabase.from("requisition_items").select("id", { count: "exact", head: true }).eq("variant_id", skuId),
    supabase.from("receipt_items").select("id", { count: "exact", head: true }).eq("variant_id", skuId),
    supabase.from("issue_items").select("id", { count: "exact", head: true }).eq("variant_id", skuId),
    supabase.from("stocktake_items").select("id", { count: "exact", head: true }).eq("variant_id", skuId),
    supabase.from("repair_order_items").select("id", { count: "exact", head: true }).eq("variant_id", skuId),
    supabase.from("exchange_note_items").select("id", { count: "exact", head: true }).eq("variant_id", skuId),
  ]);

  if (
    Number(reqCount) > 0 ||
    Number(recCount) > 0 ||
    Number(issCount) > 0 ||
    Number(stCount) > 0 ||
    Number(repCount) > 0 ||
    Number(exCount) > 0
  ) {
    throw new Error(
      "SKU này đã có phát sinh trong các phiếu chứng từ (yêu cầu/nhập/xuất/kiểm kê/sửa chữa), không thể xóa hoàn toàn. Bạn vui lòng chọn 'Tạm ngừng' để ẩn SKU."
    );
  }

  // 3. Safe delete cascade
  await supabase.from("barcode_registry").delete().eq("sku_id", skuId);
  await supabase.from("sku_transaction_units").delete().eq("sku_id", skuId);
  await supabase.from("sku_attribute_values").delete().eq("sku_id", skuId);
  await supabase.from("stock_balances").delete().eq("variant_id", skuId);
  const { error: delErr } = await supabase.from("variants").delete().eq("id", skuId);
  if (delErr) throw new Error(delErr.message);

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "catalog.sku.delete",
    entity_type: "variant",
    entity_id: skuId,
    before: { sku_code: variant.sku_code, product_id: variant.product_id },
  });

  revalidateCatalog(variant.product_id);
}

// ── Transaction UOM mutations ─────────────────────────────────────────────────

/** Thêm hoặc cập nhật đơn vị giao dịch. Cannot edit base UOM via this action. */
export async function upsertTransactionUom(input: TransactionUomInput): Promise<string> {
  const profile = await requireManager();
  const parsed = transactionUomInputSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sku_transaction_units")
    .upsert(
      {
        sku_id: parsed.skuId,
        unit_id: parsed.unitId,
        code: parsed.code,
        display_name: parsed.displayName,
        factor_to_base: parsed.factorToBase,
        allow_receipt: parsed.allowReceipt,
        allow_issue: parsed.allowIssue,
        allow_fraction: parsed.allowFraction,
        is_base: false,
        is_active: true,
      },
      { onConflict: "sku_id,code" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (parsed.barcode) {
    await supabase
      .from("barcode_registry")
      .upsert({ barcode: parsed.barcode, transaction_unit_id: data.id, sku_id: null, is_active: true }, { onConflict: "barcode", ignoreDuplicates: false })
      .single();
  }
  await supabase.from("audit_logs").insert({ actor_id: profile.id, action: "catalog.uom.upsert", entity_type: "sku_transaction_units", entity_id: data.id, after: { code: parsed.code, factor: parsed.factorToBase } });
  revalidateCatalog(parsed.skuId);
  return data.id;
}

/** Cập nhật đơn vị quy đổi giao dịch (Tên đơn vị, Hệ số quy đổi, Mã vạch). */
export async function updateTransactionUom(input: UpdateTransactionUomInput): Promise<void> {
  const profile = await requireManager();
  const parsed = updateTransactionUomSchema.parse(input);
  const supabase = await createClient();

  const { data: uom, error } = await supabase
    .from("sku_transaction_units")
    .update({
      display_name: parsed.displayName,
      factor_to_base: parsed.factorToBase,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.uomId)
    .select("sku_id, is_base")
    .single();

  if (error || !uom) throw new Error(error?.message || "Cập nhật đơn vị quy đổi thất bại");

  if (parsed.barcode?.trim()) {
    await supabase.from("barcode_registry").upsert(
      {
        barcode: parsed.barcode.trim(),
        transaction_unit_id: parsed.uomId,
        is_active: true,
      },
      { onConflict: "barcode" }
    );
  } else {
    await supabase.from("barcode_registry").delete().eq("transaction_unit_id", parsed.uomId);
  }

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "catalog.uom.update",
    entity_type: "sku_transaction_units",
    entity_id: parsed.uomId,
    after: { displayName: parsed.displayName, factor: parsed.factorToBase },
  });

  const { data: sku } = await supabase.from("variants").select("product_id").eq("id", uom.sku_id).single();
  revalidateCatalog(sku?.product_id);
}

/** Xóa đơn vị quy đổi giao dịch. */
export async function deleteTransactionUom(uomId: string): Promise<void> {
  const profile = await requireManager();
  const supabase = await createClient();

  const { data: uom, error } = await supabase
    .from("sku_transaction_units")
    .select("id, sku_id, is_base")
    .eq("id", uomId)
    .single();

  if (error || !uom) throw new Error("Không tìm thấy đơn vị quy đổi cần xóa.");
  if (uom.is_base) throw new Error("Không thể xóa đơn vị cơ bản (Base Unit) của SKU.");

  await supabase.from("barcode_registry").delete().eq("transaction_unit_id", uomId);
  const { error: delErr } = await supabase.from("sku_transaction_units").delete().eq("id", uomId);
  if (delErr) throw new Error(delErr.message);

  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "catalog.uom.delete",
    entity_type: "sku_transaction_units",
    entity_id: uomId,
  });

  const { data: sku } = await supabase.from("variants").select("product_id").eq("id", uom.sku_id).single();
  revalidateCatalog(sku?.product_id);
}


// ── High-Level Product Creation & Full Update Actions ─────────────────────────


export async function saveBomComponents(
  skuId: string,
  components: BomComponentInput[],
  inventoryPolicy: "virtual_kit" | "stocked_assembly"
): Promise<void> {
  const profile = await requireManager();
  const supabase = await createClient();

  // 1. Update variant inventory_policy
  const { data: sku, error: skuErr } = await supabase
    .from("variants")
    .update({ inventory_policy: inventoryPolicy })
    .eq("id", skuId)
    .select("product_id")
    .single();
  if (skuErr) throw new Error(skuErr?.message || "Lỗi cập nhật chính sách tồn kho SKU");

  // 2. Find or create bom_headers
  let { data: header } = await supabase
    .from("bom_headers")
    .select("id, active_version_id")
    .eq("sku_id", skuId)
    .maybeSingle();

  if (!header) {
    const { data: newHeader, error: hErr } = await supabase
      .from("bom_headers")
      .insert({
        sku_id: skuId,
        inventory_policy: inventoryPolicy,
      })
      .select("id, active_version_id")
      .single();
    if (hErr || !newHeader) throw new Error(hErr?.message || "Lỗi tạo BOM header");
    header = newHeader;
  } else {
    await supabase
      .from("bom_headers")
      .update({ inventory_policy: inventoryPolicy })
      .eq("id", header.id);
  }

  // 3. Count existing versions
  const { count: versionCount } = await supabase
    .from("bom_versions")
    .select("id", { count: "exact", head: true })
    .eq("bom_header_id", header.id);

  const nextVersionNum = (versionCount ?? 0) + 1;

  // 4. Create new bom_version in draft status
  const { data: newVersion, error: vErr } = await supabase
    .from("bom_versions")
    .insert({
      bom_header_id: header.id,
      version_number: nextVersionNum,
      status: "draft",
      effective_period: "[now,)",
      created_by: profile.id,
      change_reason: "Cập nhật linh kiện BOM qua bảng điều khiển quản trị",
    })
    .select("id")
    .single();
  if (vErr || !newVersion) throw new Error(vErr?.message || "Lỗi tạo phiên bản BOM");

  // 5. Insert components
  for (const comp of components) {
    if (!comp.componentSkuId || comp.baseQuantity <= 0) continue;
    const { error: biErr } = await supabase.from("bom_items").insert({
      bom_version_id: newVersion.id,
      component_sku_id: comp.componentSkuId,
      base_quantity: comp.baseQuantity,
      wastage_percent: 0,
    });
    if (biErr) throw new Error(biErr.message || "Lỗi thêm linh kiện vào BOM");
  }

  // 6. Retire old active version
  if (header.active_version_id) {
    await supabase
      .from("bom_versions")
      .update({ status: "retired" })
      .eq("id", header.active_version_id);
  }

  // 7. Activate new version
  const { error: actErr } = await supabase
    .from("bom_versions")
    .update({ status: "active" })
    .eq("id", newVersion.id);
  if (actErr) throw new Error(actErr.message || "Lỗi kích hoạt phiên bản BOM");

  // 8. Update active_version_id on header
  await supabase
    .from("bom_headers")
    .update({ active_version_id: newVersion.id })
    .eq("id", header.id);

  // 9. Audit log
  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "catalog.bom.update",
    entity_type: "sku",
    entity_id: skuId,
    after: { inventoryPolicy, componentCount: components.length, versionNumber: nextVersionNum },
  });

  revalidateCatalog(sku?.product_id);
}

export interface BomComponentInput {
  /** SKU id của linh kiện */
  componentSkuId: string;
  /** Số lượng linh kiện cần cho 1 đơn vị thành phẩm */
  baseQuantity: number;
}

export interface CreateCompleteProductInput {
  name: string;
  categoryId?: string | null;
  description?: string | null;
  options?: string[];
  images?: string[];
  searchKeywords?: string[];
  internalNotes?: string | null;
  skus: Array<{
    skuCode?: string;
    baseUnitId: string;
    minStock?: number;
    price?: number | null;
    trackingPolicy?: "none" | "lot" | "serial";
    inventoryPolicy?: "normal" | "virtual_kit" | "stocked_assembly";
    allowFraction?: boolean;
    isDefault?: boolean;
    images?: string[];
    attributes?: Record<string, string>;
    attributeValues?: Array<{ name: string; value: string }>;
    transactionUoms?: Array<{
      unitId: string;
      code: string;
      displayName: string;
      factorToBase: number;
      barcode?: string;
    }>;
    /** Danh sách linh kiện BOM — chỉ dùng khi inventoryPolicy = virtual_kit | stocked_assembly */
    bomComponents?: BomComponentInput[];
  }>;
}

export async function createCompleteProduct(input: CreateCompleteProductInput): Promise<string> {
  const profile = await requireManager();
  const supabase = await createClient();

  if (!input.name?.trim()) throw new Error("Tên vật tư không được để trống");
  if (!input.skus?.length) throw new Error("Vật tư phải có ít nhất một SKU / quy cách");

  // Resolve base unit IDs for each SKU
  const resolvedSkus = await Promise.all(
    input.skus.map(async (sku) => {
      const resolvedBaseUnitId = await ensureUnit(sku.baseUnitId || "Cái", supabase);
      return {
        ...sku,
        baseUnitId: resolvedBaseUnitId,
      };
    })
  );

  // Validate the complete conversion contract before creating any Product/SKU rows.
  const requestedTransactionUnitIds = new Set<string>();
  for (const sku of resolvedSkus) {
    const skuTransactionUnitIds = new Set<string>();
    for (const uom of sku.transactionUoms ?? []) {
      if (!uom.unitId) throw new Error("Đơn vị giao dịch không được để trống");
      if (uom.unitId === sku.baseUnitId) throw new Error("Đơn vị quy đổi phải khác đơn vị cơ sở");
      if (skuTransactionUnitIds.has(uom.unitId)) throw new Error("Mỗi đơn vị giao dịch chỉ được khai báo một lần cho một SKU");
      if (!uom.displayName?.trim()) throw new Error("Tên hiển thị đơn vị giao dịch không được để trống");
      if (!Number.isFinite(uom.factorToBase) || uom.factorToBase <= 0) throw new Error("Hệ số quy đổi phải lớn hơn 0");
      skuTransactionUnitIds.add(uom.unitId);
      requestedTransactionUnitIds.add(uom.unitId);
    }
  }

  const transactionUnitMap = new Map<string, { id: string; code: string; name: string }>();
  if (requestedTransactionUnitIds.size > 0) {
    const { data: transactionUnits, error: transactionUnitsError } = await supabase
      .from("units")
      .select("id, code, name")
      .in("id", Array.from(requestedTransactionUnitIds))
      .eq("is_active", true);
    if (transactionUnitsError) throw new Error(transactionUnitsError.message);
    for (const unit of transactionUnits ?? []) transactionUnitMap.set(unit.id, unit);
    if (transactionUnitMap.size !== requestedTransactionUnitIds.size) {
      throw new Error("Có đơn vị giao dịch không hợp lệ hoặc đã ngừng sử dụng");
    }
  }

  // 1. Insert product
  const { data: prod, error: prodErr } = await supabase
    .from("products")
    .insert({
      name: input.name.trim(),
      category_id: input.categoryId || null,
      description: input.description?.trim() || null,
      images: input.images || [],
      search_keywords: input.searchKeywords || [],
      internal_notes: input.internalNotes?.trim() || null,
      catalog_status: "active",
    })
    .select("id")
    .single();

  if (prodErr || !prod) throw new Error(prodErr?.message || "Tạo vật tư thất bại");

  // 2. Identify and register all option axes for this product
  const optionAxes: string[] = [];
  if (input.options?.length) {
    for (const opt of input.options) {
      const clean = opt?.trim();
      if (clean && !optionAxes.includes(clean)) {
        optionAxes.push(clean);
      }
    }
  } else {
    for (const sku of input.skus) {
      if (sku.attributeValues?.length) {
        for (const av of sku.attributeValues) {
          const clean = av.name?.trim();
          if (clean && !optionAxes.includes(clean)) {
            optionAxes.push(clean);
          }
        }
      } else if (sku.attributes) {
        for (const k of Object.keys(sku.attributes)) {
          const clean = k.trim();
          if (clean && !optionAxes.includes(clean)) {
            optionAxes.push(clean);
          }
        }
      }
    }
  }

  // Pre-fetch or create attribute_definitions and link to product_attribute_definitions
  const adDefMap = new Map<string, { id: string; dataType: string }>();

  for (const [orderIdx, axisName] of optionAxes.entries()) {
    let { data: ad } = await supabase
      .from("attribute_definitions")
      .select("id, data_type")
      .eq("name", axisName)
      .maybeSingle();

    if (!ad) {
      const code = "attr_" + Buffer.from(axisName).toString("hex").slice(0, 24);
      const { data: newAd, error: newAdErr } = await supabase
        .from("attribute_definitions")
        .insert({
          name: axisName,
          code,
          data_type: "text",
          allow_custom_value: true,
        })
        .select("id, data_type")
        .single();
      if (newAdErr || !newAd) throw new Error(newAdErr?.message || `Lỗi tạo thuộc tính '${axisName}'`);
      ad = newAd;
    }

    adDefMap.set(axisName, { id: ad.id, dataType: ad.data_type });

    const { error: padErr } = await supabase
      .from("product_attribute_definitions")
      .upsert(
        {
          product_id: prod.id,
          attribute_definition_id: ad.id,
          display_order: orderIdx,
          is_variant_axis: true,
          is_required: true,
        },
        { onConflict: "product_id,attribute_definition_id" }
      );
    if (padErr) throw new Error(padErr.message || `Lỗi gán thuộc tính '${axisName}' vào vật tư`);
  }

  // 3. Insert each SKU
  for (const [idx, sku] of resolvedSkus.entries()) {
    const skuCode = sku.skuCode?.trim() || null;

    const { data: skuRow, error: skuErr } = await supabase
      .from("variants")
      .insert({
        product_id: prod.id,
        sku_code: skuCode,
        base_unit_id: sku.baseUnitId,
        sku_status: "active",
        inventory_policy: sku.inventoryPolicy || "normal",
        tracking_policy: sku.trackingPolicy || "none",
        allow_fraction: Boolean(sku.allowFraction),
        min_stock: sku.minStock ?? 0,
        price: sku.price ?? null,
        is_default: sku.isDefault ?? (idx === 0),
        images: sku.images && sku.images.length > 0 ? sku.images : (input.images || []),
      })
      .select("id")
      .single();

    if (skuErr || !skuRow) {
      throw new Error(skuErr?.message || "Tạo SKU thất bại");
    }

    // Extract attributes for this SKU
    const attrEntries: Array<{ name: string; value: string }> = [];
    if (sku.attributeValues?.length) {
      for (const av of sku.attributeValues) {
        if (av.name?.trim() && av.value?.trim()) {
          attrEntries.push({ name: av.name.trim(), value: av.value.trim() });
        }
      }
    } else if (sku.attributes) {
      for (const [k, v] of Object.entries(sku.attributes)) {
        if (k.trim() && v?.trim()) {
          attrEntries.push({ name: k.trim(), value: v.trim() });
        }
      }
    }

    for (const av of attrEntries) {
      let adInfo = adDefMap.get(av.name);
      if (!adInfo) {
        let { data: ad } = await supabase
          .from("attribute_definitions")
          .select("id, data_type")
          .eq("name", av.name)
          .maybeSingle();

        if (!ad) {
          const code = "attr_" + Buffer.from(av.name).toString("hex").slice(0, 24);
          const { data: newAd, error: newAdErr } = await supabase
            .from("attribute_definitions")
            .insert({
              name: av.name,
              code,
              data_type: "text",
              allow_custom_value: true,
            })
            .select("id, data_type")
            .single();
          if (newAdErr || !newAd) throw new Error(newAdErr?.message || `Lỗi tạo thuộc tính '${av.name}'`);
          ad = newAd;
        }

        adInfo = { id: ad.id, dataType: ad.data_type };
        adDefMap.set(av.name, adInfo);

        const { error: padErr } = await supabase.from("product_attribute_definitions").upsert({
          product_id: prod.id,
          attribute_definition_id: ad.id,
          display_order: adDefMap.size - 1,
          is_variant_axis: true,
          is_required: true,
        }, { onConflict: "product_id,attribute_definition_id" });
        if (padErr) throw new Error(padErr.message || `Lỗi gán thuộc tính '${av.name}' vào vật tư`);
      }

      if (adInfo.dataType === "option") {
        let { data: optVal } = await supabase
          .from("attribute_option_values")
          .select("id")
          .eq("attribute_definition_id", adInfo.id)
          .eq("label", av.value)
          .maybeSingle();

        if (!optVal) {
          const optCode = "opt_" + Buffer.from(av.value).toString("hex").slice(0, 24);
          const { data: newOpt, error: optErr } = await supabase
            .from("attribute_option_values")
            .insert({
              attribute_definition_id: adInfo.id,
              code: optCode,
              label: av.value,
            })
            .select("id")
            .single();
          if (optErr || !newOpt) throw new Error(optErr?.message || `Lỗi thêm giá trị '${av.value}'`);
          optVal = newOpt;
        }

        const { error: savErr } = await supabase.from("sku_attribute_values").upsert(
          {
            sku_id: skuRow.id,
            attribute_definition_id: adInfo.id,
            option_value_id: optVal.id,
            legacy_text_value: av.value,
          },
          { onConflict: "sku_id,attribute_definition_id" }
        );
        if (savErr) throw new Error(savErr.message || `Lỗi lưu thuộc tính '${av.name}' = '${av.value}'`);
      } else {
        const { error: savErr } = await supabase.from("sku_attribute_values").upsert(
          {
            sku_id: skuRow.id,
            attribute_definition_id: adInfo.id,
            text_value: av.value,
            legacy_text_value: av.value,
          },
          { onConflict: "sku_id,attribute_definition_id" }
        );
        if (savErr) throw new Error(savErr.message || `Lỗi lưu thuộc tính '${av.name}' = '${av.value}'`);
      }
    }

    // Insert base transaction unit
    const { error: baseUomErr } = await supabase.from("sku_transaction_units").insert({
      sku_id: skuRow.id,
      unit_id: sku.baseUnitId,
      code: "BASE",
      display_name: "Đơn vị chuẩn",
      factor_to_base: 1,
      allow_receipt: true,
      allow_issue: true,
      allow_fraction: Boolean(sku.allowFraction),
      is_base: true,
      is_active: true,
    });
    if (baseUomErr) throw new Error(baseUomErr.message || "Lỗi tạo đơn vị cơ sở cho SKU");

    // Insert additional transaction UOMs. Each row keeps the actual selected
    // transaction unit; only factor_to_base converts it directly to the SKU base unit.
    for (const u of sku.transactionUoms || []) {
      const transactionUnit = transactionUnitMap.get(u.unitId)!;
      const { data: uomData, error: uomErr } = await supabase
        .from("sku_transaction_units")
        .insert({
          sku_id: skuRow.id,
          unit_id: transactionUnit.id,
          code: u.code?.trim() || transactionUnit.code,
          display_name: u.displayName.trim(),
          factor_to_base: u.factorToBase,
          allow_receipt: true,
          allow_issue: true,
          allow_fraction: false,
          is_base: false,
          is_active: true,
        })
        .select("id")
        .single();

      if (uomErr) throw new Error(uomErr.message || `Lỗi tạo đơn vị quy đổi '${u.displayName}'`);

      if (u.barcode?.trim() && uomData) {
        const { error: barErr } = await supabase.from("barcode_registry").insert({
          barcode: u.barcode.trim(),
          sku_id: null,
          transaction_unit_id: uomData.id,
          is_active: true,
        });
        if (barErr) throw new Error(barErr.message || `Lỗi đăng ký mã vạch '${u.barcode}'`);
      }
    }

    // Insert BOM nếu là bộ lắp ráp và có khai báo linh kiện
    const components = sku.bomComponents ?? [];
    const isAssembly = sku.inventoryPolicy === "virtual_kit" || sku.inventoryPolicy === "stocked_assembly";
    if (isAssembly && components.length > 0) {
      // 1. Tạo bom_header
      const { data: bomHeader, error: bhErr } = await supabase
        .from("bom_headers")
        .insert({
          sku_id: skuRow.id,
          inventory_policy: sku.inventoryPolicy ?? "normal",
        })
        .select("id")
        .single();
      if (bhErr || !bomHeader) throw new Error(bhErr?.message || "Lỗi tạo BOM header");

      // 2. Tạo bom_version với status='draft' (tuân thủ RLS bom_versions_insert & cho phép insert bom_items)
      const { data: bomVersion, error: bvErr } = await supabase
        .from("bom_versions")
        .insert({
          bom_header_id: bomHeader.id,
          version_number: 1,
          status: "draft",
          effective_period: "[now,)",
          created_by: profile.id,
          change_reason: "Khởi tạo khi tạo vật tư",
        })
        .select("id")
        .single();
      if (bvErr || !bomVersion) throw new Error(bvErr?.message || "Lỗi tạo BOM version");

      // 3. Insert bom_items (RLS bom_items_insert_draft yêu cầu status='draft')
      for (const comp of components) {
        if (!comp.componentSkuId || comp.baseQuantity <= 0) continue;
        const { error: biErr } = await supabase.from("bom_items").insert({
          bom_version_id: bomVersion.id,
          component_sku_id: comp.componentSkuId,
          base_quantity: comp.baseQuantity,
          wastage_percent: 0,
        });
        if (biErr) throw new Error(biErr.message || `Lỗi thêm linh kiện BOM`);
      }

      // 4. Kích hoạt bom_version thành 'active' (trg_sync_bom_header_active_version sẽ tự động cập nhật active_version_id)
      const { error: actErr } = await supabase
        .from("bom_versions")
        .update({ status: "active" })
        .eq("id", bomVersion.id);
      if (actErr) throw new Error(actErr.message || "Lỗi kích hoạt BOM version");
    }
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "catalog.product.create_complete",
    entity_type: "product",
    entity_id: prod.id,
    after: { name: input.name, skus_count: input.skus.length },
  });

  revalidateCatalog(prod.id);
  return prod.id;
}