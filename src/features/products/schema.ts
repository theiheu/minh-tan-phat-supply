import { z } from "zod";

const attributesJson = z
  .string()
  .refine((s) => {
    try {
      const v = JSON.parse(s);
      return typeof v === "object" && v !== null && !Array.isArray(v);
    } catch {
      return false;
    }
  }, "Thuộc tính phải là JSON object (VD {\"Trọng lượng\":\"Bao 10kg\"})");

export const variantInputSchema = z.object({
  attributes: attributesJson,
  price: z.coerce.number().nonnegative().nullable().optional(),
  unit: z.string().nullable().optional(),
  minStock: z.coerce.number().int().min(0).default(0),
  isTrackableLot: z.boolean().default(false),
  images: z.array(z.string()).default([]),
});

// Dòng linh kiện trong cấu tạo bộ: tham chiếu bằng số thứ tự (index) trong mảng variants
// của cùng lần tạo — server sẽ map sang variant_id sau khi insert.
export const kitComponentInputSchema = z.object({
  index: z.number().int().min(0),
  quantity: z.coerce.number().int().min(1, "Số lượng linh kiện phải ≥ 1"),
});

export const kitInputSchema = z.object({
  parentIndex: z.number().int().min(0),
  components: z.array(kitComponentInputSchema).min(1, "Bộ phải có ít nhất 1 linh kiện"),
});

// Đơn vị quy đổi (dùng khi tạo vật tư theo chế độ quy đổi đơn vị / đóng gói đa cấp).
export const conversionItemInputSchema = z.object({
  unit: z.string().min(1, "Nhập tên đơn vị đóng gói (VD: Thùng)"),
  factor: z.coerce.number().int().min(1, "Tỷ lệ quy đổi phải ≥ 1"),
  price: z.coerce.number().nonnegative().nullable().optional(),
  spec: z.string().optional().default(""),
});

export const unitConversionInputSchema = z.object({
  baseUnit: z.string().min(1, "Nhập tên đơn vị cơ sở (VD: Hộp, ml)"),
  baseSpec: z.string().optional().default(""),
  basePrice: z.coerce.number().nonnegative().nullable().optional(),
  baseMinStock: z.coerce.number().int().min(0).default(0),
  baseTrackableLot: z.boolean().default(false),
  conversions: z.array(conversionItemInputSchema).min(1, "Cần ít nhất 1 đơn vị quy đổi"),
});

export const productInputSchema = z.object({
  name: z.string().min(1, "Tên không được trống"),
  description: z.string().optional().default(""),
  categoryId: z.string().uuid().nullable(),
  options: z.string().optional().default(""),
  images: z.array(z.string()).default([]),
  variants: z.array(variantInputSchema).min(1, "Phải có ít nhất 1 biến thể"),
  kit: kitInputSchema.optional(),
  unitConversion: unitConversionInputSchema.optional(),
});

// Cập nhật vật tư (không đụng biến thể — biến thể quản lý riêng trong dialog chi tiết).
export const productUpdateSchema = z.object({
  name: z.string().min(1, "Tên không được trống"),
  description: z.string().optional().default(""),
  categoryId: z.string().uuid().nullable(),
  options: z.string().optional().default(""),
  images: z.array(z.string()).default([]),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type KitInput = z.infer<typeof kitInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ConversionItemInput = z.infer<typeof conversionItemInputSchema>;
export type UnitConversionInput = z.infer<typeof unitConversionInputSchema>;
