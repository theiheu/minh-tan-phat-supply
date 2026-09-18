import { z } from "zod";

const uuid = z.string().uuid();
const nonEmpty = z.string().trim().min(1);

// ── Schemas for catalog mutations ────────────────────────────────────────────

/** Thông tin chung của Product khi tạo hoặc cập nhật. */
export const productMetaSchema = z.object({
  name: nonEmpty.max(200),
  categoryId: uuid.nullable().optional(),
  description: z.string().trim().max(2000).optional(),
  searchKeywords: z.array(z.string().trim().min(1)).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
  images: z.array(z.string()).optional(),
});
export type ProductMeta = z.infer<typeof productMetaSchema>;

/** Tạo SKU mới. */
export const skuInputSchema = z.object({
  productId: uuid,
  skuCode: nonEmpty.max(120).optional(),
  baseUnitId: nonEmpty,
  minStock: z.number().nonnegative().default(0),
  price: z.number().nonnegative().nullable().optional(),
  trackingPolicy: z.enum(["none", "lot", "lot_expiry", "serial"]).default("none"),
  inventoryPolicy: z.enum(["normal", "virtual_kit", "stocked_assembly"]).default("normal"),
  allowFraction: z.boolean().default(false),
  images: z.array(z.string()).optional(),
  attributeValues: z
    .array(
      z.object({
        attributeDefinitionId: uuid.optional(),
        attributeName: z.string().trim().min(1).optional(),
        textValue: z.string().trim().nullable().optional(),
        numericValue: z.number().nullable().optional(),
        booleanValue: z.boolean().nullable().optional(),
        optionValueId: uuid.nullable().optional(),
        unitId: uuid.nullable().optional(),
        legacyTextValue: z.string().trim().nullable().optional(),
      }),
    )
    .optional(),
});
export type SkuInput = z.infer<typeof skuInputSchema>;

/** Cập nhật thông tin SKU hiện có. */
export const updateSkuSchema = z.object({
  skuId: uuid,
  skuCode: nonEmpty.max(120).optional(),
  baseUnitId: nonEmpty,
  minStock: z.number().nonnegative().default(0),
  price: z.number().nonnegative().nullable().optional(),
  trackingPolicy: z.enum(["none", "lot", "lot_expiry", "serial"]).default("none"),
  inventoryPolicy: z.enum(["normal", "virtual_kit", "stocked_assembly"]).default("normal"),
  allowFraction: z.boolean().default(false),
  images: z.array(z.string()).optional(),
  attributeValues: z
    .array(
      z.object({
        attributeDefinitionId: uuid.optional(),
        attributeName: z.string().trim().min(1).optional(),
        textValue: z.string().trim().nullable().optional(),
        numericValue: z.number().nullable().optional(),
        booleanValue: z.boolean().nullable().optional(),
        optionValueId: uuid.nullable().optional(),
        unitId: uuid.nullable().optional(),
        legacyTextValue: z.string().trim().nullable().optional(),
      }),
    )
    .optional(),
});
export type UpdateSkuInput = z.infer<typeof updateSkuSchema>;

/** Kích hoạt hoặc ngừng SKU. */
export const skuStatusSchema = z.object({
  skuId: uuid,
  status: z.enum(["active", "inactive"]),
  reason: z.string().trim().max(500).optional(),
});
export type SkuStatusInput = z.infer<typeof skuStatusSchema>;

/** Thêm đơn vị giao dịch mới. */
export const transactionUomInputSchema = z.object({
  skuId: uuid,
  code: nonEmpty.max(80),
  displayName: nonEmpty.max(200),
  unitId: uuid,
  factorToBase: z.number().positive(),
  allowReceipt: z.boolean().default(true),
  allowIssue: z.boolean().default(true),
  allowFraction: z.boolean().default(false),
  barcode: z.string().trim().min(1).max(200).nullable().optional(),
});
export type TransactionUomInput = z.infer<typeof transactionUomInputSchema>;

/** Cập nhật đơn vị giao dịch hiện có. */
export const updateTransactionUomSchema = z.object({
  uomId: uuid,
  displayName: nonEmpty.max(200),
  factorToBase: z.number().positive(),
  barcode: z.string().trim().max(200).nullable().optional(),
});
export type UpdateTransactionUomInput = z.infer<typeof updateTransactionUomSchema>;

/** Đặt trạng thái nháp thành kích hoạt. */
export const activateProductSchema = z.object({
  productId: uuid,
  revision: z.number().int().positive(),
});
export type ActivateProductInput = z.infer<typeof activateProductSchema>;

/** Cập nhật 1 bước draft. */
export const updateDraftSchema = z.object({
  id: uuid,
  revision: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()), // Step state payload
});
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;

/** Cập nhật danh sách ảnh cho 1 SKU cụ thể. */
export const updateSkuImagesSchema = z.object({
  skuId: uuid,
  images: z.array(z.string()),
});
export type UpdateSkuImagesInput = z.infer<typeof updateSkuImagesSchema>;

/** Cập nhật danh sách trục thuộc tính cho Product */
export const updateProductAxesSchema = z.object({
  productId: uuid,
  axes: z.array(z.string().trim().min(1)).max(5),
});
export type UpdateProductAxesInput = z.infer<typeof updateProductAxesSchema>;
