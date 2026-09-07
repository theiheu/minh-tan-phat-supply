import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  Package,
  PackageMinus,
  PackageOpen,
  Settings,
  Tags,
  Trash2,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
}

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Trang chủ", icon: LayoutDashboard },
  { href: "/products", label: "Kho vật tư", icon: PackageOpen },
  { href: "/requisitions", label: "Phiếu yêu cầu", icon: ClipboardList },
  { href: "/defects", label: "Vật tư hỏng", icon: Trash2 },
  { href: "/receipts", label: "Phiếu nhập", icon: Package, roles: ["manager"] },
  { href: "/issues", label: "Phiếu xuất", icon: PackageMinus, roles: ["manager"] },
  { href: "/repairs", label: "Sửa chữa", icon: Wrench, roles: ["manager"] },
  { href: "/liquidations", label: "Thanh lý", icon: Trash2, roles: ["manager"] },
  { href: "/stocktake", label: "Kiểm kê", icon: ClipboardCheck, roles: ["manager"] },
  { href: "/transfers", label: "Chuyển kho", icon: ArrowLeftRight, roles: ["manager"] },
  { href: "/reports", label: "Báo cáo", icon: BarChart3, roles: ["manager"] },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/products", label: "Vật tư", icon: Package, roles: ["manager"] },
  { href: "/admin/categories", label: "Danh mục", icon: Tags, roles: ["manager"] },
  { href: "/admin/zones", label: "Khu vực", icon: MapPin, roles: ["manager"] },
  { href: "/admin/locations", label: "Kho/vị trí", icon: Warehouse, roles: ["manager"] },
  { href: "/admin/suppliers", label: "Nhà cung cấp", icon: Building2, roles: ["manager"] },
  { href: "/admin/customers", label: "Khách hàng", icon: Users, roles: ["manager"] },
  { href: "/admin/users", label: "Người dùng", icon: Users, roles: ["manager"] },
];

export function filterByRole(items: NavItem[], role: string): NavItem[] {
  // superuser = toàn quyền: thấy mọi mục (kể cả mục dành riêng manager).
  if (role === "superuser") return items.filter((i) => !i.roles || i.roles.includes("manager") || i.roles.includes("superuser"));
  return items.filter((i) => !i.roles || i.roles.includes(role as Role));
}

export const ADMIN_ICON = Settings;

export function findTitle(pathname: string): string {
  const all = [...MAIN_NAV, ...ADMIN_NAV];
  const match = all
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "Trang chủ";
}
