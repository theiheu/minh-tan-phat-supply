import { tool } from "ai";
import { z } from "zod";

export const actionTools = {
  draft_requisition: tool({
    description: "Tạo nháp phiếu yêu cầu xuất cấp vật tư khi người dùng muốn xin cấp phát thiết bị mới.",
    parameters: z.object({
      productName: z.string().optional().default("").describe("Tên vật tư cần xin cấp"),
      quantity: z.number().optional().default(1).describe("Số lượng yêu cầu"),
      unit: z.string().optional().default("Cái").describe("Đơn vị tính (Cái, Cuộn, Mét, Kg, Hộp)"),
      targetZone: z.string().optional().default("Khu chuồng chung").describe("Khu vực/chuồng sử dụng"),
      reason: z.string().optional().default("Cấp phát phục vụ sản xuất").describe("Lý do xin cấp vật tư"),
    }),
    execute: async ({
      productName = "",
      quantity = 1,
      unit = "Cái",
      targetZone = "Khu chuồng chung",
      reason = "Cấp phát phục vụ sản xuất",
    }: {
      productName?: string;
      quantity?: number;
      unit?: string;
      targetZone?: string;
      reason?: string;
    }) => {
      return {
        action: "DRAFT_REQUISITION",
        message: `Đã chuẩn bị nháp phiếu xin cấp phát cho: ${productName || "vật tư"} - Số lượng: ${quantity} ${unit}.`,
        draft: {
          productName: productName || "Vật tư chung",
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
