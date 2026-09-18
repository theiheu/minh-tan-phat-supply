// src/features/catalog/domain/labels.ts
// Label helpers for normalized catalog types.
// Replaces free-form JSON attribute parsing.

import type { CatalogSku, SkuAttributeValue, TransactionUom } from "./types";

/**
 * Sinh label hiển thị từ các giá trị thuộc tính đã chuẩn hóa của SKU.
 * Ví dụ: "Mitsubishi · 1.5 kW · 380 V"
 */
export function buildSkuSummary(attributes: SkuAttributeValue[]): string {
  const axisValues = attributes
    .filter((a) => a.legacyTextValue !== null || a.textValue !== null || a.numericValue !== null || a.optionValueId !== null || a.booleanValue !== null)
    .map((a) => {
      if (a.dataType === "measurement" && a.numericValue !== null) {
        return `${a.numericValue} ${a.unitSymbol ?? ""}`.trim();
      }
      if (a.dataType === "option" || a.dataType === "text") {
        return a.textValue ?? a.legacyTextValue ?? "";
      }
      if (a.dataType === "number" && a.numericValue !== null) {
        return String(a.numericValue);
      }
      if (a.dataType === "boolean" && a.booleanValue !== null) {
        return a.booleanValue ? "Có" : "Không";
      }
      return "";
    })
    .filter(Boolean);
  return axisValues.join(" · ") || "SKU";
}

/** Sinh label đầy đủ: "Tên vật tư — summary". */
export function buildSkuLabel(productName: string, summary: string): string {
  if (!summary || summary === "SKU") return productName;
  return `${productName} — ${summary}`;
}

/** Label hiển thị cho đơn vị giao dịch. */
export function buildUomLabel(uom: TransactionUom, baseUnitSymbol: string): string {
  if (uom.isBase) return uom.displayName;
  if (Number.isInteger(uom.factorToBase)) {
    return `${uom.displayName} (×${uom.factorToBase} ${baseUnitSymbol})`;
  }
  return `${uom.displayName} = ${uom.factorToBase} ${baseUnitSymbol}`;
}

/**
 * Tổng hợp label ngắn từ CatalogSku để dùng trong dropdown/selector.
 * Ưu tiên: summary → productName.
 */
export function skuDropdownLabel(sku: Pick<CatalogSku, "productName" | "summary">): string {
  return sku.summary && sku.summary !== "SKU" ? sku.summary : sku.productName;
}
