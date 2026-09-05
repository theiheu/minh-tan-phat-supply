"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MAIN_NAV, filterByRole } from "@/lib/nav";
import type { Profile } from "@/lib/types";
import { useUIStore } from "@/stores/ui-store";

export function MobileNav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const items = filterByRole(MAIN_NAV, profile.role).slice(0, 4);
  const setMobileDrawerOpen = useUIStore((s) => s.setMobileDrawerOpen);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid h-16 grid-cols-5 border-t bg-background lg:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-1 text-[11px] text-muted-foreground",
              active && "text-primary",
            )}
          >
            <Icon className="size-5" />
            <span className="max-w-full truncate">{item.label}</span>
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
