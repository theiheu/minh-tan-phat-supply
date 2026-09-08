"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, filterGroupsByRole, isGroupActive } from "@/lib/nav";
import { roleLabel } from "@/lib/labels";
import type { Profile } from "@/lib/types";
import { SignOutButton } from "./sign-out-button";

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const groups = filterGroupsByRole(NAV_GROUPS, profile.role);
  const mainGroups = groups.filter((g) => g.id !== "admin");
  const adminGroup = groups.find((g) => g.id === "admin");

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <span className="text-sm font-bold leading-tight">Trại gà Minh Tân Phát</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {mainGroups.map((group) => {
          const Icon = group.icon;
          const active = isGroupActive(group, pathname);
          return (
            <Link
              key={group.id}
              href={group.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{group.label}</span>
            </Link>
          );
        })}
        {adminGroup && (
          <>
            <div className="my-2 border-t border-sidebar-border" />
            <Link
              href={adminGroup.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isGroupActive(adminGroup, pathname)
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <adminGroup.icon className="size-4 shrink-0" />
              <span className="truncate">{adminGroup.label}</span>
            </Link>
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
