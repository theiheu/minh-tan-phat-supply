"use client";

import { useState } from "react";
import { History, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/components/category-icon";
import { useCartStore } from "@/stores/cart-store";
import { variantLabel } from "@/lib/labels";
import type { Product } from "@/lib/types";
import type { VariantWithStock } from "../types";
import { ProductHistoryDialog } from "./product-history-dialog";
import { ProductImageGallery } from "./product-image-gallery";
import { ProductDetailDialog } from "./product-detail-dialog";

export function ProductCard({
  product,
  skus: variants,
  categoryIconKey,
  canManage = false,
  categories = [],
  searchQuery,
}: {
  product: Product;
  skus: VariantWithStock[];
  categoryIconKey?: string | null;
  canManage?: boolean;
  categories?: { id: string; name: string }[];
  searchQuery?: string;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Vật tư bộ (có dòng composite): tồn hiển thị = số bộ còn ráp được theo linh kiện,
  // không cộng gộp linh kiện để tránh đếm trùng.
  const kitVariant = variants.find((v) => v.componentType === "assembly" || (v.isComposite && !v.componentType));
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

  const isSingleVariant = variants.length === 1 && !variants[0].isComposite;
  const addItem = useCartStore((s) => s.addItem);

  const badge =
    totalQty === 0
      ? { label: "Hết hàng", variant: "danger" as const }
      : low
        ? { label: "Sắp hết", variant: "warning" as const }
        : { label: "Còn hàng", variant: "success" as const };

  return (
    <>
      <Card
        className="group relative cursor-pointer gap-0 sm:gap-0 overflow-hidden p-0 sm:p-0 py-0 sm:py-0 transition-all hover:-translate-y-1 hover:shadow-lg"
        onClick={() => setDetailOpen(true)}
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

          <div className="absolute top-2 right-2 flex items-center gap-1">
            {/* Nút sửa vật tư (chỉ hiện cho quản lý) */}
            {canManage && (
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                aria-label="Chỉnh sửa vật tư"
                title="Chỉnh sửa vật tư"
                className="size-7 bg-background/85 shadow-sm backdrop-blur-sm hover:bg-background text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `/admin/products/${product.id}`;
                }}
              >
                <Pencil className="size-3.5" aria-hidden />
              </Button>
            )}

            {/* Nút lịch sử cấp/xuất */}
            <Button
              type="button"
              variant="secondary"
              size="icon-xs"
              aria-label="Xem lịch sử cấp phát và xuất kho"
              title="Lịch sử cấp phát và xuất kho"
              className="size-7 bg-background/85 shadow-sm backdrop-blur-sm hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                setHistoryOpen(true);
              }}
            >
              <History aria-hidden />
            </Button>
          </div>
        </div>
        <CardContent className="space-y-1 p-2.5 sm:p-3">
          <div className="line-clamp-2 min-h-10 text-sm font-medium leading-snug">{product.name}</div>
          <div className="flex items-center justify-between gap-1 pt-0.5">
            <div className="flex items-baseline gap-1 text-sm text-muted-foreground">
              <span>Tồn:</span>
              <span className="font-semibold tabular-nums text-foreground">{totalQty}</span>
              {unit ? <span className="text-xs">{unit}</span> : null}
            </div>
            {isSingleVariant && (
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                className="size-6 rounded-full text-primary hover:bg-primary hover:text-primary-foreground shrink-0 shadow-2xs transition-transform active:scale-90"
                title="Thêm nhanh 1 đơn vị vào giỏ"
                aria-label={`Thêm nhanh ${product.name} vào giỏ`}
                onClick={(e) => {
                  e.stopPropagation();
                  const single = variants[0];
                  addItem({
                    skuId: single.id,
                    enteredQuantity: 1,
                    name: product.name,
                    label: variantLabel(single.attributes, single.unit),
                    unit: single.unit ?? null,
                    image: single.images?.[0] ?? null,
                    stock: single.stock,
                  });
                  if (single.stock === 0) {
                    toast.success(`Đã thêm ${product.name} vào giỏ (hết hàng — chờ đặt)`);
                  } else {
                    toast.success(`Đã thêm 1 ${single.unit || "phần"} ${product.name} vào giỏ`);
                  }
                }}
              >
                <Plus className="size-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ProductDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        product={product}
        variants={variants}
        categoryName={categories.find((c) => c.id === product.category_id)?.name}
        searchQuery={searchQuery}
        canManage={canManage}
      />

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