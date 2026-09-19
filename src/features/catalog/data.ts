import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildSkuLabel, buildSkuSummary, buildUomLabel } from "./domain/labels";
import type { CatalogProduct, CatalogSku, CatalogUnit, SkuAvailability, SkuAttributeValue, SkuSelectOption, TransactionUom } from "./domain/types";
import { DEFAULT_CANONICAL_UNITS } from "./domain/uom";

// ── Unit lookup ─────────────────────────────────────────────────────────────
export const getUnits = cache(async (): Promise<CatalogUnit[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select("id,code,name,symbol,dimension,factor_to_reference,decimal_scale")
    .eq("is_active", true)
    .order("name");
  if (!data || data.length === 0) return DEFAULT_CANONICAL_UNITS;
  return data.map((u) => ({
    id: u.id,
    code: u.code,
    name: u.name,
    symbol: u.symbol,
    dimension: u.dimension,
    factorToReference: u.factor_to_reference,
    decimalScale: u.decimal_scale,
  }));
});

// ── SKU read helpers ─────────────────────────────────────────────────────────
function mapAttributes(attrs: {
  attribute_definition_id: string;
  attribute_definitions: {
    name: string;
    data_type: string;
    measurement_dimension: string | null;
    default_unit_id: string | null;
  } | null;
  option_value_id: string | null;
  text_value: string | null;
  numeric_value: number | null;
  boolean_value: boolean | null;
  unit_id: string | null;
  legacy_text_value: string | null;
  units?: { symbol: string } | null;
  attribute_option_values?: { label?: string; code?: string } | null;
}[]): SkuAttributeValue[] {
  return (attrs ?? []).map((sv) => ({
    attributeDefinitionId: sv.attribute_definition_id,
    attributeName: sv.attribute_definitions?.name ?? "",
    dataType: (sv.attribute_definitions?.data_type ?? "text") as SkuAttributeValue["dataType"],
    optionValueId: sv.option_value_id ?? null,
    textValue: sv.text_value ?? sv.attribute_option_values?.label ?? sv.attribute_option_values?.code ?? sv.legacy_text_value ?? null,
    numericValue: sv.numeric_value ?? null,
    unitId: sv.unit_id ?? null,
    unitSymbol: sv.units?.symbol ?? null,
    booleanValue: sv.boolean_value ?? null,
    legacyTextValue: sv.legacy_text_value ?? null,
  }));
}

function mapUom(uom: {
  id: string;
  sku_id: string;
  unit_id: string;
  code: string;
  display_name: string;
  factor_to_base: number;
  allow_receipt: boolean;
  allow_issue: boolean;
  allow_fraction: boolean;
  is_base: boolean;
  barcode?: string | null;
}, baseUnitSymbol: string): TransactionUom {
  const label = buildUomLabel(
    { id: uom.id, skuId: uom.sku_id, unitId: uom.unit_id, code: uom.code, displayName: uom.display_name, factorToBase: uom.factor_to_base, allowReceipt: uom.allow_receipt, allowIssue: uom.allow_issue, allowFraction: uom.allow_fraction, isBase: uom.is_base, barcode: uom.barcode ?? null, label: "" },
    baseUnitSymbol,
  );
  return { id: uom.id, skuId: uom.sku_id, unitId: uom.unit_id, code: uom.code, displayName: uom.display_name, factorToBase: uom.factor_to_base, allowReceipt: uom.allow_receipt, allowIssue: uom.allow_issue, allowFraction: uom.allow_fraction, isBase: uom.is_base, barcode: uom.barcode ?? null, label };
}

