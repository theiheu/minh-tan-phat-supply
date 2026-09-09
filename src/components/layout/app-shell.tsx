"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartDrawer } from "@/features/products/components/cart-drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SlipDetailModal } from "@/components/slip-detail-modal";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, filterGroupsByRole, isGroupActive } from "@/lib/nav";
import { roleLabel } from "@/lib/labels";
import type { Profile } from "@/lib/types";
import { useUIStore } from "@/stores/ui-store";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { SignOutButton } from "./sign-out-button";
import { Topbar } from "./topbar";

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const mobileDrawerOpen = useUIStore((s) => s.mobileDrawerOpen);
  const setMobileDrawerOpen = useUIStore((s) => s.setMobileDrawerOpen);
  const slipModal = useUIStore((s) => s.slipModal);
  const closeSlipModal = useUIStore((s) => s.closeSlipModal);

  const groups = filterGroupsByRole(NAV_GROUPS, profile.role);
  const mainGroups = groups.filter((g) => g.id !== "admin");
  const adminGroup = groups.find((g) => g.id === "admin");

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 pb-24 lg:pb-6">{children}</main>
      </div>
      <MobileNav profile={profile} />
      <CartDrawer />
      <SlipDetailModal
        entityType={slipModal?.type ?? null}
        entityId={slipModal?.id ?? null}
        onClose={closeSlipModal}
      />
      <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
        <SheetContent side="left" className="flex h-full w-72 flex-col gap-0 p-0">
          <SheetHeader className="flex h-14 shrink-0 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2.5">
              <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-background shadow-xs ring-1 ring-primary/20">
                <Image
                  src="/brand/logo.jpg"
                  alt="Logo Trại gà Minh Tân Phát"
                  width={32}
                  height={32}
                  className="size-full object-cover"
                />
              </div>
              <div className="min-w-0 leading-none text-left">
                <div className="text-[8px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  TRẠI GÀ
                </div>
                <SheetTitle className="mt-0.5 truncate text-xs font-black tracking-wide text-foreground">
                  MINH TÂN PHÁT
                </SheetTitle>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 space-y-1 overflow-y-auto p-3">
            {mainGroups.map((group) => {
              const Icon = group.icon;
              const active = isGroupActive(group, pathname);
              return (
                <Link
                  key={group.id}
                  href={group.href}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
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
                <div className="my-2 border-t" />
                <Link
                  key={adminGroup.id}
                  href={adminGroup.href}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isGroupActive(adminGroup, pathname)
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <adminGroup.icon className="size-4 shrink-0" />
                  <span className="truncate">{adminGroup.label}</span>
                </Link>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t p-3">
            <div className="min-w-0 text-sm">
              <div className="truncate font-medium">{profile.name}</div>
              <div className="text-xs text-muted-foreground">
                {roleLabel(profile.role)}
              </div>
            </div>
            <SignOutButton compact />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
