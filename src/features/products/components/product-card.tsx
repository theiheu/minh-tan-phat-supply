"use client";

import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { categoryIcon } from "@/lib/labels";
import type { Product } from "@/lib/types";
import type { VariantWithStock } from "../types";
import { ProductDetailDialog } from "./product-detail-dialog";

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
  const image = product.images?.[0];

  const badge =
    totalQty === 0
      ? { label: "Hết hàng", cls: "bg-red-100 text-red-700" }
      : low
        ? { label: "Sắp hết", cls: "bg-amber-100 text-amber-700" }
        : { label: "Còn hàng", cls: "bg-emerald-100 text-emerald-700" };

  return (
    <>
      <Card
        className="cursor-pointer overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg"
        onClick={() => setOpen(true)}
      >
        <div className="relative aspect-square w-full bg-muted">
          {image ? (
            <Image
              src={image}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Icon className="size-14" />
            </div>
          )}
          <Badge variant="outline" className={`absolute top-2 left-2 ${badge.cls}`}>
            {badge.label}
          </Badge>
        </div>
        <CardContent className="space-y-1 p-3">
          <div className="line-clamp-2 min-h-10 text-sm font-medium leading-snug">{product.name}</div>
          <div className="text-sm tabular-nums text-muted-foreground">
            Tồn: <span className="font-semibold text-foreground">{totalQty}</span>
          </div>
        </CardContent>
      </Card>
      <ProductDetailDialog open={open} onOpenChange={setOpen} product={product} variants={variants} />
    </>
  );
}