// ── SKU list/detail reads ────────────────────────────────────────────────────
export const getSkuById = cache(async (skuId: string): Promise<CatalogSku | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("skus")
    .select(`
      id,sku_code,sku_status,inventory_policy,tracking_policy,allow_fraction,
      base_unit_id,images,is_default,product_id,
      products!inner(name,category_id,deleted_at,categories(name)),
      units(code,name,symbol,dimension,factor_to_reference,decimal_scale),
      sku_attribute_values(
        attribute_definition_id,option_value_id,text_value,numeric_value,boolean_value,unit_id,legacy_text_value,
        attribute_definitions(name,data_type,measurement_dimension,default_unit_id),
        units(symbol),
        attribute_option_values:attribute_option_values!sku_attribute_values_option_value_id_fkey(label,code)
      ),
      sku_transaction_units(id,sku_id:id,unit_id,code,display_name,factor_to_base,allow_receipt,allow_issue,allow_fraction,is_base)
    `)
    .eq("id", skuId)
    .eq("sku_status", "active")
    .is("products.deleted_at", null)
    .single();
  if (!data) return null;
  const { data: padRows } = await supabase
    .from("product_attribute_definitions")
    .select("attribute_definition_id, display_order")
    .eq("product_id", data.product_id)
    .order("display_order");

  const padOrderMap = new Map((padRows ?? []).map((p) => [p.attribute_definition_id, p.display_order]));

  const product = data.products as { name: string; category_id: string | null; categories: { name: string } | null } | null;
  const baseUnit = data.units as { code: string; name: string; symbol: string; dimension: string; factor_to_reference: number; decimal_scale: number } | null;
  const rawAttrs = [...((data.sku_attribute_values ?? []) as Parameters<typeof mapAttributes>[0])];
  rawAttrs.sort((a, b) => (padOrderMap.get(a.attribute_definition_id) ?? 999) - (padOrderMap.get(b.attribute_definition_id) ?? 999));
  const attrs = mapAttributes(rawAttrs);
  const summary = buildSkuSummary(attrs);
  const label = buildSkuLabel(product?.name ?? "", summary);
  return {
    id: data.id,
    skuCode: data.sku_code ?? data.id,
    productId: data.product_id,
    productName: product?.name ?? "",
    categoryId: product?.category_id ?? null,
    categoryName: (product?.categories as { name: string } | null)?.name ?? null,
    sku_status: (data.sku_status ?? "active") as CatalogSku["sku_status"],
    inventoryPolicy: (data.inventory_policy ?? "normal") as CatalogSku["inventoryPolicy"],
    trackingPolicy: (data.tracking_policy ?? "none") as CatalogSku["trackingPolicy"],
    allowFraction: data.allow_fraction ?? false,
    baseUnitId: data.base_unit_id ?? "",
    baseUnit: baseUnit ? { id: data.base_unit_id!, code: baseUnit.code, name: baseUnit.name, symbol: baseUnit.symbol, dimension: baseUnit.dimension, factorToReference: baseUnit.factor_to_reference, decimalScale: baseUnit.decimal_scale } : null,
    attributes: attrs,
    summary,
    label,
    images: data.images ?? [],
    defaultImage: (data.images as string[] | null)?.[0] ?? null,
  };
});

// ── Barcode resolution ──────────────────────────────────────────────────────
export async function resolveBarcode(barcode: string): Promise<{ skuId: string; transactionUomId: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("barcode_registry")
    .select("sku_id,transaction_unit_id")
    .eq("barcode", barcode.trim())
    .eq("is_active", true)
    .single();
  if (!data) return null;
  return { skuId: data.sku_id!, transactionUomId: data.transaction_unit_id ?? null };
}

// ── SKU availability ─────────────────────────────────────────────────────────
export async function getSkuAvailability(skuId: string): Promise<SkuAvailability[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_balances")
    .select("sku_id,location_id,quantity,reserved_quantity,stock_locations(code,name),units(symbol)")
    .eq("sku_id", skuId)
    .gt("quantity", 0);
  if (!data) return [];
  return data.map((row) => {
    const loc = row.stock_locations as { code: string; name: string } | null;
    const unit = row.units as { symbol: string } | null;
    const onHand = Number(row.quantity ?? 0);
    const reserved = Number(row.reserved_quantity ?? 0);
    return {
      skuId,
      locationId: row.location_id,
      locationCode: loc?.code ?? "",
      locationName: loc?.name ?? "",
      onHand,
      reserved,
      available: Math.max(0, onHand - reserved),
      baseUnitSymbol: unit?.symbol ?? "",
    };
  });
}


