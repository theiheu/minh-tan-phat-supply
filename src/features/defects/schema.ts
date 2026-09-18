import { z } from "zod";

export const defectItemSchema = z
  .object({
    skuId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().positive().optional(),
    enteredQuantity: z.number().positive().optional(),
    transactionUnitId: z.string().uuid().optional().nullable(),
    damageDetail: z.string().min(1, "Mô tả hỏng không được trống"),
    note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự").optional().default(""),
    images: z.array(z.string().url()).min(1, "Phải có ít nhất 1 ảnh vật tư hỏng"),
  })
  .refine((data) => Boolean(data.skuId || data.variantId), {
    message: "Phải chọn vật tư (SKU)",
    path: ["skuId"],
  })
  .refine(
    (data) =>
      (data.enteredQuantity != null && data.enteredQuantity > 0) ||
      (data.quantity != null && data.quantity > 0),
    {
      message: "Số lượng hỏng phải lớn hơn 0",
      path: ["enteredQuantity"],
    },
  );

export const defectSchema = z.object({
  sourceLocationId: z.string().uuid(),
  items: z.array(defectItemSchema).min(1, "Phải có ít nhất 1 vật tư hỏng"),
});

export type DefectItemInput = z.input<typeof defectItemSchema>;
export type DefectInput = z.input<typeof defectSchema>;
