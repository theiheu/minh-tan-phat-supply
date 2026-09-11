import { z } from "zod";

export const toolBorrowingItemSchema = z.object({
  variantId: z.string().uuid("Vật tư không hợp lệ"),
  quantity: z.number().int().min(1, "Số lượng phải ít nhất là 1"),
});

export const toolBorrowingSchema = z.object({
  items: z.array(toolBorrowingItemSchema).min(1, "Phải chọn ít nhất 1 dụng cụ"),
  zoneId: z.string().uuid().optional().nullable(),
  subZoneId: z.string().uuid().optional().nullable(),
  purpose: z.string().min(1, "Vui lòng nhập mục đích mượn dụng cụ"),
  expectedReturnDate: z.string().optional().nullable(),
  borrowerId: z.string().uuid().optional(),
});

export const toolReturnItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1, "Số lượng trả phải lớn hơn 0"),
});

export const toolReturnSchema = z.object({
  borrowingId: z.string().uuid(),
  items: z.array(toolReturnItemSchema).min(1, "Phải chọn ít nhất 1 món để trả"),
  notes: z.string().optional(),
});

export type ToolBorrowingInput = z.infer<typeof toolBorrowingSchema>;
export type ToolReturnInput = z.infer<typeof toolReturnSchema>;
