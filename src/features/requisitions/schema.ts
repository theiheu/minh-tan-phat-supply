import { z } from "zod";

export const requisitionSchema = z.object({
  zoneId: z.string().uuid(),
  subZoneId: z.string().uuid().optional().nullable(),
  purpose: z.string().min(1, "Mục đích không được trống"),
  requesterId: z.string().uuid().optional(), // manager tạo dùm người khác
  items: z
    .array(z.object({ skuId: z.string().uuid(), transactionUnitId: z.string().uuid().optional(), enteredQuantity: z.number().positive() }))
    .min(1, "Phải có ít nhất 1 vật tư"),
});

export type RequisitionInput = z.infer<typeof requisitionSchema>;
