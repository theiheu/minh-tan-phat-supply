"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ADMIN_NAV_ITEMS,
  DEFECTS_NAV_ITEMS,
  REQUISITION_NAV_ITEMS,
  WAREHOUSE_NAV_ITEMS,
  filterByRole,
  type NavItem,
} from "@/lib/nav";
import type { Role } from "@/lib/types";

export type SubnavGroupId = "requisitions" | "warehouse" | "defects" | "admin";

const GROUP_ITEMS_MAP: Record<SubnavGroupId, NavItem[]> = {
  requisitions: REQUISITION_NAV_ITEMS,
  warehouse: WAREHOUSE_NAV_ITEMS,
  defects: DEFECTS_NAV_ITEMS,
  admin: ADMIN_NAV_ITEMS,
};

export interface SubnavTabsProps {
  group?: SubnavGroupId;
  items?: NavItem[];
  userRole?: Role | string;
  activeHref?: string;
  className?: string;
}

export function SubnavTabs({
  group,
  items,
  userRole,
  activeHref,
  className,
}: SubnavTabsProps) {
  const pathname = usePathname();
  const sourceItems = group ? GROUP_ITEMS_MAP[group] : (items ?? []);
  const visibleItems = userRole ? filterByRole(sourceItems, userRole) : sourceItems;

  if (visibleItems.length <= 1) {
    return null;
  }

  // Find active item: either matching activeHref or matching pathname prefix
  const matchedItem = activeHref
    ? visibleItems.find((i) => i.href === activeHref)
    : visibleItems
        .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
        .sort((a, b) => b.href.length - a.href.length)[0];

  const currentHref = matchedItem?.href ?? visibleItems[0]?.href;

  return (
    <div
      className={cn(
        "overflow-x-auto border-b pb-0.5 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0",
        className,
      )}
    >
      <nav className="-mb-px flex min-w-max space-x-2 sm:space-x-6" aria-label="Tabs">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === currentHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {Icon && <Icon className="size-3.5 sm:size-4 shrink-0" />}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