// ── Admin Product List/Detail reads ───────────────────────────────────────────
export async function getAdminProductList(query: string, categoryId: string | null, limit = 50, offset = 0): Promise<{ products: CatalogProduct[]; count: number }> {
  const supabase = await createClient();
  const q = query.trim();

  let prods: Array<{
    id: string;
    name: string;
    description: string | null;
    category_id: string | null;
    catalog_status: string;
    search_keywords: string[] | null;
    internal_notes: string | null;
    images: string[] | null;
    created_at: string;
    updated_at: string;
    categories: { name: string } | null;
  }> = [];
  let totalCount = 0;

  if (q) {
    const { data: matchIds } = await supabase.rpc("search_catalog", { p_query: q });
    const matchedProductIds = (matchIds ?? []).map((r) => r.id);
    if (matchedProductIds.length === 0) {
      return { products: [], count: 0 };
    }

    let filteredIds = matchedProductIds;
    if (categoryId) {
      const { data: catRows } = await supabase
        .from("products")
        .select("id")
        .eq("category_id", categoryId)
        .neq("catalog_status", "archived")
        .is("deleted_at", null);
      const catSet = new Set((catRows ?? []).map((c) => c.id));
      filteredIds = matchedProductIds.filter((id) => catSet.has(id));
    }

    totalCount = filteredIds.length;
    const pageIds = filteredIds.slice(offset, offset + limit);
    if (pageIds.length === 0) {
      return { products: [], count: totalCount };
    }

    const { data: pageProds } = await supabase
      .from("products")
      .select(`
        id, name, description, category_id, catalog_status, search_keywords, internal_notes, images, created_at, updated_at,
        categories(name)
      `)
      .in("id", pageIds);

    const rankMap = new Map(pageIds.map((id, idx) => [id, idx]));
    prods = ((pageProds ?? []) as unknown as typeof prods).sort(
      (a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999)
    );
  } else {
    let dbq = supabase
      .from("products")
      .select(`
        id, name, description, category_id, catalog_status, search_keywords, internal_notes, images, created_at, updated_at,
        categories(name)
      `, { count: "exact" })
      .neq("catalog_status", "archived")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (categoryId) {
      dbq = dbq.eq("category_id", categoryId);
    }

    const res = await dbq;
    prods = (res.data ?? []) as unknown as typeof prods;
    totalCount = res.count ?? 0;
  }

  if (prods.length === 0) return { products: [], count: totalCount };

  const productIds = prods.map((p) => p.id);
  const [{ data: skus }, { data: padRows }] = await Promise.all([
    supabase
      .from("skus")
      .select(`
        id,sku_code,sku_status,inventory_policy,tracking_policy,allow_fraction,
        base_unit_id,images,is_default,product_id,
        units(code,name,symbol,dimension,factor_to_reference,decimal_scale),
        sku_attribute_values(
          attribute_definition_id,option_value_id,text_value,numeric_value,boolean_value,unit_id,legacy_text_value,
          attribute_definitions(name,data_type,measurement_dimension,default_unit_id),
          units(symbol),
          attribute_option_values:attribute_option_values!sku_attribute_values_option_value_id_fkey(label,code)
        ),
        sku_transaction_units!sku_transaction_units_sku_id_fkey(id,unit_id,code,display_name,factor_to_base,allow_receipt,allow_issue,allow_fraction,is_base),
        stock_balances(quantity,reserved_quantity)
      `)
      .in("product_id", productIds)
      .neq("sku_status", "inactive"),
    supabase
      .from("product_attribute_definitions")
      .select("product_id, attribute_definition_id, display_order")
      .in("product_id", productIds)
      .order("display_order"),
  ]);

  const padByProduct = new Map<string, Map<string, number>>();
  for (const pad of padRows || []) {
    const m = padByProduct.get(pad.product_id) || new Map<string, number>();
    m.set(pad.attribute_definition_id, pad.display_order);
    padByProduct.set(pad.product_id, m);
  }
    
  const skuMap = new Map<string, CatalogSku[]>();
  for (const s of skus || []) {
    const baseUnit = s.units as { code: string; name: string; symbol: string; dimension: string; factor_to_reference: number; decimal_scale: number } | null;
    const productPadMap = padByProduct.get(s.product_id);
    const rawAttrs = [...((s.sku_attribute_values ?? []) as Parameters<typeof mapAttributes>[0])];
    if (productPadMap) {
      rawAttrs.sort((a, b) => (productPadMap.get(a.attribute_definition_id) ?? 999) - (productPadMap.get(b.attribute_definition_id) ?? 999));
    }
    const attrs = mapAttributes(rawAttrs);
    const summary = buildSkuSummary(attrs);
    const prod = prods.find((p) => p.id === s.product_id);
    const mapped: CatalogSku = {
      id: s.id,
      skuCode: s.sku_code ?? s.id,
      productId: s.product_id,
      productName: prod?.name ?? "",
      categoryId: prod?.category_id ?? null,
      categoryName: (prod?.categories as { name: string } | null)?.name ?? null,
      sku_status: (s.sku_status ?? "active") as CatalogSku["sku_status"],
      inventoryPolicy: (s.inventory_policy ?? "normal") as CatalogSku["inventoryPolicy"],
      trackingPolicy: (s.tracking_policy ?? "none") as CatalogSku["trackingPolicy"],
      allowFraction: s.allow_fraction ?? false,
      baseUnitId: s.base_unit_id ?? "",
      baseUnit: baseUnit ? { id: s.base_unit_id!, code: baseUnit.code, name: baseUnit.name, symbol: baseUnit.symbol, dimension: baseUnit.dimension, factorToReference: baseUnit.factor_to_reference, decimalScale: baseUnit.decimal_scale } : null,
      attributes: attrs,
      summary,
      label: buildSkuLabel(prod?.name ?? "", summary),
      images: s.images ?? [],
      defaultImage: (s.images as string[] | null)?.[0] ?? null,
    };
    // Include minimal totalAvailable injection for presentation
    Object.assign(mapped, {
      totalAvailable: ((s.stock_balances ?? []) as { quantity: number; reserved_quantity: number }[]).reduce(
        (acc, b) => acc + Math.max(0, Number(b.quantity) - Number(b.reserved_quantity)),
        0
      )
    });
    const list = skuMap.get(s.product_id) ?? [];
    list.push(mapped);
    skuMap.set(s.product_id, list);
  }

  const products = prods.map((p) => {
    const pskus = skuMap.get(p.id) ?? [];
    return {
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      categoryId: p.category_id ?? null,
      categoryName: (p.categories as { name: string } | null)?.name ?? null,
      catalogStatus: (p.catalog_status ?? "active") as CatalogProduct["catalogStatus"],
      searchKeywords: p.search_keywords ?? [],
      internalNotes: p.internal_notes ?? null,
      images: p.images ?? [],
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      skus: pskus,
      totalAvailable: pskus.reduce((sum, s) => sum + ((s as unknown as { totalAvailable: number }).totalAvailable || 0), 0),
    };
  });
  return { products, count: totalCount };
}

