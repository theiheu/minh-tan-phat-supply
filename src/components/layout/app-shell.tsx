"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartDrawer } from "@/features/products/components/cart-drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SlipDetailModal } from "@/components/slip-detail-modal";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, MAIN_NAV, filterByRole } from "@/lib/nav";
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
  const items = filterByRole([...MAIN_NAV, ...ADMIN_NAV], profile.role);

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
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetHeader className="flex h-14 items-center justify-between border-b px-4">
            <SheetTitle className="text-sm font-bold leading-tight">Trại gà Minh Tân Phát</SheetTitle>
          </SheetHeader>
          <div className="space-y-1 overflow-y-auto p-3">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    pathname.startsWith(item.href)
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
              <div className="min-w-0 text-sm">
                <div className="truncate font-medium">{profile.name}</div>
                <div className="text-xs text-muted-foreground">
                  {roleLabel(profile.role)}
                </div>
              </div>
              <SignOutButton />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
