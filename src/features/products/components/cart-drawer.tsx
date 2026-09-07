"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCartStore } from "@/stores/cart-store";
import { useUIStore } from "@/stores/ui-store";
import { ZoomableImage } from "@/components/image-lightbox";

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
                    <ZoomableImage
                      src={i.image}
                      alt={i.name}
                      title={`${i.name} · ${i.label}`}
                      className="size-11 shrink-0 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="size-11 shrink-0 rounded-md border bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{i.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate">{i.label}</span>
                      {i.stock === 0 && (
                        <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          Chờ nhập hàng
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => updateQty(i.variantId, Math.max(1, i.quantity - 1))}
                      aria-label="Giảm số lượng"
                    >
                      <Minus className="size-3" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      className="h-7 w-14 text-center text-xs font-medium tabular-nums px-1"
                      value={i.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) {
                          updateQty(i.variantId, val);
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (isNaN(val) || val < 1) {
                          updateQty(i.variantId, 1);
                        }
                      }}
                    />
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
          {items.some((i) => i.stock === 0) && (
            <p className="rounded bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              ⚠️ Có vật tư đang hết hàng. Phiếu yêu cầu sẽ được chuyển cho quản kho đặt hàng và cấp phát khi hàng về.
            </p>
          )}
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
