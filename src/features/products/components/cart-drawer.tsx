"use client";

import { Minus, Package, Plus, Trash2 } from "lucide-react";
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
                <li key={i.variantId} className="flex items-start gap-3 border-b pb-3">
                  {i.image ? (
                    <ZoomableImage
                      src={i.image}
                      alt={i.name}
                      title={`${i.name} · ${i.label}`}
                      className="size-14 sm:size-16 shrink-0 rounded-lg border object-cover aspect-square"
                    />
                  ) : (
                    <div className="flex size-14 sm:size-16 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                      <Package className="size-6 opacity-40" aria-hidden />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug line-clamp-2">{i.name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      {i.label && i.label !== i.unit && <span className="truncate">{i.label}</span>}
                      {i.unit && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground text-[10px]">
                          ĐVT: {i.unit}
                        </span>
                      )}
                      {i.stock === 0 && (
                        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          Chờ nhập hàng
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between gap-2 shrink-0 self-stretch">
                    {/* Thùng rác ở trên */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive p-0"
                      onClick={() => removeItem(i.variantId)}
                      aria-label="Xóa khỏi giỏ"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>

                    {/* Số lượng ở dưới */}
                    <div className="inline-flex h-6 items-center rounded-md border border-border/80 bg-background p-0.5 shadow-xs">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="h-5 w-5 rounded text-foreground hover:bg-muted p-0"
                        onClick={() => updateQty(i.variantId, Math.max(1, i.quantity - 1))}
                        aria-label="Giảm số lượng"
                      >
                        <Minus className="size-2.5" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        className="h-5 w-7 border-0 bg-transparent text-center text-xs font-bold tabular-nums p-0 focus-visible:ring-0 shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                        variant="ghost"
                        size="icon-xs"
                        className="h-5 w-5 rounded text-foreground hover:bg-muted p-0"
                        onClick={() => updateQty(i.variantId, i.quantity + 1)}
                        aria-label="Tăng số lượng"
                      >
                        <Plus className="size-2.5" />
                      </Button>
                    </div>
                  </div>
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
