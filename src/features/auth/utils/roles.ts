import { isSuperuser } from "@/lib/types";

// Danh sách vai trò theo đúng thứ tự phân cấp từ cao xuống thấp (Quản trị hệ thống -> Chủ trại -> Kế toán -> Quản kho -> Kỹ thuật -> Người yêu cầu -> Tài xế)
export function roleOptionsFor(currentRole: string, userRole?: string): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];

  if (isSuperuser(currentRole) || userRole === "superuser") {
    options.push({ value: "superuser", label: "Quản trị hệ thống" });
  }

  options.push(
    { value: "owner", label: "Chủ trại" },
    { value: "accountant", label: "Kế toán" },
    { value: "warehouse", label: "Quản kho" },
    { value: "technician", label: "Kỹ thuật (Quản lý khu)" },
    { value: "requester", label: "Người yêu cầu" },
    { value: "driver", label: "Tài xế" },
  );

  return options;
}

export type ZoneOption = { id: string; name: string };
