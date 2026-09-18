import { z } from "zod";

const uuid = z.string().uuid();
const decimalString = z.string().regex(/^\d+(?:\.\d{1,9})?$/, "Số thập phân không hợp lệ");
const positiveQuantity = decimalString.refine((value) => Number(value) > 0, "Số lượng phải lớn hơn 0");

export const postingAllocationSchema = z.object({
  lotId: uuid.optional(),
  serialId: uuid.optional(),
  quantity: positiveQuantity,
}).superRefine((value, ctx) => {
  if (Number(Boolean(value.lotId)) + Number(Boolean(value.serialId)) > 1) {
    ctx.addIssue({ code: "custom", message: "Mỗi allocation chỉ được chọn lot hoặc serial" });
  }
  if (value.serialId && value.quantity !== "1") {
    ctx.addIssue({ code: "custom", message: "Mỗi serial phải có quantity = 1" });
  }
});

export const postingLineSchema = z.object({
  skuId: uuid,
  fromLocationId: uuid.optional(),
  toLocationId: uuid.optional(),
  enteredQuantity: positiveQuantity,
  transactionUnitId: uuid.optional(),
  unitCost: decimalString.optional(),
  sourceLineId: uuid.optional(),
  allocations: z.array(postingAllocationSchema).optional(),
}).superRefine((value, ctx) => {
  if (!value.fromLocationId && !value.toLocationId) {
    ctx.addIssue({ code: "custom", message: "Dòng phải có kho nguồn hoặc kho đích" });
  }
  if (value.fromLocationId && value.toLocationId && value.fromLocationId === value.toLocationId) {
    ctx.addIssue({ code: "custom", message: "Kho nguồn và kho đích phải khác nhau" });
  }
});

export const postingCommandSchema = z.object({
  documentType: z.string().trim().min(1),
  documentId: uuid,
  idempotencyKey: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
  lines: z.array(postingLineSchema).min(1),
});

export const reservationCommandSchema = z.object({
  skuId: uuid,
  locationId: uuid,
  sourceDocumentType: z.string().trim().min(1),
  sourceDocumentId: uuid,
  sourceDocumentLineId: uuid,
  baseQuantity: positiveQuantity,
  idempotencyKey: z.string().trim().min(1).optional(),
});

export type PostingAllocation = z.infer<typeof postingAllocationSchema>;
export type PostingLine = z.infer<typeof postingLineSchema>;
export type PostingCommand = z.infer<typeof postingCommandSchema>;
export type ReservationCommand = z.infer<typeof reservationCommandSchema>;

export interface PostingRpcCommand {
  document_type: string;
  document_id: string;
  idempotency_key?: string;
  notes?: string;
  lines: Array<{
    sku_id: string;
    from_location_id?: string;
    to_location_id?: string;
    entered_quantity: string;
    transaction_unit_id?: string;
    unit_cost?: string;
    source_line_id?: string;
    allocations?: Array<{ lot_id?: string; serial_id?: string; quantity: string }>;
  }>;
}
