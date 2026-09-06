import { z } from "zod";

export const issueItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
});

export const issueSchema = z
  .object({
    destinationType: z.enum(["zone", "customer"]),
    zoneId: z.string().uuid().nullable(),
    customerId: z.string().uuid().nullable(),
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
