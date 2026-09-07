"use client";

import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { ZoomableImage } from "@/components/image-lightbox";

/**
 * Ảnh vật tư có thể bấm phóng to — dùng cho ảnh thẻ vật tư chính & ảnh từng biến thể trong kiểm kê.
 * - Không có ảnh: hiện ô placeholder (không bấm được).
 * - Có ảnh: mở popup lightbox phóng to với phím tắt Esc / Mũi tên.
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

  return (
    <ZoomableImage
      src={images[0]}
      images={images}
      alt={name}
      title={name}
      className={cn("shrink-0 rounded-md border object-cover", className)}
    />
  );
}