// ── SKU search for selector ─────────────────────────────────────────────────
export async function searchSkus(query: string, limit = 30): Promise<SkuSelectOption[]> {
  const supabase = await createClient();
  const q = query.trim();

  let matchedSkuIds: string[] | null = null;
  if (q) {
    const { data: matchSkus } = await supabase.rpc("search_skus", { p_query: q, p_limit: limit });
    matchedSkuIds = (matchSkus ?? []).map((r) => r.sku_id);
    if (matchedSkuIds.length === 0) {
      return [];
    }
  }

  let dbq = supabase
    .from("skus")
    .select(`
      id,sku_code,sku_status,inventory_policy,tracking_policy,allow_fraction,
      base_unit_id,images,product_id,
      products!inner(name,category_id,deleted_at),
      units(symbol,decimal_scale),
      sku_attribute_values(
        attribute_definition_id,text_value,numeric_value,boolean_value,option_value_id,unit_id,legacy_text_value,
        attribute_definitions(name,data_type,measurement_dimension,default_unit_id),
        units(symbol),
        attribute_option_values:attribute_option_values!sku_attribute_values_option_value_id_fkey(label,code)
      ),
      sku_transaction_units!sku_transaction_units_sku_id_fkey(id,unit_id,code,display_name,factor_to_base,allow_receipt,allow_issue,allow_fraction,is_base),
      stock_balances(quantity)
    `)
    .eq("sku_status", "active")
    .is("products.deleted_at", null);

  if (matchedSkuIds) {
    dbq = dbq.in("id", matchedSkuIds);
  }

  const { data } = await dbq.limit(limit);
  if (!data) return [];

  if (matchedSkuIds) {
    const rankMap = new Map(matchedSkuIds.map((id, idx) => [id, idx]));
    data.sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));
  }

  const skuProductIds = Array.from(new Set(data.map((r) => r.product_id)));
  const { data: padRows } = skuProductIds.length > 0
    ? await supabase
        .from("product_attribute_definitions")
        .select("product_id, attribute_definition_id, display_order")
        .in("product_id", skuProductIds)
        .order("display_order")
    : { data: [] };

  const padByProduct = new Map<string, Map<string, number>>();
  for (const pad of padRows || []) {
    const m = padByProduct.get(pad.product_id) || new Map<string, number>();
    m.set(pad.attribute_definition_id, pad.display_order);
    padByProduct.set(pad.product_id, m);
  }

  return data.map((row) => {
    const product = row.products as { name: string } | null;
    const baseUnit = row.units as { symbol: string; decimal_scale: number } | null;
    const productPadMap = padByProduct.get(row.product_id);
    const rawAttrs = [...((row.sku_attribute_values ?? []) as Parameters<typeof mapAttributes>[0])];
    if (productPadMap) {
      rawAttrs.sort((a, b) => (productPadMap.get(a.attribute_definition_id) ?? 999) - (productPadMap.get(b.attribute_definition_id) ?? 999));
    }
    const attrs = mapAttributes(rawAttrs);
    const summary = buildSkuSummary(attrs);
    const label = buildSkuLabel(product?.name ?? "", summary);
    const uoms = ((row.sku_transaction_units ?? []) as { id: string; unit_id: string; code: string; display_name: string; factor_to_base: number; allow_receipt: boolean; allow_issue: boolean; allow_fraction: boolean; is_base: boolean }[]).map((u) =>
      mapUom({ ...u, sku_id: row.id }, baseUnit?.symbol ?? "")
    );
    const onHand = ((row.stock_balances ?? []) as { quantity: number }[]).reduce((s, b) => s + Number(b.quantity ?? 0), 0);
    return {
      skuId: row.id,
      productId: row.product_id,
      productName: product?.name ?? "",
      skuCode: row.sku_code ?? row.id,
      summary,
      label,
      defaultImage: (row.images as string[] | null)?.[0] ?? null,
      trackingPolicy: (row.tracking_policy ?? "none") as SkuSelectOption["trackingPolicy"],
      inventoryPolicy: (row.inventory_policy ?? "normal") as SkuSelectOption["inventoryPolicy"],
      baseUnitId: row.base_unit_id ?? "",
      baseUnitSymbol: baseUnit?.symbol ?? "",
      transactionUoms: uoms,
      availableOnHand: onHand,
      sku_status: (row.sku_status ?? "active") as SkuSelectOption["sku_status"],
    };
  });
}

