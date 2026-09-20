import { z } from "zod";

export const ADMIN_DOC_KINDS = [
  "receipt",
  "issue",
  "requisition",
  "defect",
  "exchange",
  "repair",
  "liquidation",
  "stocktake",
  "fuel_receipt",
  "fuel_dispense",
  "requisition_return",
] as const;

export const adminDocKindSchema = z.enum(ADMIN_DOC_KINDS);

export const adminDeleteDocSchema = z.object({
  kind: adminDocKindSchema,
  id: z.string().uuid("ID phiếu không hợp lệ"),
  cascade: z.boolean().default(false),
  reason: z.string().min(3, "Vui lòng nhập lý do can thiệp tối thiểu 3 ký tự"),
});

export const adminReopenDocSchema = z.object({
  kind: adminDocKindSchema,
  id: z.string().uuid("ID phiếu không hợp lệ"),
  reason: z.string().min(3, "Vui lòng nhập lý do mở lại tối thiểu 3 ký tự"),
});

export const adminOverrideMetaSchema = z.object({
  kind: adminDocKindSchema,
  id: z.string().uuid("ID phiếu không hợp lệ"),
  createdAt: z.string().datetime().nullable().optional(),
  actorId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  reason: z.string().min(3, "Vui lòng nhập lý do sửa đổi tối thiểu 3 ký tự"),
});

export type AdminDeleteDocInput = z.infer<typeof adminDeleteDocSchema>;
export type AdminReopenDocInput = z.infer<typeof adminReopenDocSchema>;
export type AdminOverrideMetaInput = z.infer<typeof adminOverrideMetaSchema>;
