import { z } from "zod";

export const defectItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  damageDetail: z.string().min(1, "Mô tả hỏng không được trống"),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự").optional().default(""),
  images: z.array(z.string().url()).min(1, "Phải có ít nhất 1 ảnh vật tư hỏng"),
});

export const defectSchema = z.object({
  sourceLocationId: z.string().uuid(),
  items: z.array(defectItemSchema).min(1, "Phải có ít nhất 1 vật tư hỏng"),
});

export type DefectInput = z.infer<typeof defectSchema>;