// ── Transaction UOM options for a given SKU ──────────────────────────────────
export async function getTransactionUoms(skuId: string): Promise<TransactionUom[]> {
  const supabase = await createClient();
  const [uomRes, baseRes] = await Promise.all([
    supabase
      .from("sku_transaction_units")
      .select("id,sku_id:id,unit_id,code,display_name,factor_to_base,allow_receipt,allow_issue,allow_fraction,is_base,barcodes:barcode_registry(barcode)")
      .eq("sku_id", skuId)
      .eq("is_active", true)
      .order("is_base", { ascending: false })
      .order("display_name"),
    supabase.from("skus").select("base_unit_id,units(symbol)").eq("id", skuId).single(),
  ]);
  const baseSymbol = ((baseRes.data?.units as { symbol: string } | null)?.symbol) ?? "";
  return (uomRes.data ?? []).map((u) => {
    const barcode = ((u.barcodes ?? []) as { barcode: string }[])[0]?.barcode ?? null;
    return Object.assign(mapUom({ ...u, sku_id: skuId }, baseSymbol), { barcode });
  });
}

// ── Full Product Details for Admin Product Detail Page ────────────────────────
export interface ProductDetailData {
  product: {
    id: string;
    name: string;
    description: string | null;
    categoryId: string | null;
    categoryName: string | null;
    catalogStatus: string;
    images: string[];
    searchKeywords: string[];
    internalNotes: string | null;
    createdAt: string;
    updatedAt: string;
  };
  skus: Array<{
    id: string;
    skuCode: string;
    skuStatus: string;
    baseUnitId: string;
    baseUnitSymbol: string;
    baseUnitName: string;
    inventoryPolicy: string;
    trackingPolicy: string;
    allowFraction: boolean;
    images: string[];
    isDefault: boolean;
    minStock: number;
    price: number | null;
    stockOnHand: number;
    stockReserved: number;
    stockAvailable: number;
    attributes: SkuAttributeValue[];
    transactionUoms: TransactionUom[];
  }>;
  stockByLocation: Array<{
    skuId: string;
    skuCode: string;
    locationId: string;
    locationName: string;
    locationCode: string;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    unitSymbol: string;
  }>;
  bomItems: Array<{
    /** Id SKU bộ (parent) chứa linh kiện này */
    parentSkuId: string;
    componentSkuId: string;
    /** Mã SKU hiển thị (sku_code) của linh kiện, không phải UUID */
    componentSkuCode: string;
    componentName: string;
    quantity: number;
    unitSymbol: string;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    actorName: string;
    createdAt: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  }>;
  attributeAxes?: Array<{
    id: string;
    name: string;
    code?: string;
    dataType: string;
    isVariantAxis: boolean;
  }>;
}

