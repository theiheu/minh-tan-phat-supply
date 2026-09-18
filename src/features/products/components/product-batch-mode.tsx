import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Package, ImageIcon, Tag, Minus, Plus } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { appAssetUrl } from "@/lib/images";

export function ProductBatchMode({
  uniqueBrands,
  batchBrandFilter,
  setBatchBrandFilter,
  parsedVariants,
  brandGroups,
  batchSearch,
  setBatchSearch,
  filteredBatchVariants,
  batchGroupedMap,
  batchQuantities,
  setSelectedVariantId,
  setMode,
  setBatchQty,
  batchCount,
  batchTotalQty,
  selectedVariant,
}: any) {
  return (
    <div className="space-y-3">
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
          {uniqueBrands.map((b: string) => {
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

      <div className="rounded-lg border overflow-hidden max-h-72 overflow-y-auto divide-y bg-background">
        {filteredBatchVariants.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Không tìm thấy quy cách khớp với &quot;{batchSearch}&quot;
          </div>
        ) : (
          Array.from(batchGroupedMap.entries()).map(([groupName, groupVariants]: any) => (
            <div key={groupName} className="divide-y">
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

              {groupVariants.map((v: any) => {
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
                        className="h-7 w-12 text-center text-xs font-bold hide-spin-button px-1"
                        type="number"
                        min={0}
                        max={v.stock}
                        value={currentQty || ""}
                        placeholder="0"
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 0) {
                            setBatchQty(v.id, Math.min(val, v.stock));
                          } else if (e.target.value === "") {
                            setBatchQty(v.id, 0);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        className="size-7 text-foreground"
                        onClick={() => setBatchQty(v.id, Math.min(v.stock, currentQty + 1))}
                        disabled={currentQty >= v.stock}
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
  );
}
