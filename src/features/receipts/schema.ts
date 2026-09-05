import { z } from "zod";

export const receiptItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
  batchNo: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const receiptSchema = z.object({
  supplierId: z.string().uuid().nullable(),
  notes: z
    .string()
    .trim()
    .max(500, "Ghi chú tối đa 500 ký tự")
    .optional()
    .transform((v) => (v ? v : undefined)),
  items: z.array(receiptItemSchema).min(1, "Phải có ít nhất 1 vật tư"),
});

export type ReceiptInput = z.infer<typeof receiptSchema>;
