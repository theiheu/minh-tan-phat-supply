"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { appAssetUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

export interface ImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  initialIndex?: number;
  title?: string;
}

export function ImageLightbox({
  open,
  onOpenChange,
  images,
  initialIndex = 0,
  title,
}: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
    }
  }, [open, initialIndex, images.length]);

  const close = useCallback((e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    onOpenChange(false);
  }, [onOpenChange]);

  const prev = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setCurrentIndex((i) => (i - 1 + images.length) % images.length);
    },
    [images.length]
  );

  const next = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setCurrentIndex((i) => (i + 1) % images.length);
    },
    [images.length]
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        close();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (images.length > 1) {
          setCurrentIndex((i) => (i - 1 + images.length) % images.length);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (images.length > 1) {
          setCurrentIndex((i) => (i + 1) % images.length);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, images.length, close]);

  if (!mounted || !open || images.length === 0) return null;

  const currentSrc = images[currentIndex] || images[0];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || "Xem ảnh phóng to"}
      data-lightbox-open="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3 backdrop-blur-[2px] sm:p-6 select-none"
      onClick={close}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Khung gallery thu gọn — không phủ toàn màn hình */}
      <div
        className="relative flex w-full max-w-[min(94vw,56rem)] flex-col overflow-hidden rounded-2xl border border-border/80 bg-background text-foreground shadow-2xl animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar: Title & Counter & Close */}
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {title && <span className="truncate text-sm font-medium sm:text-base">{title}</span>}
            {images.length > 1 && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="Đóng ảnh phóng to"
            onClick={close}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* Main Image View */}
        <div className="relative flex min-h-0 items-center justify-center overflow-hidden bg-muted/50 p-3 sm:p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={appAssetUrl(currentSrc)}
            alt={title || `Ảnh ${currentIndex + 1}`}
            className="max-h-[60vh] w-auto max-w-full object-contain rounded-lg transition-all"
          />

          {/* Previous / Next buttons */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Ảnh trước"
                onClick={prev}
                className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white shadow-md backdrop-blur-sm transition-all hover:bg-black/75 hover:scale-105 sm:left-3"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Ảnh sau"
                onClick={next}
                className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white shadow-md backdrop-blur-sm transition-all hover:bg-black/75 hover:scale-105 sm:right-3"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail dots when multiple images */}
        {images.length > 1 && images.length <= 15 && (
          <div className="flex items-center justify-center gap-1.5 border-t px-4 py-2.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Chuyển đến ảnh ${idx + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={cn(
                  "h-2 rounded-full transition-all cursor-pointer",
                  idx === currentIndex ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export interface ZoomableImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "onClick"> {
  src?: string | null;
  alt?: string;
  images?: string[];
  title?: string;
  className?: string;
  wrapperClassName?: string;
  showZoomIcon?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}

export function ZoomableImage({
  src,
  alt = "",
  images,
  title,
  className,
  wrapperClassName,
  showZoomIcon = false,
  onClick,
  ...props
}: ZoomableImageProps) {
  const [open, setOpen] = useState(false);

  if (!src) return null;

  const allImages = images && images.length > 0 ? images : [src];
  const initialIndex = Math.max(0, allImages.indexOf(src));

  return (
    <>
      <span
        className={cn("group/zoom relative inline-flex shrink-0 cursor-zoom-in items-center justify-center", wrapperClassName)}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onClick?.(e);
          setOpen(true);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={appAssetUrl(src)}
          alt={alt}
          className={cn("transition-opacity group-hover/zoom:opacity-95", className)}
          {...props}
        />
        {showZoomIcon && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover/zoom:opacity-100 rounded-[inherit] pointer-events-none">
            <ZoomIn className="size-4 text-white drop-shadow" />
          </span>
        )}
      </span>
      <ImageLightbox
        open={open}
        onOpenChange={setOpen}
        images={allImages}
        initialIndex={initialIndex}
        title={title || alt}
      />
    </>
  );
}
