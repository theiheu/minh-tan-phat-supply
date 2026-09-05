"use client";

import { ArrowLeft, ClipboardList, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ADMIN_NAV, MAIN_NAV, findTitle } from "@/lib/nav";
import { useCartStore } from "@/stores/cart-store";
import { useUIStore } from "@/stores/ui-store";
import { NotificationBell } from "./notification-bell";

export function Topbar() {
  const pathname = usePathname();
  const title = findTitle(pathname);
  const setMobileDrawerOpen = useUIStore((s) => s.setMobileDrawerOpen);
  const toggleCart = useUIStore((s) => s.toggleCart);
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));

  // Trang con (vd /requisitions/new, /requisitions/[id]) → nút ← về đúng màn danh sách.
  const sectionRoot = [...MAIN_NAV, ...ADMIN_NAV]
    .filter((i) => pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileDrawerOpen(true)}
        aria-label="Mở menu"
      >
        <Menu className="size-5" />
      </Button>
      {sectionRoot && (
        <Link
          href={sectionRoot}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Quay lại danh sách"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Quay lại</span>
        </Link>
      )}
      <h1 className="flex-1 truncate text-base font-semibold">{title}</h1>
      <NotificationBell />
      <Button
        variant="outline"
        size="sm"
        onClick={toggleCart}
        className="relative"
        aria-label="Yêu cầu vật tư"
      >
        <ClipboardList className="size-4" />
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {cartCount}
          </span>
        )}
      </Button>
    </header>
  );
}
