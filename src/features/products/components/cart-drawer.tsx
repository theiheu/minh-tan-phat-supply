"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCartStore } from "@/stores/cart-store";
import { useUIStore } from "@/stores/ui-store";

export function CartDrawer() {
  const isOpen = useUIStore((s) => s.isCartOpen);
  const setCartOpen = useUIStore((s) => s.setCartOpen);
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const totalQty = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <Sheet open={isOpen} onOpenChange={setCartOpen}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Yêu cầu vật tư</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Yêu cầu vật tư trống.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={i.variantId} className="flex items-center gap-3 border-b pb-3">
                  {i.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.image} alt="" className="size-11 shrink-0 rounded-md border object-cover" />
                  ) : (
                    <div className="size-11 shrink-0 rounded-md border bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{i.name}</div>
                    <div className="text-xs text-muted-foreground">{i.label}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => updateQty(i.variantId, i.quantity - 1)}
                      aria-label="Giảm số lượng"
                    >
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-8 text-center text-sm tabular-nums">{i.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => updateQty(i.variantId, i.quantity + 1)}
                      aria-label="Tăng số lượng"
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeItem(i.variantId)}
                    aria-label="Xóa khỏi giỏ"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3 border-t px-4 py-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Tổng số lượng</span>
            <span className="font-medium tabular-nums text-foreground">{totalQty}</span>
          </div>
          <Button asChild className="w-full" disabled={items.length === 0}>
            <Link href="/requisitions/new" onClick={() => setCartOpen(false)}>
              Tạo phiếu yêu cầu
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
