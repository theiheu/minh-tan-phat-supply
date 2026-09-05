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

/** Một dòng vật tư trong phiếu — đủ thông tin để quản kho đối chiếu & lấy đúng đồ. */
export interface MaterialItemView {
  id: string;
  variantId: string | null;
  productName: string | null;
  description: string | null;
  attributes: unknown;
  unit: string | null;
  quantity: number;
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

function MaterialThumb({ images, className }: { images: string[]; className?: string }) {
  const src = images[0];
  if (!src) {
    return (
      <div className={cn("flex shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground", className)}>
        <ImageOff className="size-5" aria-hidden />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={cn("shrink-0 rounded-md border object-cover", className)} />;
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
                    <span className="text-sm font-medium tabular-nums">SL: {it.quantity}</span>
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-8">{item.productName ?? "Vật tư"}</DialogTitle>
              {item.description ? <DialogDescription>{item.description}</DialogDescription> : null}
            </DialogHeader>

            {/* Ảnh vật tư */}
            <div>
              {item.images.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {item.images.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt={`${item.productName ?? "Vật tư"} — ảnh ${i + 1}`}
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
                  <dt className="mb-1.5 text-xs font-semibold text-muted-foreground">Biến thể</dt>
                  <dd className="grid gap-1">
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
                    <Badge variant="outline" className={cn(stock === 0 ? "text-red-600" : "text-emerald-700")}>
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
