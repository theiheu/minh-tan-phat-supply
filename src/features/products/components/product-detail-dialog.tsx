"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ImageIcon,
  ListChecks,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { variantLabel } from "@/lib/labels";
import { appAssetUrl } from "@/lib/images";
import { useCartStore } from "@/stores/cart-store";
import { useUIStore } from "@/stores/ui-store";
import type { Product } from "@/lib/types";
import type { VariantWithStock } from "../types";
import { ProductImageGallery } from "./product-image-gallery";
import { cn } from "@/lib/utils";
import { matchesSearchTokens, computeSearchScore } from "@/lib/search";
import { TransactionUomSelect } from "@/features/catalog/components/transaction-uom-select";
import type { TransactionUom } from "@/features/catalog/domain/types";

function parseVariantHierarchy(
  v: VariantWithStock,
  definedOptions: string[]
): { levels: Record<string, string>; fullLabel: string; brandOrGroup: string; specLabel: string } {
  // 1. Nếu vật tư đã khai báo options rõ ràng
  if (definedOptions.length > 0 && v.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes)) {
    const attrs = v.attributes as Record<string, string>;
    const res: Record<string, string> = {};
    for (const opt of definedOptions) {
      if (attrs[opt] && typeof attrs[opt] === "string" && attrs[opt].trim()) {
        res[opt] = attrs[opt].trim();
      }
    }
    if (Object.keys(res).length >= 1) {
      const keys = definedOptions.filter((k) => res[k]);
      const brandOrGroup = res[keys[0]] || "";
      const restKeys = keys.slice(1);
      const specLabel = restKeys.length > 0 ? restKeys.map((k) => res[k]).join(" · ") : res[keys[0]];
      const fullLabel = keys.map((k) => res[k]).join(" · ");
      return { levels: res, fullLabel, brandOrGroup, specLabel };
    }
  }

  // 2. Nếu attributes có nhiều khóa (VD: { "Hãng": "SKF", "Mã": "6203", "Nắp": "2RS" })
  if (v.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes)) {
    const attrs = v.attributes as Record<string, string>;
    const keys = Object.keys(attrs).filter((k) => attrs[k] && typeof attrs[k] === "string" && attrs[k].trim());
    if (keys.length >= 2) {
      const res: Record<string, string> = {};
      for (const k of keys) {
        res[k] = attrs[k].trim();
      }
      const brandOrGroup = res[keys[0]] || "";
      const specLabel = keys.slice(1).map((k) => res[k]).join(" · ");
      const fullLabel = keys.map((k) => res[k]).join(" · ");
      return { levels: res, fullLabel, brandOrGroup, specLabel };
    }
  }

  // 3. Nếu là chuỗi phẳng (VD: "SKF 6203 2RS", "Koyo - 6203 ZZ", "Phi 21 - Dày 1.2mm")
  const rawLabel =
    (v.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes) && Object.values(v.attributes)[0]) ||
    v.sku_code ||
    v.unit ||
    "";
  const str = String(rawLabel).trim();

  // Tách theo dấu phân cách chuẩn
  let parts = str.split(/\s*·\s*|\s*-\s*|\s*\/\s*/).filter(Boolean);
  if (parts.length === 1) {
    parts = str.split(/\s+/).filter(Boolean);
  }

  if (parts.length >= 2) {
    const res: Record<string, string> = {};
    const brandOrGroup = parts[0];
    const specLabel = parts.slice(1).join(" · ");
    res["Hãng / Phân nhóm"] = brandOrGroup;
    res["Mã / Kích thước"] = parts[1];
    if (parts.length >= 3) {
      res["Loại / Chi tiết"] = parts.slice(2).join(" ");
    }
    return { levels: res, fullLabel: parts.join(" · "), brandOrGroup, specLabel };
  }

  const defaultVal = str || v.unit || "Mặc định";
  return {
    levels: { "Quy cách": defaultVal },
    fullLabel: defaultVal,
    brandOrGroup: "",
    specLabel: defaultVal,
  };
}

