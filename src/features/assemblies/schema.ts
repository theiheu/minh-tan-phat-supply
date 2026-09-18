import { z } from "zod";

const uuidSchema = z.string().uuid("Định dạng UUID không hợp lệ");

export const assemblyOrderSchema = z.object({
  kitSkuId: uuidSchema,
  bomVersionId: uuidSchema,
  quantity: z.coerce
    .number()
    .positive("Số lượng lắp ráp phải lớn hơn 0"),
  componentLocationId: uuidSchema,
  finishedLocationId: uuidSchema,
  documentId: uuidSchema.optional(),
  idempotencyKey: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const disassemblyItemSchema = z
  .object({
    componentSkuId: uuidSchema,
    recoveredQuantity: z.coerce
      .number()
      .min(0, "Số lượng thu hồi không được nhỏ hơn 0"),
    damagedQuantity: z.coerce
      .number()
      .min(0, "Số lượng hỏng không được nhỏ hơn 0"),
    lostQuantity: z.coerce
      .number()
      .min(0, "Số lượng thất thoát không được nhỏ hơn 0"),
    recoveryLocationId: uuidSchema,
    damagedLocationId: uuidSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.damagedQuantity > 0 && !data.damagedLocationId) {
      ctx.addIssue({
        code: "custom",
        path: ["damagedLocationId"],
        message: "Cần chọn kho lưu trữ khi có linh kiện hỏng",
      });
    }
  });

export const disassemblyOrderSchema = z.object({
  kitSkuId: uuidSchema,
  bomVersionId: uuidSchema,
  quantity: z.coerce
    .number()
    .positive("Số lượng tháo dỡ phải lớn hơn 0"),
  fromLocationId: uuidSchema,
  items: z
    .array(disassemblyItemSchema)
    .min(1, "Danh sách linh kiện không được trống"),
  documentId: uuidSchema.optional(),
  idempotencyKey: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type AssemblyOrderInput = z.infer<typeof assemblyOrderSchema>;
export type DisassemblyItemInput = z.infer<typeof disassemblyItemSchema>;
export type DisassemblyOrderInput = z.infer<typeof disassemblyOrderSchema>;
