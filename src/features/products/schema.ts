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

export const productInputSchema = z.object({
  name: z.string().min(1, "Tên không được trống"),
  description: z.string().optional().default(""),
  categoryId: z.string().uuid().nullable(),
  options: z.string().optional().default(""),
  images: z.array(z.string()).default([]),
  variants: z.array(variantInputSchema).min(1, "Phải có ít nhất 1 biến thể"),
  kit: kitInputSchema.optional(),
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