export function ProductDetailDialog({
  open,
  onOpenChange,
  product,
  variants,
  categoryName,
  searchQuery,
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

  // Tab mode: 'single' (E-commerce / Chips) vs 'batch' (B2B Multi-selection)
  const [mode, setMode] = useState<"single" | "batch">("single");

  // Single mode state
  const defaultVariant = variants.find((v) => v.is_default) ?? variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState<string>(defaultVariant?.id ?? "");
  const [selectedUom, setSelectedUom] = useState<TransactionUom | undefined>();
  const [quantity, setQuantity] = useState<number>(1);
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Batch mode state: map of variantId -> quantity
  const [batchQuantities, setBatchQuantities] = useState<Record<string, number>>({});
  const [batchSearch, setBatchSearch] = useState<string>("");
  const [batchBrandFilter, setBatchBrandFilter] = useState<string>("all");

  // Chuẩn hóa định nghĩa options của vật tư
  const definedOptions = useMemo(() => {
    if (product.options && Array.isArray(product.options) && product.options.length > 0) {
      return product.options.map((o) => o.trim()).filter(Boolean);
    }
    return [];
  }, [product.options]);

  // Phân tích cấu trúc phân cấp cho toàn bộ biến thể
  const parsedVariants = useMemo(() => {
    return variants.map((v) => {
      const hierarchy = parseVariantHierarchy(v, definedOptions);
      return {
        ...v,
        parsedHierarchy: hierarchy,
      };
    });
  }, [variants, definedOptions]);

  // Trích xuất danh sách các trục thuộc tính (Axes) theo thứ tự
  const optionAxes = useMemo(() => {
    if (definedOptions.length > 0) return definedOptions;
    const keysSet = new Set<string>();
    for (const pv of parsedVariants) {
      for (const k of Object.keys(pv.parsedHierarchy.levels)) {
        if (k.trim()) keysSet.add(k.trim());
      }
    }
    return Array.from(keysSet);
  }, [definedOptions, parsedVariants]);

  // Nhóm các hãng / phân nhóm chính (Level 1)
  const brandGroups = useMemo(() => {
    const map = new Map<string, typeof parsedVariants>();
    for (const pv of parsedVariants) {
      const brand = pv.parsedHierarchy.brandOrGroup || "Quy cách chung";
      const list = map.get(brand) || [];
      list.push(pv);
      map.set(brand, list);
    }
    return map;
  }, [parsedVariants]);

  const uniqueBrands = useMemo(() => {
    return Array.from(brandGroups.keys());
  }, [brandGroups]);

  // Trạng thái các giá trị đang chọn ở từng trục (Cascading Selection State)
  const [selectedAxisValues, setSelectedAxisValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    const defaultParsed = parsedVariants.find((v) => v.id === selectedVariantId) ?? parsedVariants[0];
    if (defaultParsed) {
      for (const axis of optionAxes) {
        const val = defaultParsed.parsedHierarchy.levels[axis];
        if (val) initial[axis] = val;
      }
    }
    return initial;
  });

  const selectedVariant = useMemo(() => {
    return variants.find((v) => v.id === selectedVariantId) ?? defaultVariant;
  }, [variants, selectedVariantId, defaultVariant]);

  // Lọc phụ thuộc đa cấp (Cascading Values for each axis) - chỉ trả về các giá trị khả dụng kèm ảnh thumbnail đại diện nếu có
  const getAvailableValuesForAxis = (
    axisIndex: number
  ): Array<{ value: string; isAvailable: boolean; stock: number; thumbnailSrc?: string }> => {
    const targetAxis = optionAxes[axisIndex];
    if (!targetAxis) return [];

    const prefixFilters = optionAxes.slice(0, axisIndex);
    const candidateVariants = parsedVariants.filter((pv) => {
      return prefixFilters.every((prevAxis) => {
        const selectedVal = selectedAxisValues[prevAxis];
        return !selectedVal || pv.parsedHierarchy.levels[prevAxis] === selectedVal;
      });
    });

    const valMap = new Map<string, { stock: number; thumbnailSrc?: string }>();
    for (const pv of candidateVariants) {
      const val = pv.parsedHierarchy.levels[targetAxis];
      if (val) {
        const current = valMap.get(val) || { stock: 0 };
        const thumbnailSrc = current.thumbnailSrc || (pv.images?.[0] ? pv.images[0] : undefined);
        valMap.set(val, {
          stock: current.stock + pv.stock,
          thumbnailSrc,
        });
      }
    }

    return Array.from(valMap.entries()).map(([val, data]) => ({
      value: val,
      isAvailable: true,
      stock: data.stock,
      thumbnailSrc: data.thumbnailSrc,
    }));
  };

  const handleSelectAxisValue = (axisIndex: number, axisName: string, val: string) => {
    const nextSelections = { ...selectedAxisValues, [axisName]: val };

    const targetAxisKeys = optionAxes.slice(0, axisIndex + 1);
    let matchedVariant = parsedVariants.find((pv) => {
      return optionAxes.every((a) => {
        const targetVal = nextSelections[a];
        return !targetVal || pv.parsedHierarchy.levels[a] === targetVal;
      });
    });

    if (!matchedVariant) {
      matchedVariant = parsedVariants.find((pv) => {
        return targetAxisKeys.every((a) => pv.parsedHierarchy.levels[a] === nextSelections[a]);
      });
    }

    if (matchedVariant) {
      setSelectedVariantId(matchedVariant.id);
      const updatedAxes: Record<string, string> = {};
      for (const a of optionAxes) {
        const vVal = matchedVariant.parsedHierarchy.levels[a];
        if (vVal) updatedAxes[a] = vVal;
      }
      setSelectedAxisValues(updatedAxes);
    } else {
      setSelectedAxisValues(nextSelections);
    }
  };

  const handleSelectVariantDirect = (v: typeof parsedVariants[0]) => {
    setSelectedVariantId(v.id);
    const next: Record<string, string> = {};
    for (const axis of optionAxes) {
      const val = v.parsedHierarchy.levels[axis];
      if (val) next[axis] = val;
    }
    setSelectedAxisValues(next);
  };

  // Khi chọn vào 1 biến thể:
  // - Nếu biến thể có ảnh riêng (có thể có nhiều ảnh): CHỈ hiển thị đúng bộ ảnh của biến thể đó.
  // - Nếu biến thể chưa có ảnh riêng: fallback về ảnh chung của sản phẩm (nếu có).
  // - Tuyệt đối không gộp chung ảnh của các biến thể khác!
  const displayedImages = useMemo(() => {
    if (selectedVariant?.images && selectedVariant.images.length > 0) {
      return selectedVariant.images.filter((img): img is string => Boolean(img?.trim()));
    }
    if (product.images && product.images.length > 0) {
      return product.images.filter((img): img is string => Boolean(img?.trim()));
    }
    return [];
  }, [selectedVariant?.images, product.images]);

  const isOutOfStock = (selectedVariant?.stock ?? 0) <= 0;
  const isLowStock = !isOutOfStock && (selectedVariant?.stock ?? 0) <= (selectedVariant?.min_stock ?? 0);

  const filteredFlatVariants = useMemo(() => {
    if (!searchFilter.trim()) return parsedVariants;
    return parsedVariants.filter((v) => {
      const text = `${v.parsedHierarchy.fullLabel} ${v.sku_code || ""} ${v.unit || ""}`;
      return matchesSearchTokens(text, searchFilter);
    });
  }, [parsedVariants, searchFilter]);

  const filteredBatchVariants = useMemo(() => {
    let list = parsedVariants;
    if (batchBrandFilter !== "all") {
      list = list.filter((v) => (v.parsedHierarchy.brandOrGroup || "Quy cách chung") === batchBrandFilter);
    }
    if (batchSearch.trim()) {
      list = list.filter((v) => {
        const text = `${v.parsedHierarchy.fullLabel} ${v.sku_code || ""} ${v.unit || ""}`;
        return matchesSearchTokens(text, batchSearch);
      });
    }
    return list;
  }, [parsedVariants, batchBrandFilter, batchSearch]);

  const batchGroupedMap = useMemo(() => {
    const map = new Map<string, typeof parsedVariants>();
    for (const v of filteredBatchVariants) {
      const groupName = v.parsedHierarchy.brandOrGroup || "Quy cách khác";
      const list = map.get(groupName) || [];
      list.push(v);
      map.set(groupName, list);
    }
    return map;
  }, [filteredBatchVariants]);

  const batchEntries = useMemo(() => {
    return Object.entries(batchQuantities).filter(([, q]) => q > 0);
  }, [batchQuantities]);

  const batchCount = batchEntries.length;
  const batchTotalQty = batchEntries.reduce((sum, [, q]) => sum + q, 0);

  const setBatchQty = (variantId: string, q: number) => {
    setBatchQuantities((prev) => {
      const next = { ...prev };
      if (q <= 0) {
        delete next[variantId];
      } else {
        next[variantId] = q;
      }
      return next;
    });
  };

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
      image: selectedVariant.images?.[0] ?? product.images?.[0] ?? null,
      stock: selectedVariant.stock,
    });

    const displayUnit = selectedUom?.displayName || selectedVariant.unit || "phần";
    toast.success(
      isOutOfStock
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
        image: v.images?.[0] ?? product.images?.[0] ?? null,
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

  const hasMultiAxis = optionAxes.length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:w-full max-w-xl sm:max-w-2xl h-[88dvh] max-h-[88dvh] sm:h-[85dvh] sm:max-h-[85dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-xl border-2 border-border shadow-2xl min-w-0 bg-background">
        {/* FIXED HEADER */}
        <div className="shrink-0 border-b border-border/60 bg-background px-4 py-3 sm:px-6 sm:py-3.5 pr-12 sm:pr-12 min-w-0">
          <DialogHeader className="p-0 border-b-0 text-left gap-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {categoryName && <Badge variant="secondary">{categoryName}</Badge>}
                {isOutOfStock ? (
                  <Badge variant="danger">Hết hàng</Badge>
                ) : isLowStock ? (
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
                alt={`${product.name}${selectedVariant ? ` - ${variantLabel(selectedVariant.attributes, selectedVariant.unit)}` : ""}`}
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
                  {variantLabel(selectedVariant.attributes, selectedVariant.unit)} ({selectedVariant.images.length} ảnh)
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

              {/* MODE 1: SINGLE SELECTION (CASCADING MULTI-AXIS SHOPEE CHIPS) */}
              {mode === "single" && (
                <div className="space-y-4">
                  {hasMultiAxis ? (
                    <div className="space-y-4 rounded-lg border bg-muted/20 p-2.5 sm:p-3.5">
                      {optionAxes.map((axis, axisIndex) => {
                        const items = getAvailableValuesForAxis(axisIndex);
                        if (items.length === 0) return null;
                        const currentVal = selectedAxisValues[axis];

                        return (
                          <div key={axis} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-primary inline-block" />
                                {axis}:
                              </Label>
                              {currentVal && (
                                <Badge variant="outline" className="text-[11px] font-semibold bg-background">
                                  {currentVal}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {items.map(({ value: val, stock, thumbnailSrc }) => {
                                const isSelected = currentVal === val;
                                const isSoldOut = stock <= 0;

                                return (
                                  <button
                                    type="button"
                                    key={val}
                                    onClick={() => handleSelectAxisValue(axisIndex, axis, val)}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all cursor-pointer select-none",
                                      isSelected
                                        ? "border-primary bg-primary/15 text-primary ring-1 ring-primary font-bold shadow-xs"
                                        : isSoldOut
                                          ? "border-dashed border-border/80 bg-background/60 text-muted-foreground hover:bg-muted/40"
                                          : "border-border bg-background hover:bg-muted/60 text-foreground"
                                    )}
                                  >
                                    {thumbnailSrc && (
                                      <span className="relative size-5 rounded overflow-hidden shrink-0 border border-border/50 bg-muted" aria-hidden="true">
                                        <Image
                                          src={appAssetUrl(thumbnailSrc) || thumbnailSrc}
                                          alt=""
                                          aria-hidden="true"
                                          fill
                                          className="object-cover"
                                          sizes="20px"
                                        />
                                      </span>
                                    )}
                                    <span>{val}</span>
                                    {isSoldOut && (
                                      <span className="text-[10px] text-destructive font-semibold">(Hết)</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Flat List / 1-Axis with Search Filter (if > 5 variants) */
                    <div className="space-y-2.5">
                      {variants.length > 5 && (
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Gõ tìm nhanh quy cách, mã SKU..."
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            className="h-8 pl-8 pr-8 text-xs"
                          />
                          {searchFilter && (
                            <button
                              type="button"
                              onClick={() => setSearchFilter("")}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
                        {filteredFlatVariants.length === 0 ? (
                          <div className="w-full py-4 text-center text-xs text-muted-foreground">
                            Không tìm thấy quy cách khớp với &quot;{searchFilter}&quot;
                          </div>
                        ) : (
                          filteredFlatVariants.map((v) => {
                            const label = v.parsedHierarchy.fullLabel;
                            const isSelected = v.id === selectedVariantId;
                            const isSoldOut = v.stock <= 0;
                            const thumb = v.images?.[0];
                            const imgCount = v.images?.length ?? 0;

                            return (
                              <button
                                type="button"
                                key={v.id}
                                onClick={() => handleSelectVariantDirect(v)}
                                className={cn(
                                  "inline-flex items-center gap-2 p-1.5 pr-2.5 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none",
                                  isSelected
                                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary font-semibold shadow-xs"
                                    : isSoldOut
                                      ? "border-dashed border-border/80 bg-muted/40 text-muted-foreground opacity-60 hover:opacity-100"
                                      : "border-border bg-background hover:bg-muted/60 text-foreground"
                                )}
                              >
                                {thumb ? (
                                  <span className="relative size-7 rounded-md overflow-hidden shrink-0 border border-border/50 bg-muted" aria-hidden="true">
                                    <Image
                                      src={appAssetUrl(thumb) || thumb}
                                      alt=""
                                      aria-hidden="true"
                                      fill
                                      className="object-cover"
                                      sizes="28px"
                                    />
                                    {imgCount > 1 && (
                                      <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[8px] px-0.5 leading-tight rounded-tl font-bold">
                                        {imgCount}
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="size-7 rounded-md border border-dashed bg-muted/40 flex items-center justify-center shrink-0 text-muted-foreground/50">
                                    <Package className="size-3.5" />
                                  </span>
                                )}
                                <div className="flex flex-col text-left">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold">{label}</span>
                                    {v.sku_code && (
                                      <span className="font-mono text-[10px] opacity-70">({v.sku_code})</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <span
                                      className={cn(
                                        "px-1 py-0.2 rounded font-semibold",
                                        isSoldOut ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground/80"
                                      )}
                                    >
                                      {isSoldOut ? "Hết" : v.stock + " " + (v.unit || "")}
                                    </span>
                                    {imgCount > 1 && (
                                      <span className="text-primary font-medium flex items-center gap-0.5">
                                        <ImageIcon className="size-2.5" /> {imgCount} ảnh
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODE 2: BATCH MATRIX / MULTI-SELECTION (GROUPED BY BRAND/CATEGORY) */}
              {mode === "batch" && (
                <div className="space-y-3">
                  {/* Brand Filter Pills (if multiple brands detected) */}
                  {uniqueBrands.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      <button
                        type="button"
                        onClick={() => setBatchBrandFilter("all")}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-all",
                          batchBrandFilter === "all"
                            ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                            : "bg-background text-muted-foreground hover:text-foreground border-border"
                        )}
                      >
                        Tất cả ({parsedVariants.length})
                      </button>
                      {uniqueBrands.map((b) => {
                        const count = brandGroups.get(b)?.length || 0;
                        const isSelected = batchBrandFilter === b;
                        return (
                          <button
                            type="button"
                            key={b}
                            onClick={() => setBatchBrandFilter(b)}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-all flex items-center gap-1",
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                                : "bg-background text-muted-foreground hover:text-foreground border-border"
                            )}
                          >
                            <Tag className="size-3 opacity-70" />
                            <span>{b}</span>
                            <span className="opacity-75 text-[10px]">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Lọc nhanh quy cách theo mã, kích thước, SKU..."
                      value={batchSearch}
                      onChange={(e) => setBatchSearch(e.target.value)}
                      className="h-8 pl-8 pr-8 text-xs"
                    />
                    {batchSearch && (
                      <button
                        type="button"
                        onClick={() => setBatchSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Grouped Table by Brand / Category */}
                  <div className="rounded-lg border overflow-hidden max-h-72 overflow-y-auto divide-y bg-background">
                    {filteredBatchVariants.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        Không tìm thấy quy cách khớp với &quot;{batchSearch}&quot;
                      </div>
                    ) : (
                      Array.from(batchGroupedMap.entries()).map(([groupName, groupVariants]) => (
                        <div key={groupName} className="divide-y">
                          {/* Group Header */}
                          {uniqueBrands.length > 1 && (
                            <div className="bg-muted/50 px-3 py-1.5 text-xs font-bold text-foreground flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Tag className="size-3 text-primary" />
                                {groupName}
                              </span>
                              <span className="text-[11px] text-muted-foreground font-normal">
                                {groupVariants.length} quy cách
                              </span>
                            </div>
                          )}

                          {/* Rows */}
                          {groupVariants.map((v) => {
                            const specTitle = v.parsedHierarchy.specLabel || v.parsedHierarchy.fullLabel;
                            const currentQty = batchQuantities[v.id] || 0;
                            const isSoldOut = v.stock <= 0;
                            const thumb = v.images?.[0];
                            const imgCount = v.images?.length ?? 0;

                            return (
                              <div
                                key={v.id}
                                className={cn(
                                  "flex items-center justify-between p-2.5 gap-2 transition-colors",
                                  currentQty > 0 ? "bg-primary/5" : "hover:bg-muted/40"
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  {thumb ? (
                                    <div
                                      className="relative size-9 sm:size-10 rounded-md overflow-hidden shrink-0 border border-border/60 bg-muted cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedVariantId(v.id);
                                        setMode("single");
                                      }}
                                      title="Bấm để xem ảnh chi tiết của quy cách này"
                                    >
                                      <Image
                                        src={appAssetUrl(thumb) || thumb}
                                        alt={specTitle}
                                        fill
                                        className="object-cover"
                                        sizes="40px"
                                      />
                                      {imgCount > 1 && (
                                        <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 rounded-tl font-bold leading-tight">
                                          {imgCount}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="size-9 sm:size-10 rounded-md shrink-0 border border-dashed bg-muted/40 flex items-center justify-center text-muted-foreground/40">
                                      <Package className="size-4" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-semibold text-foreground truncate">
                                      {specTitle}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                                      {v.sku_code && (
                                        <span className="font-mono bg-muted px-1 rounded text-[10px] border border-border/40 font-semibold">
                                          {v.sku_code}
                                        </span>
                                      )}
                                      <span
                                        className={cn(
                                          "font-medium",
                                          isSoldOut ? "text-destructive font-semibold" : "text-foreground/80"
                                        )}
                                      >
                                        Tồn: {v.stock} {v.unit || ""}
                                      </span>
                                      {imgCount > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedVariantId(v.id);
                                            setMode("single");
                                          }}
                                          className="text-primary hover:underline inline-flex items-center gap-0.5 text-[10px] font-medium ml-1"
                                        >
                                          <ImageIcon className="size-2.5" />
                                          {imgCount} ảnh
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Batch Stepper */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon-xs"
                                    className="size-7 text-foreground"
                                    onClick={() => setBatchQty(v.id, Math.max(0, currentQty - 1))}
                                    disabled={currentQty <= 0}
                                  >
                                    <Minus className="size-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    className="h-7 w-14 border text-center text-xs font-bold tabular-nums focus-visible:ring-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    value={currentQty || ""}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      setBatchQty(v.id, isNaN(val) || val < 0 ? 0 : val);
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon-xs"
                                    className="size-7 text-foreground"
                                    onClick={() => setBatchQty(v.id, currentQty + 1)}
                                  >
                                    <Plus className="size-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>

                  {batchCount > 0 && (
                    <div className="flex items-center justify-between text-xs px-3 py-2 bg-primary/10 rounded-lg border border-primary/20 text-primary font-medium">
                      <span>Đã chọn: <strong className="font-bold">{batchCount}</strong> quy cách</span>
                      <span>Tổng cộng: <strong className="font-bold">{batchTotalQty}</strong> {selectedVariant?.unit || "món"}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Selected Variant Stock & Quantity Card (for Single Mode & Single-variant products) */}
          {(mode === "single" || variants.length === 1) && selectedVariant && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-muted/40 border">
              <div>
                <span className="text-xs text-muted-foreground block">Đang chọn & Tồn khả dụng:</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-sm font-bold text-foreground">
                    {variantLabel(selectedVariant.attributes, selectedVariant.unit)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    (Tồn: <strong className="text-foreground">{selectedVariant.stock}</strong> {selectedVariant.unit || "đơn vị"})
                  </span>
                </div>
                {selectedVariant.sku_code && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
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