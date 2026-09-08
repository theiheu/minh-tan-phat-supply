import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Fuel,
  LayoutDashboard,
  MapPin,
  Package,
  PackageMinus,
  PackageOpen,
  Settings,
  Tags,
  Trash2,
  Truck,
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

export interface NavGroup {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: Role[];
  items: NavItem[];
}

export const REQUISITION_NAV_ITEMS: NavItem[] = [
  { href: "/products", label: "Chọn vật tư", icon: PackageOpen },
  { href: "/requisitions", label: "Phiếu yêu cầu", icon: ClipboardList },
];

export const WAREHOUSE_NAV_ITEMS: NavItem[] = [
  { href: "/receipts", label: "Phiếu nhập", icon: Package, roles: ["manager"] },
  { href: "/issues", label: "Phiếu xuất", icon: PackageMinus, roles: ["manager"] },
  { href: "/transfers", label: "Chuyển kho", icon: ArrowLeftRight, roles: ["manager"] },
  { href: "/stocktake", label: "Kiểm kê", icon: ClipboardCheck, roles: ["manager"] },
];

export const DEFECTS_NAV_ITEMS: NavItem[] = [
  { href: "/defects", label: "Vật tư hỏng & Đổi mới", icon: Trash2 },
  { href: "/repairs", label: "Sửa chữa", icon: Wrench, roles: ["manager"] },
  { href: "/liquidations", label: "Thanh lý", icon: Trash2, roles: ["manager"] },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/products", label: "Vật tư", icon: Package, roles: ["manager"] },
  { href: "/admin/categories", label: "Danh mục", icon: Tags, roles: ["manager"] },
  { href: "/admin/zones", label: "Khu vực", icon: MapPin, roles: ["manager"] },
  { href: "/admin/locations", label: "Kho/vị trí", icon: Warehouse, roles: ["manager"] },
  { href: "/admin/suppliers", label: "Nhà cung cấp", icon: Building2, roles: ["manager"] },
  { href: "/admin/customers", label: "Khách hàng", icon: Users, roles: ["manager"] },
  { href: "/admin/vehicles", label: "Phương tiện", icon: Truck, roles: ["manager"] },
  { href: "/admin/users", label: "Người dùng", icon: Users, roles: ["manager"] },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    label: "Trang chủ",
    href: "/dashboard",
    icon: LayoutDashboard,
    items: [{ href: "/dashboard", label: "Trang chủ", icon: LayoutDashboard }],
  },
  {
    id: "requisitions",
    label: "Yêu cầu vật tư",
    href: "/products",
    icon: PackageOpen,
    items: REQUISITION_NAV_ITEMS,
  },
  {
    id: "warehouse",
    label: "Quản lý kho",
    href: "/receipts",
    icon: Warehouse,
    roles: ["manager"],
    items: WAREHOUSE_NAV_ITEMS,
  },
  {
    id: "defects",
    label: "Vật tư hỏng",
    href: "/defects",
    icon: Wrench,
    items: DEFECTS_NAV_ITEMS,
  },
  {
    id: "fuel",
    label: "Kho dầu",
    href: "/fuel",
    icon: Fuel,
    roles: ["manager"],
    items: [{ href: "/fuel", label: "Kho dầu", icon: Fuel, roles: ["manager"] }],
  },
  {
    id: "reports",
    label: "Báo cáo",
    href: "/reports",
    icon: BarChart3,
    roles: ["manager"],
    items: [{ href: "/reports", label: "Báo cáo", icon: BarChart3, roles: ["manager"] }],
  },
  {
    id: "admin",
    label: "Quản trị",
    href: "/admin/products",
    icon: Settings,
    roles: ["manager"],
    items: ADMIN_NAV_ITEMS,
  },
];

export const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Trang chủ", icon: LayoutDashboard },
  ...REQUISITION_NAV_ITEMS,
  ...WAREHOUSE_NAV_ITEMS,
  ...DEFECTS_NAV_ITEMS,
  { href: "/fuel", label: "Kho dầu", icon: Fuel, roles: ["manager"] },
  { href: "/reports", label: "Báo cáo", icon: BarChart3, roles: ["manager"] },
  ...ADMIN_NAV_ITEMS,
];

export const MAIN_NAV: NavItem[] = ALL_NAV_ITEMS.filter((i) => !i.href.startsWith("/admin"));
export const ADMIN_NAV: NavItem[] = ADMIN_NAV_ITEMS;

export function filterByRole(items: NavItem[], role: string): NavItem[] {
  // superuser = toàn quyền: thấy mọi mục (kể cả mục dành riêng manager).
  if (role === "superuser") return items.filter((i) => !i.roles || i.roles.includes("manager") || i.roles.includes("superuser"));
  return items.filter((i) => !i.roles || i.roles.includes(role as Role));
}

export function filterGroupsByRole(groups: NavGroup[], role: string): NavGroup[] {
  return groups
    .filter((g) => {
      if (role === "superuser") return true;
      if (g.roles && !g.roles.includes(role as Role)) return false;
      const accessibleItems = filterByRole(g.items, role);
      return accessibleItems.length > 0;
    })
    .map((g) => {
      const accessibleItems = filterByRole(g.items, role);
      const firstHref = accessibleItems[0]?.href ?? g.href;
      const isHrefAccessible = accessibleItems.some((i) => i.href === g.href);
      return {
        ...g,
        href: isHrefAccessible ? g.href : firstHref,
        items: accessibleItems,
      };
    });
}

export function isGroupActive(group: NavGroup, pathname: string): boolean {
  if (group.id === "dashboard") {
    return pathname === "/dashboard";
  }
  return group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
}

export const ADMIN_ICON = Settings;

export function findTitle(pathname: string): string {
  const match = ALL_NAV_ITEMS
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "Trang chủ";
}
