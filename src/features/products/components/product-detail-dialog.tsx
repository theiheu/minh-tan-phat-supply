"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ImageIcon,
  ListChecks,
  Minus,
  Package,
  Pencil,
  Plus,
  ShoppingCart,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/stores/cart-store";
import { useUIStore } from "@/stores/ui-store";
import type { Product } from "@/lib/types";
import type { VariantWithStock } from "../types";
import { ProductImageGallery } from "./product-image-gallery";
import { cn } from "@/lib/utils";
import { TransactionUomSelect } from "@/features/catalog/components/transaction-uom-select";
import { useProductDetail } from "../hooks/use-product-detail";
import { variantLabel } from "@/lib/labels";
import { ProductSingleMode } from "./product-single-mode";
import { ProductBatchMode } from "./product-batch-mode";

export function ProductDetailDialog({
  open,
  onOpenChange,
  product,
  variants: variants,
  categoryName,
  searchQuery: _searchQuery,
  canManage = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  variants: VariantWithStock[];
  categoryName?: string | null;
  searchQuery?: string;
  canManage?: boolean;
}) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const setCartOpen = useUIStore((s) => s.setCartOpen);

  const p = useProductDetail({ product, variants });
  const {
    mode, setMode,
    selectedVariant,
    selectedUom, setSelectedUom,
    quantity, setQuantity,
    batchCount, batchTotalQty, batchEntries,
    displayedImages,
    optionAxes,
  } = p;
  
  const hasMultiAxis = optionAxes.length >= 2;
  const isOutOfStockRoot = (selectedVariant?.stock ?? 0) <= 0;
  const isLowStockRoot = !isOutOfStockRoot && (selectedVariant?.stock ?? 0) <= (selectedVariant?.min_stock ?? 0);

  const selectedVariantLabel = useMemo(() => {
    if (!selectedVariant) return "";
    if (optionAxes && optionAxes.length > 0) {
      const vals = optionAxes
        .map((axis) => p.selectedAxisValues[axis] || (selectedVariant.attributes as Record<string, string>)?.[axis])
        .filter(Boolean);
      if (vals.length > 0) return vals.join(" · ");
    }
    if (selectedVariant.attributes && typeof selectedVariant.attributes === "object" && !Array.isArray(selectedVariant.attributes)) {
      const values = Object.values(selectedVariant.attributes as Record<string, unknown>).filter(
        (v) => typeof v === "string" && v.length > 0
      );
      if (values.length > 0) return values.join(" · ");
    }
    return selectedVariant.parsedHierarchy?.fullLabel || variantLabel(selectedVariant.attributes, selectedVariant.unit);
  }, [selectedVariant, optionAxes, p.selectedAxisValues]);

  const handleAddToCart = () => {
    if (!selectedVariant) return;

    addItem({
      skuId: selectedVariant.id,
      transactionUnitId: selectedUom?.id,
      transactionUnitName: selectedUom?.displayName,
      factorToBase: selectedUom?.factorToBase ?? 1,
      enteredQuantity: quantity,
      name: product.name,
      label: variantLabel(selectedVariant.attributes, selectedVariant.unit),
      unit: selectedUom?.displayName || selectedVariant.unit || null,
      baseUnitSymbol: selectedVariant.unit || null,
      image: selectedVariant.images?.[0] ?? null,
      stock: selectedVariant.stock,
    });

    const displayUnit = selectedUom?.displayName || selectedVariant.unit || "phần";
    toast.success(
      isOutOfStockRoot
        ? "Đã thêm " + quantity + " " + displayUnit + " " + product.name + " vào giỏ (hết hàng — chờ đặt)"
        : "Đã thêm " + quantity + " " + displayUnit + " " + product.name + " vào giỏ"
    );
  };

  const handleQuickRequisition = () => {
    handleAddToCart();
    onOpenChange(false);
    setCartOpen(false);
    router.push("/requisitions/new");
  };

  const handleBatchAddToCart = () => {
    if (batchCount === 0) return;

    for (const [vId, qty] of batchEntries) {
      const v = variants.find((item) => item.id === vId);
      if (!v) continue;
      addItem({
        skuId: v.id,
        enteredQuantity: qty,
        name: product.name,
        label: variantLabel(v.attributes, v.unit),
        unit: v.unit ?? null,
        baseUnitSymbol: v.unit ?? null,
        image: v.images?.[0] ?? null,
        stock: v.stock,
      });
    }

    toast.success(
      "Đã thêm " + batchCount + " quy cách (tổng " + batchTotalQty + " " + (selectedVariant?.unit || "món") + ") vào giỏ"
    );
  };

  const handleBatchQuickRequisition = () => {
    handleBatchAddToCart();
    onOpenChange(false);
    setCartOpen(false);
    router.push("/requisitions/new");
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:w-full max-w-xl sm:max-w-2xl h-[88dvh] max-h-[88dvh] sm:h-[85dvh] sm:max-h-[85dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-xl border-2 border-border shadow-2xl min-w-0 bg-background">
        {/* FIXED HEADER */}
        <div className="shrink-0 border-b border-border/60 bg-background px-4 py-3 sm:px-6 sm:py-3.5 pr-12 sm:pr-12 min-w-0">
          <DialogHeader className="p-0 border-b-0 text-left gap-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {categoryName && <Badge variant="secondary">{categoryName}</Badge>}
                {isOutOfStockRoot ? (
                  <Badge variant="danger">Hết hàng</Badge>
                ) : isLowStockRoot ? (
                  <Badge variant="warning">Sắp hết</Badge>
                ) : (
                  <Badge variant="success">Còn hàng</Badge>
                )}
              </div>
              {canManage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10 shrink-0"
                  onClick={() => {
                    onOpenChange(false);
                    window.location.href = `/admin/products/${product.id}`;
                  }}
                  title="Chỉnh sửa thông tin vật tư"
                >
                  <Pencil className="size-3.5" />
                  Sửa vật tư
                </Button>
              )}
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold leading-snug text-foreground line-clamp-2">
              {product.name}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-4">
          {/* Image Gallery - Hiển thị đúng bộ ảnh riêng của biến thể đang chọn */}
          <div className="rounded-lg overflow-hidden border bg-muted/40 aspect-video sm:aspect-2/1 flex items-center justify-center relative">
            {displayedImages.length > 0 ? (
              <ProductImageGallery
                images={displayedImages}
                alt={product.name}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground p-8">
                <Package className="size-12 opacity-40 mb-2" />
                <span className="text-xs">Chưa có hình ảnh</span>
              </div>
            )}
            {/* Tag thông tin biến thể đang hiển thị ảnh */}
            {selectedVariant && selectedVariant.images && selectedVariant.images.length > 0 && (
              <div className="absolute top-2 left-2 z-10 pointer-events-none">
                <Badge variant="secondary" className="bg-background/90 text-foreground shadow-xs backdrop-blur-xs text-[10px] font-medium border border-border/60">
                  <ImageIcon className="size-3 mr-1 text-primary" />
                </Badge>
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border">
              {product.description}
            </div>
          )}

          {/* Multi-variant Mode Switcher (Shopee Chips vs B2B Batch Order) */}
          {variants.length > 1 && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between pb-1 border-b">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Quy cách ({variants.length} biến thể)
                </span>
                <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setMode("single")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all",
                      mode === "single"
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <SlidersHorizontal className="size-3.5" />
                    Chọn 1 quy cách
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("batch")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all",
                      mode === "batch"
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <ListChecks className="size-3.5" />
                    Chọn nhiều quy cách
                    {batchCount > 0 && (
                      <span className="ml-1 rounded-full bg-primary px-1.5 py-0.2 text-[10px] text-primary-foreground font-bold">
                        {batchCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* MODE 1: SINGLE SELECTION */}
              {mode === "single" && (
                <ProductSingleMode {...p} variants={variants} hasMultiAxis={hasMultiAxis} />
              )}

              {/* MODE 2: BATCH SELECTION */}
              {mode === "batch" && (
                <ProductBatchMode {...p} />
              )}
            </div>
          )}

          {/* Selected Variant Stock & Quantity Card (for Single Mode & Single-variant products) */}
          {(mode === "single" || variants.length === 1) && selectedVariant && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-muted/40 border">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-bold text-foreground">
                    {selectedVariantLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    (Tồn: <strong className={cn(selectedVariant.stock > 0 ? "text-foreground font-bold" : "text-destructive font-bold")}>{selectedVariant.stock}</strong> {selectedVariant.unit || "đơn vị"})
                  </span>
                </div>
                {selectedVariant.sku_code && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Mã SKU:</span>
                    <span className="font-mono font-semibold text-foreground bg-background px-1.5 py-0.5 rounded border border-border/60">
                      {selectedVariant.sku_code}
                    </span>
                  </div>
                )}
              </div>

              {/* Quantity Stepper & Transaction UOM */}
              <div className="flex flex-col sm:items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-32 sm:w-40">
                    <TransactionUomSelect
                      skuId={selectedVariant.id}
                      value={selectedUom?.id}
                      className="h-8 text-xs"
                      placeholder={selectedVariant.unit ? `ĐVT: ${selectedVariant.unit}` : "Chọn ĐVT"}
                      onUomChange={(uom) => setSelectedUom(uom)}
                    />
                  </div>
                  <div className="inline-flex items-center rounded-lg border bg-background shadow-xs">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="size-8 text-foreground"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      className="h-8 w-14 border-0 text-center text-sm font-bold tabular-nums focus-visible:ring-0 shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) setQuantity(val);
                      }}
                      onBlur={() => {
                        if (!quantity || quantity < 1) setQuantity(1);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="size-8 text-foreground"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {selectedUom && selectedUom.factorToBase > 1 && (
                  <span className="text-[11px] font-semibold text-primary">
                    = {quantity * selectedUom.factorToBase} {selectedVariant.unit || "đơn vị cơ sở"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-3 sm:p-4 border-t bg-background flex flex-col sm:flex-row items-center justify-end gap-2 shrink-0">
          {mode === "batch" && variants.length > 1 ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={batchCount === 0}
                onClick={handleBatchAddToCart}
              >
                <ShoppingCart className="size-4 mr-2" />
                Thêm {batchCount > 0 ? batchCount + " quy cách" : "vào giỏ"}
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={batchCount === 0}
                onClick={handleBatchQuickRequisition}
              >
                Tạo phiếu yêu cầu ({batchTotalQty} món)
                <ArrowRight className="size-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleAddToCart}
              >
                <ShoppingCart className="size-4 mr-2" />
                Thêm vào giỏ yêu cầu
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={handleQuickRequisition}
              >
                Tạo phiếu yêu cầu ngay
                <ArrowRight className="size-4 ml-2" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}