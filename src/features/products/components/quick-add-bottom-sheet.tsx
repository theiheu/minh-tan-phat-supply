"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, ImageOff, Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart-store";
import type { VariantWithStock } from "@/features/products/types";

interface QuickAddBottomSheetProps {
  productName: string;
  variant: VariantWithStock;
  image?: string | null;
  onAdded?: () => void;
  onContinueScan?: () => void;
  onGoToCart?: () => void;
}

export function QuickAddBottomSheet({
  productName,
  variant,
  image,
  onAdded,
  onContinueScan,
  onGoToCart,
}: QuickAddBottomSheetProps) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    setImgError(false);
  }, [image]);

  const stock = variant.stock ?? 0;

  function handleAdd() {
    if (qty <= 0) return;
    addItem({
      variantId: variant.id,
      quantity: qty,
      name: productName,
      label: variant.unit || "Mặc định",
      unit: variant.unit || null,
      image,
      stock,
    });

    setAdded(true);
    toast.success(`Đã thêm ${qty} ${variant.unit || "món"} vào giỏ hàng`);
    if (onAdded) onAdded();
  }

  return (
    <div className="space-y-4 p-4 bg-background rounded-t-2xl border-t shadow-2xl">
      <div className="flex items-start gap-3">
        {image && !imgError ? (
          <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
            <Image
              src={image}
              alt={productName}
              fill
              className="object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted text-muted-foreground text-xs font-medium">
            <ImageOff className="size-4 opacity-70" aria-hidden />
            <span className="text-[10px]">Ảnh vật tư</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm leading-tight text-foreground line-clamp-2">{productName}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {variant.unit && (
              <Badge variant="outline" className="text-[11px] font-normal">
                ĐVT: {variant.unit}
              </Badge>
            )}
            <Badge variant={stock > 0 ? "secondary" : "destructive"} className="text-[11px]">
              Tồn: {stock} {variant.unit || ""}
            </Badge>
          </div>
        </div>
      </div>

      {!added ? (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">Số lượng cần:</span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shrink-0"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="size-3.5" />
              </Button>
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="h-8 w-16 text-center font-semibold text-sm"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shrink-0"
                onClick={() => setQty((q) => q + 1)}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>

          <Button onClick={handleAdd} className="w-full bg-primary font-medium">
            <ShoppingCart className="mr-2 size-4" />
            Thêm vào giỏ hàng
          </Button>
        </div>
      ) : (
        <div className="space-y-2 pt-2 animate-in fade-in">
          <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium py-1">
            <Check className="size-4" />
            Đã thêm vào giỏ thành công!
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onContinueScan} className="text-xs">
              Tiếp tục quét
            </Button>
            <Button onClick={onGoToCart} className="text-xs">
              Xem giỏ hàng
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
