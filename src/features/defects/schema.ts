import { z } from "zod";

export const defectItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  damageDetail: z.string().min(1, "Mô tả hỏng không được trống"),
  damageType: z.enum(
    ["cracked", "chipped", "broken", "worn", "electrical", "chemical", "other"],
    { error: "Chọn kiểu hỏng" },
  ),
  severity: z.enum(["light", "medium", "severe"], { error: "Chọn mức độ" }),
  images: z.array(z.string().url()).min(1, "Phải có ít nhất 1 ảnh vật tư hỏng"),
});

export const defectSchema = z.object({
  sourceLocationId: z.string().uuid(),
  items: z.array(defectItemSchema).min(1, "Phải có ít nhất 1 vật tư hỏng"),
});

export type DefectInput = z.infer<typeof defectSchema>;
