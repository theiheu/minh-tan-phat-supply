"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, filterGroupsByRole, isGroupActive } from "@/lib/nav";
import { roleLabel } from "@/lib/labels";
import type { Profile } from "@/lib/types";
import { useUIStore } from "@/stores/ui-store";
import { SignOutButton } from "./sign-out-button";

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const groups = filterGroupsByRole(NAV_GROUPS, profile.role);
  const mainGroups = groups.filter((g) => g.id !== "admin");
  const adminGroup = groups.find((g) => g.id === "admin");

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
      data-collapsed={collapsed}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b",
          collapsed ? "justify-center px-2" : "gap-2 px-4",
        )}
      >
        {collapsed ? (
          <span className="text-sm font-black text-primary" aria-label="Trại gà Minh Tân Phát">
            MTP
          </span>
        ) : (
          <span className="text-sm font-bold leading-tight">Trại gà Minh Tân Phát</span>
        )}
      </div>
      <nav className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-3")}>
        {mainGroups.map((group) => {
          const Icon = group.icon;
          const active = isGroupActive(group, pathname);
          return (
            <Link
              key={group.id}
              href={group.href}
              title={collapsed ? group.label : undefined}
              aria-label={collapsed ? group.label : undefined}
              className={cn(
                "flex items-center rounded-md py-2 text-sm transition-colors",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{group.label}</span>}
            </Link>
          );
        })}
        {adminGroup && (
          <>
            <div className="my-2 border-t border-sidebar-border" />
            <Link
              href={adminGroup.href}
              title={collapsed ? adminGroup.label : undefined}
              aria-label={collapsed ? adminGroup.label : undefined}
              className={cn(
                "flex items-center rounded-md py-2 text-sm transition-colors",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
                isGroupActive(adminGroup, pathname)
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <adminGroup.icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{adminGroup.label}</span>}
            </Link>
          </>
        )}
      </nav>
      <div
        className={cn(
          "flex items-center border-t",
          collapsed ? "justify-center p-2" : "justify-between gap-2 p-3",
        )}
      >
        {!collapsed && (
          <div className="min-w-0 text-sm">
            <div className="truncate font-medium">{profile.name}</div>
            <div className="text-xs text-muted-foreground">
              {roleLabel(profile.role)}
            </div>
          </div>
        )}
        <SignOutButton compact />
      </div>
    </aside>
  );
}