export async function getProductDetails(productId: string): Promise<ProductDetailData | null> {
  const supabase = await createClient();

  const { data: prod, error: pErr } = await supabase
    .from("products")
    .select("id, name, description, category_id, catalog_status, search_keywords, internal_notes, images, created_at, updated_at, categories(name)")
    .eq("id", productId)
    .is("deleted_at", null)
    .single();

  if (pErr || !prod) return null;

  const { data: skuRows } = await supabase
    .from("skus")
    .select(`
      id, sku_code, sku_status, inventory_policy, tracking_policy, allow_fraction,
      base_unit_id, images, is_default, min_stock, price,
      units(code, name, symbol),
      sku_attribute_values(
        attribute_definition_id, option_value_id, text_value, numeric_value, boolean_value, unit_id, legacy_text_value,
        attribute_definitions(name, data_type, measurement_dimension, default_unit_id),
        units(symbol),
        attribute_option_values:attribute_option_values!sku_attribute_values_option_value_id_fkey(label, code)
      ),
      sku_transaction_units!sku_transaction_units_sku_id_fkey(id, code, display_name, factor_to_base, allow_receipt, allow_issue, allow_fraction, is_base)
    `)
    .eq("product_id", productId)
    .order("is_default", { ascending: false });

  const skuIds = (skuRows ?? []).map((s) => s.id);

  const allUomIds = (skuRows ?? []).flatMap((s) => ((s.sku_transaction_units ?? []) as Array<{ id: string }>).map((u) => u.id));

  const [{ data: balanceRows }, { data: logsRows }, { data: bomData }, { data: padRows }, { data: barcodeRows }] = await Promise.all([
    skuIds.length > 0
      ? supabase
          .from("stock_balances")
          .select("sku_id, location_id, quantity, reserved_quantity, stock_locations(code, name), skus(base_unit_id, units(symbol))")
          .in("sku_id", skuIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("audit_logs")
      .select("id, action, created_at, before, after, profiles(name, username)")
      .eq("entity_id", productId)
      .order("created_at", { ascending: false })
      .limit(20),
    skuIds.length > 0
      ? supabase
          .from("bom_headers")
          .select("id, sku_id, active_version_id, bom_versions(id, bom_items(component_sku_id, base_quantity, variants:skus!bom_items_component_sku_id_fkey(sku_code, products(name), units(symbol))))")
          .in("sku_id", skuIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("product_attribute_definitions")
      .select("attribute_definition_id, display_order, is_variant_axis, attribute_definitions(id, name, code, data_type)")
      .eq("product_id", productId)
      .order("display_order"),
    allUomIds.length > 0
      ? supabase
          .from("barcode_registry")
          .select("barcode, transaction_unit_id")
          .in("transaction_unit_id", allUomIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [] }),
  ]);

  const barcodeMap = new Map((barcodeRows ?? []).map((b) => [b.transaction_unit_id, b.barcode]));

  const padOrderMap = new Map((padRows ?? []).map((p) => [p.attribute_definition_id, p.display_order]));

  const attributeAxes: ProductDetailData["attributeAxes"] = (padRows ?? [])
    .map((p) => {
      const ad = p.attribute_definitions as unknown as { id?: string; name?: string; code?: string; data_type?: string } | null;
      return {
        id: p.attribute_definition_id,
        name: ad?.name ?? "",
        code: ad?.code ?? "",
        dataType: ad?.data_type ?? "text",
        isVariantAxis: p.is_variant_axis ?? true,
      };
    })
    .filter((a) => a.name);

  // Aggregate stock by SKU and location
  const stockByLocation: ProductDetailData["stockByLocation"] = [];
  const skuStockMap = new Map<string, { onHand: number; reserved: number }>();

  for (const b of balanceRows ?? []) {
    const loc = b.stock_locations as { code: string; name: string } | null;
    const sku = (skuRows ?? []).find((s) => s.id === b.sku_id);
    const baseUnit = sku?.units as { symbol: string } | null;
    const qty = Number(b.quantity ?? 0);
    const res = Number(b.reserved_quantity ?? 0);

    const current = skuStockMap.get(b.sku_id) ?? { onHand: 0, reserved: 0 };
    skuStockMap.set(b.sku_id, {
      onHand: current.onHand + qty,
      reserved: current.reserved + res,
    });

    if (qty > 0 || res > 0) {
      stockByLocation.push({
        skuId: b.sku_id,
        skuCode: sku?.sku_code ?? b.sku_id,
        locationId: b.location_id,
        locationCode: loc?.code ?? "",
        locationName: loc?.name ?? "",
        quantity: qty,
        reservedQuantity: res,
        availableQuantity: Math.max(0, qty - res),
        unitSymbol: baseUnit?.symbol ?? "",
      });
    }
  }

  // BOM items list
  const bomItems: ProductDetailData["bomItems"] = [];
  for (const bh of ((bomData ?? []) as unknown as Array<{ sku_id: string; active_version_id?: string | null; bom_versions?: Array<{ id: string; bom_items?: Array<{ component_sku_id: string; base_quantity: number | null; skus?: { sku_code: string | null; products?: { name: string } | null; units?: { symbol: string } | null } | null }> }> }>)) {
    // Chỉ đọc bom_items của active version
    const activeVersionId = bh.active_version_id;
    const parentSkuId = bh.sku_id;
    for (const bv of bh.bom_versions ?? []) {
      if (activeVersionId && bv.id !== activeVersionId) continue;
      for (const bi of bv.bom_items ?? []) {
        const v = bi.skus as { sku_code: string | null; products: { name: string } | null; units: { symbol: string } | null } | null;
        bomItems.push({
          parentSkuId,
          componentSkuId: bi.component_sku_id,
          componentSkuCode: v?.sku_code ?? bi.component_sku_id,
          componentName: v?.products?.name ?? v?.sku_code ?? bi.component_sku_id,
          quantity: Number(bi.base_quantity ?? 0),
          unitSymbol: v?.units?.symbol ?? "",
        });
      }
    }
  }

  const skus: ProductDetailData["skus"] = (skuRows ?? []).map((s) => {
    const baseUnit = s.units as { code: string; name: string; symbol: string } | null;
    const rawAttrs = [...((s.sku_attribute_values ?? []) as Parameters<typeof mapAttributes>[0])];
    rawAttrs.sort((a, b) => (padOrderMap.get(a.attribute_definition_id) ?? 999) - (padOrderMap.get(b.attribute_definition_id) ?? 999));
    const attrs = mapAttributes(rawAttrs);
    const stock = skuStockMap.get(s.id) ?? { onHand: 0, reserved: 0 };
    const uoms = ((s.sku_transaction_units ?? []) as unknown as Array<{ id: string; unit_id: string; code: string; display_name: string; factor_to_base: number; allow_receipt: boolean; allow_issue: boolean; allow_fraction: boolean; is_base: boolean }>).map((u) =>
      mapUom({ ...u, sku_id: s.id, barcode: barcodeMap.get(u.id) ?? null }, baseUnit?.symbol ?? "")
    );

    return {
      id: s.id,
      skuCode: s.sku_code ?? s.id,
      skuStatus: s.sku_status ?? "active",
      baseUnitId: s.base_unit_id ?? "",
      baseUnitSymbol: baseUnit?.symbol ?? "",
      baseUnitName: baseUnit?.name ?? "",
      inventoryPolicy: s.inventory_policy ?? "normal",
      trackingPolicy: s.tracking_policy ?? "none",
      allowFraction: s.allow_fraction ?? false,
      images: s.images ?? [],
      isDefault: s.is_default ?? false,
      minStock: s.min_stock ?? 0,
      price: s.price ? Number(s.price) : null,
      stockOnHand: stock.onHand,
      stockReserved: stock.reserved,
      stockAvailable: Math.max(0, stock.onHand - stock.reserved),
      attributes: attrs,
      transactionUoms: uoms,
    };
  });

  const auditLogs: ProductDetailData["auditLogs"] = (logsRows ?? []).map((l) => {
    const actor = l.profiles as { name: string; username: string } | null;
    return {
      id: l.id,
      action: l.action,
      actorName: actor?.name ?? actor?.username ?? "Hệ thống",
      createdAt: l.created_at,
      before: l.before as Record<string, unknown> | null,
      after: l.after as Record<string, unknown> | null,
    };
  });

  return {
    product: {
      id: prod.id,
      name: prod.name,
      description: prod.description ?? null,
      categoryId: prod.category_id ?? null,
      categoryName: (prod.categories as { name: string } | null)?.name ?? null,
      catalogStatus: prod.catalog_status ?? "active",
      images: prod.images ?? [],
      searchKeywords: prod.search_keywords ?? [],
      internalNotes: prod.internal_notes ?? null,
      createdAt: prod.created_at,
      updatedAt: prod.updated_at,
    },
    skus,
    stockByLocation,
    bomItems,
    auditLogs,
    attributeAxes,
  };
}