import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  Bot,
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

const ALL_SUPPLY_ROLES: Role[] = [
  "requester",
  "technician",
  "warehouse",
  "accountant",
  "owner",
  "superuser",
];

const WAREHOUSE_ROLES: Role[] = [
  "warehouse",
  "accountant",
  "owner",
  "superuser",
];

const REPAIR_ROLES: Role[] = [
  "technician",
  "warehouse",
  "accountant",
  "owner",
  "superuser",
];

const FUEL_ROLES: Role[] = [
  "driver",
  "warehouse",
  "accountant",
  "owner",
  "superuser",
];

const REPORT_ROLES: Role[] = [
  "technician",
  "warehouse",
  "accountant",
  "owner",
  "superuser",
];

const ADMIN_ROLES: Role[] = [
  "warehouse",
  "accountant",
  "owner",
  "superuser",
];

export const REQUISITION_NAV_ITEMS: NavItem[] = [
  { href: "/products", label: "Chọn vật tư", icon: PackageOpen, roles: ALL_SUPPLY_ROLES },
  { href: "/requisitions", label: "Phiếu yêu cầu", icon: ClipboardList, roles: ALL_SUPPLY_ROLES },
  { href: "/tools", label: "Dụng cụ", icon: Wrench, roles: ALL_SUPPLY_ROLES },
];

export const WAREHOUSE_NAV_ITEMS: NavItem[] = [
  { href: "/receipts", label: "Phiếu nhập", icon: Package, roles: WAREHOUSE_ROLES },
  { href: "/issues", label: "Phiếu xuất", icon: PackageMinus, roles: WAREHOUSE_ROLES },
  { href: "/transfers", label: "Chuyển kho", icon: ArrowLeftRight, roles: WAREHOUSE_ROLES },
  { href: "/stocktake", label: "Kiểm kê", icon: ClipboardCheck, roles: WAREHOUSE_ROLES },
];

export const DEFECTS_NAV_ITEMS: NavItem[] = [
  { href: "/defects", label: "Vật tư hỏng & Đổi mới", icon: Trash2, roles: ALL_SUPPLY_ROLES },
  { href: "/repairs", label: "Sửa chữa", icon: Wrench, roles: REPAIR_ROLES },
  { href: "/liquidations", label: "Thanh lý", icon: Trash2, roles: WAREHOUSE_ROLES },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/products", label: "Vật tư", icon: Package, roles: ADMIN_ROLES },
  { href: "/admin/categories", label: "Danh mục", icon: Tags, roles: ADMIN_ROLES },
  { href: "/admin/zones", label: "Khu vực", icon: MapPin, roles: ADMIN_ROLES },
  { href: "/admin/locations", label: "Kho/vị trí", icon: Warehouse, roles: ADMIN_ROLES },
  { href: "/admin/suppliers", label: "Nhà cung cấp", icon: Building2, roles: ADMIN_ROLES },
  { href: "/admin/customers", label: "Khách hàng", icon: Users, roles: ADMIN_ROLES },
  { href: "/admin/vehicles", label: "Phương tiện", icon: Truck, roles: ADMIN_ROLES },
  { href: "/admin/users", label: "Người dùng", icon: Users, roles: ADMIN_ROLES },
  { href: "/admin/ai-copilot", label: "AI Copilot", icon: Bot, roles: ADMIN_ROLES },
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
    roles: ALL_SUPPLY_ROLES,
    items: REQUISITION_NAV_ITEMS,
  },
  {
    id: "warehouse",
    label: "Quản lý kho",
    href: "/receipts",
    icon: Warehouse,
    roles: WAREHOUSE_ROLES,
    items: WAREHOUSE_NAV_ITEMS,
  },
  {
    id: "defects",
    label: "Vật tư hỏng",
    href: "/defects",
    icon: Wrench,
    roles: ALL_SUPPLY_ROLES,
    items: DEFECTS_NAV_ITEMS,
  },
  {
    id: "fuel",
    label: "Kho dầu",
    href: "/fuel",
    icon: Fuel,
    roles: FUEL_ROLES,
    items: [{ href: "/fuel", label: "Kho dầu", icon: Fuel, roles: FUEL_ROLES }],
  },
  {
    id: "reports",
    label: "Báo cáo",
    href: "/reports",
    icon: BarChart3,
    roles: REPORT_ROLES,
    items: [{ href: "/reports", label: "Báo cáo", icon: BarChart3, roles: REPORT_ROLES }],
  },
  {
    id: "admin",
    label: "Quản trị",
    href: "/admin/products",
    icon: Settings,
    roles: ADMIN_ROLES,
    items: ADMIN_NAV_ITEMS,
  },
];

export const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Trang chủ", icon: LayoutDashboard },
  ...REQUISITION_NAV_ITEMS,
  ...WAREHOUSE_NAV_ITEMS,
  ...DEFECTS_NAV_ITEMS,
  { href: "/fuel", label: "Kho dầu", icon: Fuel, roles: FUEL_ROLES },
  { href: "/reports", label: "Báo cáo", icon: BarChart3, roles: REPORT_ROLES },
  ...ADMIN_NAV_ITEMS,
];

export const MAIN_NAV: NavItem[] = ALL_NAV_ITEMS.filter((i) => !i.href.startsWith("/admin"));
export const ADMIN_NAV: NavItem[] = ADMIN_NAV_ITEMS;

export function filterByRole(items: NavItem[], role: string): NavItem[] {
  if (role === "superuser") return items;
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
