"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [targetHref, setTargetHref] = useState<string | null>(null);

  const sourceItems = group ? GROUP_ITEMS_MAP[group] : (items ?? []);
  const visibleItems = userRole ? filterByRole(sourceItems, userRole) : sourceItems;

  // Clear targetHref once navigation settles
  useEffect(() => {
    setTargetHref(null);
  }, [pathname]);

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

  const handleTabClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href === currentHref || (currentHref && href === currentHref)) return;
    
    // Set immediate pending state for instant visual feedback
    setTargetHref(href);
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <div
      className={cn(
        "overflow-x-auto border-b pb-0.5 scrollbar-none -mx-2.5 px-2.5 sm:-mx-4 sm:px-4",
        className,
      )}
    >
      <nav className="-mb-px flex min-w-max space-x-2 sm:space-x-6" aria-label="Tabs">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isTargetPending = isPending && targetHref === item.href;
          const isActive = !isPending ? item.href === currentHref : (item.href === targetHref || (!targetHref && item.href === currentHref));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => handleTabClick(e, item.href)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-2 py-2.5 text-xs sm:text-sm font-medium transition-all",
                isActive
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                isTargetPending && "opacity-90 animate-pulse"
              )}
            >
              {isTargetPending ? (
                <Loader2 className="size-3.5 sm:size-4 shrink-0 animate-spin text-primary" />
              ) : (
                Icon && <Icon className="size-3.5 sm:size-4 shrink-0" />
              )}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
