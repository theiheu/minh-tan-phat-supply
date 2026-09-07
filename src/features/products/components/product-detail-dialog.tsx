"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { kitLabel } from "@/lib/attributes";
import { variantLabel } from "@/lib/labels";
import { useCartStore } from "@/stores/cart-store";
import type { Product } from "@/lib/types";
import type { VariantWithStock } from "../types";
import { ZoomableImage } from "@/components/image-lightbox";

/** Tên hiển thị cho 1 dòng: quy cách, hoặc bộ kèm "gồm linh kiện ×định mức". */
function variantDisplayName(v: VariantWithStock): string {
  const base = variantLabel(v.attributes, v.unit);
  return v.isComposite ? kitLabel(base, v.components ?? []) : base;
}

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
  const [qty, setQty] = useState("1");
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  const numQty = Math.max(1, parseInt(qty, 10) || 1);

  function addToCart() {
    if (!selected) return;
    const finalQty = numQty;
    addItem({
      variantId: selected.id,
      quantity: finalQty,
      name: product.name,
      label: variantLabel(selected.attributes, selected.unit),
      unit: selected.unit,
      image: selected.images?.[0] ?? product.images?.[0] ?? null,
      stock: selected.stock,
    });
    if (selected.stock === 0) {
      toast.success("Đã thêm vào giỏ (vật tư hết hàng — sẽ đặt hàng chờ nhập kho)");
    } else if (finalQty > selected.stock) {
      toast.success(`Đã thêm vào giỏ (tồn hiện có: ${selected.stock}, sẽ chờ nhập thêm ${finalQty - selected.stock})`);
    } else {
      toast.success("Đã thêm vào giỏ");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="pb-3 border-b border-border/60">
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
                  setQty("1");
                }}
                className="size-4 shrink-0 accent-primary"
              />
              {v.images?.[0] ? (
                <ZoomableImage
                  src={v.images[0]}
                  images={v.images}
                  alt={variantDisplayName(v)}
                  className="size-10 shrink-0 rounded-md border object-cover"
                />
              ) : (
                <div className="size-10 shrink-0 rounded-md border bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{variantDisplayName(v)}</span>
                  {v.is_default && (
                    <Badge variant="warning" className="shrink-0">
                      Mặc định
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {v.isComposite
                    ? v.components && v.components.length > 0
                      ? "Bộ lắp ráp — tồn tự tính theo linh kiện"
                      : "Bộ lắp ráp (chưa khai linh kiện)"
                    : v.unit ?? ""}
                </div>
              </div>
              <div className="shrink-0 text-right text-sm">
                <div className={`text-xs font-medium ${v.stock === 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {v.isComposite ? `Tồn bộ: ${v.stock}` : `Tồn: ${v.stock}`}
                </div>
                {v.isComposite ? (
                  <div className="text-[10px] text-muted-foreground">số bộ còn ráp được</div>
                ) : null}
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Số lượng</span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => setQty(String(Math.max(1, numQty - 1)))}
              aria-label="Giảm số lượng"
            >
              −
            </Button>
            <Input
              type="number"
              min="1"
              className="h-8 w-18 text-center font-medium tabular-nums"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onBlur={() => {
                if (!qty || parseInt(qty, 10) < 1) setQty("1");
              }}
            />
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => setQty(String(numQty + 1))}
              aria-label="Tăng số lượng"
            >
              +
            </Button>
          </div>
        </div>

        {selected && selected.stock === 0 && (
          <div className="rounded-md bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
            ⚠️ <strong>Vật tư hiện đang hết hàng:</strong> Bạn vẫn có thể tạo yêu cầu với số lượng mong muốn. Quản kho sẽ nhận được thông tin để lên kế hoạch đặt hàng và cấp phát khi hàng về.
          </div>
        )}
        {selected && selected.stock > 0 && numQty > selected.stock && (
          <div className="rounded-md bg-blue-500/10 p-2.5 text-xs text-blue-600 dark:text-blue-400">
            ℹ️ <strong>Tồn kho hiện có {selected.stock} {selected.unit ?? "cái"}:</strong> Bạn đang yêu cầu {numQty}. Quản kho sẽ cấp trước số lượng có sẵn hoặc nhập thêm {numQty - selected.stock} để cấp đủ.
          </div>
        )}

        <DialogFooter>
          <Button onClick={addToCart} disabled={!selected || numQty < 1}>
            {selected?.stock === 0 ? "Thêm vào giỏ (chờ nhập hàng)" : "Thêm vào giỏ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
