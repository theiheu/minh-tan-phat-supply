"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { appAssetUrl } from "@/lib/images";

/**
 * Ảnh vật tư có thể bấm phóng to — dùng cho ảnh thẻ vật tư chính & ảnh từng biến thể.
 * - Không có ảnh: hiện ô placeholder (không bấm được).
 * - Có nhiều ảnh: popup cho bấm ← → xem từng ảnh.
 */
export function StocktakeImageViewer({
  images,
  name,
  className,
}: {
  /** Danh sách ảnh (thứ tự ưu tiên đã được sắp sẵn ở nơi gọi). */
  images: string[];
  name: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  if (images.length === 0) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-5" aria-hidden />
      </div>
    );
  }

  const src = images[Math.min(idx, images.length - 1)];

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={appAssetUrl(src)}
        alt={name}
        onClick={(e) => {
          e.stopPropagation();
          setIdx(0);
          setOpen(true);
        }}
        className={cn("shrink-0 cursor-zoom-in rounded-md border object-cover", className)}
      />

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : setOpen(false))}>
        <DialogContent className="max-w-5xl">
          <div className="flex items-center justify-between">
            <DialogTitle className="pr-8 text-base">{name}</DialogTitle>
            {images.length > 1 && (
              <span className="text-xs text-muted-foreground">
                {idx + 1}/{images.length}
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-3">
            {images.length > 1 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
                aria-label="Ảnh trước"
              >
                <ChevronLeft className="size-4" />
              </Button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={appAssetUrl(src)}
              alt={`${name} — ảnh ${idx + 1}`}
              className="max-h-[85vh] w-auto max-w-full rounded-md border object-contain"
            />
            {images.length > 1 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIdx((i) => (i + 1) % images.length)}
                aria-label="Ảnh sau"
              >
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
