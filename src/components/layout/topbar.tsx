"use client";

import { Menu, ShoppingCart } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { findTitle } from "@/lib/nav";
import { useCartStore } from "@/stores/cart-store";
import { useUIStore } from "@/stores/ui-store";

export function Topbar() {
  const pathname = usePathname();
  const title = findTitle(pathname);
  const setMobileDrawerOpen = useUIStore((s) => s.setMobileDrawerOpen);
  const toggleCart = useUIStore((s) => s.toggleCart);
  const cartCount = useCartStore((s) => s.items.length);
  const showCart = pathname.startsWith("/products");

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
      <h1 className="flex-1 truncate text-base font-semibold">{title}</h1>
      {showCart && (
        <Button
          variant="outline"
          size="sm"
          onClick={toggleCart}
          className="relative"
          aria-label="Giỏ hàng"
        >
          <ShoppingCart className="size-4" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {cartCount}
            </span>
          )}
        </Button>
      )}
    </header>
  );
}
