import { z } from "zod";

export const requisitionSchema = z
  .object({
    zoneId: z.string().uuid(),
    purpose: z.string().min(1, "Mục đích không được trống"),
    requisitionType: z.enum(["new_supply", "replacement"]).default("new_supply"),
    linkedDefectId: z.string().uuid().optional(),
    items: z
      .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().positive() }))
      .min(1, "Phải có ít nhất 1 vật tư"),
  })
  .superRefine((v, ctx) => {
    if (v.requisitionType === "replacement" && !v.linkedDefectId) {
      ctx.addIssue({ code: "custom", message: "Đổi mới phải chọn phiếu hỏng liên quan", path: ["linkedDefectId"] });
    }
  });

export type RequisitionInput = z.infer<typeof requisitionSchema>;
