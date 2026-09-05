"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, MAIN_NAV, filterByRole, type NavItem } from "@/lib/nav";
import { roleLabel } from "@/lib/labels";
import type { Profile } from "@/lib/types";
import { SignOutButton } from "./sign-out-button";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const main = filterByRole(MAIN_NAV, profile.role);
  const admin = filterByRole(ADMIN_NAV, profile.role);

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <span className="text-sm font-bold leading-tight">Trại gà Minh Tân Phát</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {main.map((item) => (
          <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
        ))}
        {admin.length > 0 && (
          <>
            <div className="px-3 pt-4 pb-1 text-xs font-semibold uppercase text-muted-foreground">
              Quản trị
            </div>
            {admin.map((item) => (
              <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
            ))}
          </>
        )}
      </nav>
      <div className="flex items-center justify-between gap-2 border-t p-3">
        <div className="min-w-0 text-sm">
          <div className="truncate font-medium">{profile.name}</div>
          <div className="text-xs text-muted-foreground">
            {roleLabel(profile.role)}
          </div>
        </div>
        <SignOutButton compact />
      </div>
    </aside>
  );
}
