"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { variantLabel } from "@/lib/labels";
import { useCartStore } from "@/stores/cart-store";
import type { Product } from "@/lib/types";
import type { VariantWithStock } from "../types";

export function ProductDetailDialog({
  open,
  onOpenChange,
  product,
  variants,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  variants: VariantWithStock[];
}) {
  const addItem = useCartStore((s) => s.addItem);
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];

  function addToCart() {
    if (!selected) return;
    addItem({
      variantId: selected.id,
      quantity: qty,
      name: product.name,
      label: variantLabel(selected.attributes, selected.unit),
      unit: selected.unit,
      image: selected.images?.[0] ?? product.images?.[0] ?? null,
    });
    toast.success("Đã thêm vào giỏ");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          {product.description ? <DialogDescription>{product.description}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-2">
          {variants.map((v) => (
            <label
              key={v.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                selectedId === v.id ? "border-primary bg-primary/5" : "hover:bg-accent"
              }`}
            >
              <input
                type="radio"
                name="variant"
                checked={selectedId === v.id}
                onChange={() => {
                  setSelectedId(v.id);
                  setQty(1);
                }}
                className="size-4 shrink-0 accent-primary"
              />
              {v.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.images[0]} alt="" className="size-10 shrink-0 rounded-md border object-cover" />
              ) : (
                <div className="size-10 shrink-0 rounded-md border bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{variantLabel(v.attributes, v.unit)}</span>
                  {v.is_default && (
                    <Badge variant="warning" className="shrink-0">
                      Mặc định
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {v.isComposite ? "Bộ linh kiện" : v.unit ?? ""}
                </div>
              </div>
              <div className="shrink-0 text-right text-sm">
                <div className={`text-xs ${v.stock === 0 ? "text-red-600" : "text-emerald-600"}`}>
                  Tồn: {v.stock}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Số lượng</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-xs" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Giảm số lượng">
              −
            </Button>
            <span className="w-10 text-center tabular-nums">{qty}</span>
            <Button variant="outline" size="icon-xs" onClick={() => setQty((q) => q + 1)} aria-label="Tăng số lượng">
              +
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={addToCart} disabled={!selected || selected.stock === 0}>
            Thêm vào giỏ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
