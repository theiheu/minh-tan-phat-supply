import { z } from "zod";

export const receiptItemSchema = z.object({
  skuId: z.string().uuid(),
  transactionUnitId: z.string().uuid().optional(),
  enteredQuantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  allocations: z.array(z.object({
    lot_number: z.string().optional(),
    expiry_date: z.string().optional()
  })).optional(),
});

export const receiptSchema = z.object({
  supplierId: z.string().uuid().nullable(),
  notes: z
    .string()
    .trim()
    .max(500, "Ghi chú tối đa 500 ký tự")
    .optional()
    .transform((v) => (v ? v : undefined)),
  invoiceImages: z.array(z.string()).optional(),
  items: z.array(receiptItemSchema).min(1, "Phải có ít nhất 1 vật tư"),
});

export type ReceiptInput = z.infer<typeof receiptSchema>;
