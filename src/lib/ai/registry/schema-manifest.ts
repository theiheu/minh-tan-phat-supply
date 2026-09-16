export interface SystemCapability {
  id: string;
  name: string;
  description: string;
  tools: string[];
}

export const SYSTEM_CAPABILITIES: SystemCapability[] = [
  {
    id: "inventory",
    name: "Quản lý Tồn kho & Vật tư",
    description: "Tra cứu tồn kho thực tế, vị trí lưu kho, danh mục sản phẩm, quy cách đóng gói và cảnh báo hết hàng.",
    tools: ["get_stock_balance", "search_catalog", "get_low_stock_alerts"],
  },
  {
    id: "fuel",
    name: "Nhiên liệu & Phương tiện (Xăng dầu)",
    description: "Báo cáo cấp phát dầu Diesel/Xăng cho xe tải, máy xúc, máy phát điện dự phòng, kiểm tra chỉ số ODO.",
    tools: ["get_fuel_dispense_report", "get_vehicles_list"],
  },
  {
    id: "reports",
    name: "Báo cáo Vận hành & Cấp phát",
    description: "Tổng hợp phiếu yêu cầu cấp phát vật tư theo khu trại, phiếu báo hỏng đổi 1-1, phiếu sửa chữa.",
    tools: ["get_recent_requisitions", "get_recent_defects"],
  },
  {
    id: "sop",
    name: "Quy trình & Hướng dẫn sử dụng (SOP)",
    description: "Tra cứu quy trình chuẩn: Nhập kho, Xuất kho, Báo hỏng, Đổi 1-1, Mượn trả dụng cụ, Kiểm kê.",
    tools: ["search_sop_knowledge"],
  },
  {
    id: "actions",
    name: "Hỗ trợ Thao tác Nhanh (Copilot Drafter)",
    description: "Lập nháp phiếu xin cấp phát vật tư để người dùng chỉ cần nhấn xác nhận.",
    tools: ["draft_requisition"],
  },
];

export const CAPABILITY_MANIFEST_TEXT = SYSTEM_CAPABILITIES.map(
  (c) => `- [${c.name}]: ${c.description} (Tools: ${c.tools.join(", ")})`
).join("\n");
