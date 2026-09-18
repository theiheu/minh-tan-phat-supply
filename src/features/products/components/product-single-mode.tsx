import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X, Package, ImageIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { appAssetUrl } from "@/lib/images";

export function ProductSingleMode({
  hasMultiAxis,
  optionAxes,
  selectedAxisValues,
  getAvailableValuesForAxis,
  handleSelectAxisValue,
  variants,
  searchFilter,
  setSearchFilter,
  filteredFlatVariants,
  selectedVariantId,
  handleSelectVariantDirect,
}: any) {
  return (
    <>
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
    </>
  );
}
