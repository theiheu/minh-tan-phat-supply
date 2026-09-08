"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, filterGroupsByRole, isGroupActive } from "@/lib/nav";
import type { Profile } from "@/lib/types";
import { useUIStore } from "@/stores/ui-store";

export function MobileNav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const groups = filterGroupsByRole(NAV_GROUPS, profile.role);
  // Show up to 4 primary groups on bottom bar, 5th is "Thêm" (More)
  const items = groups.slice(0, 4);
  const setMobileDrawerOpen = useUIStore((s) => s.setMobileDrawerOpen);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid h-16 grid-cols-5 border-t bg-background lg:hidden">
      {items.map((group) => {
        const Icon = group.icon;
        const active = isGroupActive(group, pathname);
        return (
          <Link
            key={group.id}
            href={group.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-1 text-[11px] text-muted-foreground",
              active && "text-primary font-medium",
            )}
          >
            <Icon className="size-5" />
            <span className="max-w-full truncate">{group.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setMobileDrawerOpen(true)}
        className="flex flex-col items-center justify-center gap-1 px-1 text-[11px] text-muted-foreground"
        aria-label="Xem thêm"
      >
        <MoreHorizontal className="size-5" />
        <span>Thêm</span>
      </button>
    </nav>
  );
}
