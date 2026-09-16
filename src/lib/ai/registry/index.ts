import { inventoryTools } from "./tools/inventory-tools";
import { fuelTools } from "./tools/fuel-tools";
import { reportTools } from "./tools/report-tools";
import { sopTools } from "./tools/sop-tools";
import { actionTools } from "./tools/action-tools";

/**
 * Tập hợp toàn bộ công cụ nghiệp vụ của MTP Farm ERP Copilot.
 * Phân quyền theo role người dùng để đảm bảo an toàn thông tin.
 */
export function getRegisteredTools(userRole?: string) {
  const isPrivileged = ["owner", "accountant", "warehouse", "superuser"].includes(userRole || "");

  // Mọi user đều được dùng tra cứu kho cơ bản, SOP và lập nháp phiếu
  const baseTools = {
    ...inventoryTools,
    ...sopTools,
    ...actionTools,
  };

  // Chỉ role quản lý/kho/kế toán mới được xem báo cáo chuyên sâu và nhiên liệu toàn trang trại
  if (isPrivileged) {
    return {
      ...baseTools,
      ...fuelTools,
      ...reportTools,
    };
  }

  return baseTools;
}
