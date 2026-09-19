import { tool } from "ai";
import { z } from "zod";

export const actionTools = {
  draft_requisition: tool({
    description: "Tạo nháp phiếu yêu cầu xuất cấp vật tư khi người dùng muốn xin cấp phát thiết bị mới.",
    parameters: z.object({
      productName: z.string().optional().describe("Tên vật tư cần xin cấp"),
      product_name: z.string().optional().describe("Tên vật tư thay thế"),
      item: z.string().optional().describe("Tên mặt hàng"),
      quantity: z.number().optional().default(1).describe("Số lượng yêu cầu"),
      qty: z.number().optional().describe("Số lượng thay thế"),
      unit: z.string().optional().default("Cái").describe("Đơn vị tính (Cái, Cuộn, Mét, Kg, Hộp)"),
      targetZone: z.string().optional().default("Khu trại chung").describe("Khu vực/trại sử dụng"),
      target_zone: z.string().optional().describe("Khu vực thay thế"),
      zone: z.string().optional().describe("Khu vực thay thế"),
      reason: z.string().optional().default("Cấp phát phục vụ sản xuất").describe("Lý do xin cấp vật tư"),
      purpose: z.string().optional().describe("Mục đích thay thế"),
    }).passthrough(),
    execute: async (rawArgs: {
      productName?: string;
      product_name?: string;
      item?: string;
      quantity?: number;
      qty?: number;
      unit?: string;
      targetZone?: string;
      target_zone?: string;
      zone?: string;
      reason?: string;
      purpose?: string;
    }) => {
      const productName = rawArgs.productName || rawArgs.product_name || rawArgs.item || "Vật tư chung";
      const quantity = typeof rawArgs.quantity === "number" ? rawArgs.quantity : (typeof rawArgs.qty === "number" ? rawArgs.qty : 1);
      const unit = rawArgs.unit || "Cái";
      const targetZone = rawArgs.targetZone || rawArgs.target_zone || rawArgs.zone || "Khu trại chung";
      const reason = rawArgs.reason || rawArgs.purpose || "Cấp phát phục vụ sản xuất";

      return {
        action: "DRAFT_REQUISITION",
        message: `Đã chuẩn bị nháp phiếu xin cấp phát cho: ${productName} - Số lượng: ${quantity} ${unit}.`,
        draft: {
          productName,
          quantity,
          unit,
          targetZone,
          reason,
          linkToCreate: `/requisitions/new?product=${encodeURIComponent(productName)}&qty=${quantity}&unit=${encodeURIComponent(unit)}`,
        },
      };
    },
  }),
};
