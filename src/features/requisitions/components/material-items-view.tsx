"use client";

import { useState } from "react";
import { ChevronRight, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { variantLabel } from "@/lib/labels";
import { cn } from "cn";
import { ZoomableImage } from "@/components/image-lightbox";

/** Một dòng vật tư trong phiếu — đủ thông tin để quản kho đối chiếu & lấy đúng đồ. */
export interface MaterialItemView {
  id: string;
  variantId: string | null;
  productName: string | null;
  description: string | null;
  attributes: unknown;
  unit: string | null;
  quantity: number;
  /** Số lượng đã trả lại kho (0 nếu chưa trả). */
  returned: number;
  /** Ảnh biến thể + ảnh sản phẩm (đã gộp, thứ tự ưu tiên biến thể trước). */
  images: string[];
  /** Tồn kho hiện có tại Kho chính (nullable khi không truy vấn được). */
  stock: number | null;
}

function attributeEntries(attrs: unknown): [string, string][] {
  if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
    return Object.entries(attrs as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
    );
  }
  return [];
}

function MaterialThumb({ images, alt, className }: { images: string[]; alt?: string; className?: string }) {
  const src = images[0];
  if (!src) {
    return (
      <div className={cn("flex shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground", className)}>
        <ImageOff className="size-5" aria-hidden />
      </div>
    );
  }
  return (
    <div className="relative inline-flex shrink-0">
      <ZoomableImage
        src={src}
        images={images}
        alt={alt ?? "Vật tư"}
        className={cn("shrink-0 rounded-md border object-cover", className)}
      />
      {images.length > 1 && (
        <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-black/80 text-[9px] font-bold text-white shadow pointer-events-none">
          +{images.length - 1}
        </span>
      )}
    </div>
  );
}

export function MaterialItemsView({ items }: { items: MaterialItemView[] }) {
  const [selected, setSelected] = useState<MaterialItemView | null>(null);

  return (
    <>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không có vật tư trong phiếu.</p>
      ) : (
        <ul className="divide-y">
          {items.map((it) => {
            const label = variantLabel(it.attributes, it.unit);
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => setSelected(it)}
                  className="flex w-full items-center gap-3 rounded-md py-2.5 text-left transition-colors hover:bg-accent/60"
                  title={`Xem thông tin ${it.productName ?? "vật tư"}`}
                >
                  <MaterialThumb images={it.images} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{it.productName ?? "—"}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {label}
                      {label !== (it.unit ?? "") && it.unit ? ` · ${it.unit}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-sm font-medium tabular-nums">SL: {it.quantity}</span>
                      {it.returned > 0 ? (
                        <span className="text-xs text-muted-foreground">đã trả {it.returned}</span>
                      ) : null}
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <MaterialDetailDialog item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function MaterialDetailDialog({ item, onClose }: { item: MaterialItemView | null; onClose: () => void }) {
  const attrs = item ? attributeEntries(item.attributes) : [];
  const stock = item?.stock ?? null;
  return (
    <Dialog open={item !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:w-full sm:max-w-lg h-[90svh] max-h-[90svh] sm:h-auto sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 border-2 border-border shadow-2xl rounded-2xl min-w-0">
        {item && (
          <>
            <DialogHeader className="pb-3 border-b border-border/60 pr-10 sm:pr-8 min-w-0">
              <DialogTitle className="break-words">{item.productName ?? "Vật tư"}</DialogTitle>
              {item.description ? <DialogDescription className="break-words">{item.description}</DialogDescription> : null}
            </DialogHeader>

            {/* Ảnh vật tư */}
            <div>
              {item.images.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {item.images.map((src, i) => (
                    <ZoomableImage
                      key={i}
                      src={src}
                      images={item.images}
                      alt={`${item.productName ?? "Vật tư"} — ảnh ${i + 1}`}
                      title={item.productName ?? "Vật tư"}
                      className="h-44 w-44 shrink-0 rounded-lg border object-cover"
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
                  Chưa có ảnh vật tư
                </div>
              )}
            </div>

            {/* Thông tin chi tiết */}
            <dl className="space-y-1.5 text-sm">
              {attrs.length > 0 && (
                <div className="rounded-lg border p-3">
                  <dt className="mb-1.5 text-xs font-semibold text-muted-foreground pb-1.5 border-b border-border/60">Biến thể</dt>
                  <dd className="grid gap-1 pt-1">
                    {attrs.map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-3">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="text-right font-medium">{v}</span>
                      </div>
                    ))}
                  </dd>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <dt className="text-muted-foreground">Đơn vị</dt>
                <dd className="font-medium">{item.unit ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <dt className="text-muted-foreground">Số lượng yêu cầu</dt>
                <dd className="font-medium tabular-nums">{item.quantity}</dd>
              </div>
              {stock !== null && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground">Tồn kho (Kho chính)</dt>
                  <dd>
                    <Badge variant={stock === 0 ? "danger" : "success"}>
                      {stock}
                    </Badge>
                  </dd>
                </div>
              )}
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
