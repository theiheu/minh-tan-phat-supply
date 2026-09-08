"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/components/category-icon";
import type { Product } from "@/lib/types";
import type { VariantWithStock } from "../types";
import { ProductDetailDialog } from "./product-detail-dialog";
import { ProductHistoryDialog } from "./product-history-dialog";
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
  const [historyOpen, setHistoryOpen] = useState(false);

  // Vật tư bộ (có dòng composite): tồn hiển thị = số bộ còn ráp được theo linh kiện,
  // không cộng gộp linh kiện để tránh đếm trùng.
  const kitVariant = variants.find((v) => v.isComposite);
  const stockVariants = kitVariant ? [kitVariant] : variants;

  const totalQty = stockVariants.reduce((n, v) => n + v.stock, 0);
  const low = stockVariants.some((v) => v.stock <= v.min_stock);

  // Toàn bộ ảnh hiển thị trong gallery: biến thể mặc định → ảnh vật tư → biến thể khác.
  const defaultVariant = variants.find((v) => v.is_default);
  const imageList = [
    ...(defaultVariant?.images ?? []),
    ...(product.images ?? []),
    ...variants.flatMap((v) => v.images ?? []),
  ].filter((u): u is string => Boolean(u));
  const uniqueImages = [...new Set(imageList)];

  // Đơn vị tính đại diện: ưu tiên dòng bộ, rồi biến thể mặc định, rồi dòng đầu có đơn vị.
  const unit = kitVariant?.unit ?? defaultVariant?.unit ?? variants.find((v) => v.unit)?.unit ?? null;

  const badge =
    totalQty === 0
      ? { label: "Hết hàng", variant: "danger" as const }
      : low
        ? { label: "Sắp hết", variant: "warning" as const }
        : { label: "Còn hàng", variant: "success" as const };

  return (
    <>
      <Card
        className="cursor-pointer gap-0 overflow-hidden p-0 transition-all hover:-translate-y-1 hover:shadow-lg"
        onClick={() => setOpen(true)}
      >
        <div className="relative">
          {uniqueImages.length === 0 ? (
            <div className="flex aspect-square w-full items-center justify-center bg-muted text-muted-foreground">
              <CategoryIcon value={categoryIconKey} className="size-14" />
            </div>
          ) : (
            <ProductImageGallery images={uniqueImages} alt={product.name} />
          )}
          <Badge variant={badge.variant} className="absolute top-2 left-2">
            {badge.label}
          </Badge>
          {/* Nút lịch sử cấp/xuất — không mở dialog chi tiết khi bấm. */}
          <Button
            type="button"
            variant="secondary"
            size="icon-xs"
            aria-label="Xem lịch sử cấp phát và xuất kho"
            title="Lịch sử cấp phát và xuất kho"
            className="absolute top-2 right-2 size-7 bg-background/85 shadow-sm backdrop-blur-sm hover:bg-background"
            onClick={(e) => {
              e.stopPropagation();
              setHistoryOpen(true);
            }}
          >
            <History aria-hidden />
          </Button>
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
      <ProductHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        productName={product.name}
        productId={product.id}
        variants={variants}
      />
    </>
  );
}
