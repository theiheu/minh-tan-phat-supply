// src/features/catalog/domain/types.ts
// Normalized catalog domain types — the NEW owner after cutover.
// These replace the old JSON variants contract in consumers.
// Old runtime still reads variants; these types serve the new kernel/consumers.

/** Đơn vị đo đã phân loại kiểu. */
export interface CatalogUnit {
  id: string;
  code: string;
  name: string;
  symbol: string;
  dimension: string;
  factorToReference: number;
  decimalScale: number;
}

/** Một thuộc tính định nghĩa dùng chung. */
export interface AttributeDefinition {
  id: string;
  code: string;
  name: string;
  dataType: "option" | "text" | "number" | "measurement" | "boolean";
  measurementDimension: string | null;
  defaultUnitId: string | null;
  isVariantAxis: boolean;
  isRequired: boolean;
  displayOrder: number;
}

/** Một giá trị thuộc tính đã chuẩn hóa của SKU. */
export interface SkuAttributeValue {
  attributeDefinitionId: string;
  attributeName: string;
  dataType: AttributeDefinition["dataType"];
  optionValueId: string | null;
  textValue: string | null;
  numericValue: number | null;
  unitId: string | null;
  unitSymbol: string | null;
  booleanValue: boolean | null;
  legacyTextValue: string | null;
}

/** Một phóng chiếu SKU đầy đủ dùng cho catalog consumers và selectors. */
export interface CatalogSku {
  id: string;
  skuCode: string;
  productId: string;
  productName: string;
  categoryId: string | null;
  categoryName: string | null;
  sku_status: "draft" | "active" | "inactive";
  inventoryPolicy: "normal" | "virtual_kit" | "stocked_assembly";
  trackingPolicy: "none" | "lot" | "lot_expiry" | "serial";
  allowFraction: boolean;
  baseUnitId: string;
  baseUnit: CatalogUnit | null;
  attributes: SkuAttributeValue[];
  /** Human-readable summary derived from typed attributes, e.g. "Mitsubishi · 1.5 kW". */
  summary: string;
  label: string;
  images: string[];
  defaultImage: string | null;
}

export interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  catalogStatus: "draft" | "active" | "archived";
  searchKeywords: string[];
  internalNotes: string | null;
  images: string[];
  createdAt: string;
  updatedAt: string;
  skus: CatalogSku[];
  totalAvailable: number;
}

export type CatalogProductDraft = {
  id: string;
  ownerId: string;
  status: string;
  revision: number;
  payload: Record<string, unknown>;
};

/** Đơn vị giao dịch riêng của một SKU. */
export interface TransactionUom {
  id: string;
  skuId: string;
  unitId: string;
  code: string;
  displayName: string;
  factorToBase: number;
  allowReceipt: boolean;
  allowIssue: boolean;
  allowFraction: boolean;
  isBase: boolean;
  barcode: string | null;
  /** Fully-qualified display string for dropdowns, e.g. "Thùng (×100 cái)". */
  label: string;
}

/** Tồn kho khả dụng của SKU theo kho. */
export interface SkuAvailability {
  skuId: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  onHand: number;
  reserved: number;
  available: number;
  baseUnitSymbol: string;
}

/** Kết quả tìm SKU cho selector. */
export interface SkuSelectOption {
  skuId: string;
  productId: string;
  productName: string;
  skuCode: string;
  summary: string;
  label: string;
  defaultImage: string | null;
  trackingPolicy: CatalogSku["trackingPolicy"];
  inventoryPolicy: CatalogSku["inventoryPolicy"];
  baseUnitId: string;
  baseUnitSymbol: string;
  transactionUoms: TransactionUom[];
  availableOnHand: number;
  sku_status: CatalogSku["sku_status"];
}
