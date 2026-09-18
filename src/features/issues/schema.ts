import { z } from "zod";

export const issueItemSchema = z.object({
  skuId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().positive().optional(),
  enteredQuantity: z.number().positive().optional(),
  transactionUnitId: z.string().uuid().optional().nullable(),
  unitPrice: z.number().nonnegative().optional(),
  batchNo: z.string().optional(),
  expiryDate: z.string().optional(),
  allocations: z.array(z.any()).optional(),
  overrideReason: z.string().optional(),
}).refine((data) => Boolean(data.skuId || data.variantId), {
  message: "Phải chọn vật tư (SKU)",
  path: ["skuId"],
}).refine((data) => (data.enteredQuantity != null && data.enteredQuantity > 0) || (data.quantity != null && data.quantity > 0), {
  message: "Số lượng xuất phải lớn hơn 0",
  path: ["enteredQuantity"],
});

export const issueSchema = z
  .object({
    destinationType: z.enum(["zone", "customer"]),
    zoneId: z.string().uuid().nullable().optional(),
    subZoneId: z.string().uuid().optional().nullable(),
    customerId: z.string().uuid().nullable().optional(),
    vehiclePlate: z.string().trim().max(50).optional(),
    driverName: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự").optional(),
    items: z.array(issueItemSchema).min(1, "Phải có ít nhất 1 vật tư"),
  })
  .superRefine((v, ctx) => {
    if (v.destinationType === "zone" && !v.zoneId)
      ctx.addIssue({ code: "custom", path: ["zoneId"], message: "Phải chọn khu nhận" });
    if (v.destinationType === "customer" && !v.customerId)
      ctx.addIssue({ code: "custom", path: ["customerId"], message: "Phải chọn khách hàng" });
  });

export type IssueInput = z.infer<typeof issueSchema>;
