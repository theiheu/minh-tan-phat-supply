"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { categoryIcon } from "@/lib/labels";
import type { Product } from "@/lib/types";
import type { VariantWithStock } from "../types";
import { ProductDetailDialog } from "./product-detail-dialog";
import { ProductImageGallery } from "./product-image-gallery";

export function ProductCard({
  product,
  variants,
  categoryIconKey,
}: {
  product: Product;
  variants: VariantWithStock[];
  categoryIconKey?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const Icon = categoryIcon(categoryIconKey);

  const totalQty = variants.reduce((n, v) => n + v.stock, 0);
  const low = variants.some((v) => v.stock <= v.min_stock);

  // Toàn bộ ảnh hiển thị trong gallery: biến thể mặc định → ảnh vật tư → biến thể khác.
  const defaultVariant = variants.find((v) => v.is_default);
  const imageList = [
    ...(defaultVariant?.images ?? []),
    ...(product.images ?? []),
    ...variants.flatMap((v) => v.images ?? []),
  ].filter((u): u is string => Boolean(u));
  const uniqueImages = [...new Set(imageList)];

  // Đơn vị tính đại diện: ưu tiên biến thể mặc định, rồi biến thể đầu tiên có đơn vị.
  const unit = defaultVariant?.unit ?? variants.find((v) => v.unit)?.unit ?? null;

  const badge =
    totalQty === 0
      ? { label: "Hết hàng", cls: "bg-red-100 text-red-700" }
      : low
        ? { label: "Sắp hết", cls: "bg-amber-100 text-amber-700" }
        : { label: "Còn hàng", cls: "bg-emerald-100 text-emerald-700" };

  return (
    <>
      <Card
        className="cursor-pointer gap-0 overflow-hidden p-0 transition-all hover:-translate-y-1 hover:shadow-lg"
        onClick={() => setOpen(true)}
      >
        <div className="relative">
          {uniqueImages.length === 0 ? (
            <div className="flex aspect-square w-full items-center justify-center bg-muted text-muted-foreground">
              <Icon className="size-14" />
            </div>
          ) : (
            <ProductImageGallery images={uniqueImages} alt={product.name} />
          )}
          <Badge variant="outline" className={`absolute top-2 left-2 ${badge.cls}`}>
            {badge.label}
          </Badge>
        </div>
        <CardContent className="space-y-1 p-3">
          <div className="line-clamp-2 min-h-10 text-sm font-medium leading-snug">{product.name}</div>
          <div className="flex items-baseline gap-1 text-sm text-muted-foreground">
            <span>Tồn:</span>
            <span className="font-semibold tabular-nums text-foreground">{totalQty}</span>
            {unit ? <span className="text-xs">{unit}</span> : null}
          </div>
        </CardContent>
      </Card>
      <ProductDetailDialog open={open} onOpenChange={setOpen} product={product} variants={variants} />
    </>
  );
}
