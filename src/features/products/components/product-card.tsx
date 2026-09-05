"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatVnd } from "@/lib/format";
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
  const minPrice = variants.reduce<number | null>(
    (m, v) => (v.price != null && (m == null || v.price < m) ? v.price : m),
    null,
  );

  const badge =
    totalQty === 0
      ? { label: "Hết hàng", cls: "bg-red-100 text-red-700" }
      : low
        ? { label: "Sắp hết", cls: "bg-amber-100 text-amber-700" }
        : { label: "Còn hàng", cls: "bg-emerald-100 text-emerald-700" };

  return (
    <>
      <Card
        className="cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg"
        onClick={() => setOpen(true)}
      >
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-6" />
            </div>
            <Badge variant="outline" className={badge.cls}>
              {badge.label}
            </Badge>
          </div>
          <div>
            <div className="font-medium leading-tight">{product.name}</div>
            <div className="text-sm text-muted-foreground">
              {minPrice != null ? formatVnd(minPrice) : "—"}
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full">
            Chọn biến thể
          </Button>
        </CardContent>
      </Card>
      <ProductDetailDialog open={open} onOpenChange={setOpen} product={product} variants={variants} />
    </>
  );
}
