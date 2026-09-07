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
        close();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (images.length > 1) {
          setCurrentIndex((i) => (i - 1 + images.length) % images.length);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (images.length > 1) {
          setCurrentIndex((i) => (i + 1) % images.length);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
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
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white select-none animate-in fade-in duration-200"
      onClick={close}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Header bar: Title & Counter & Close */}
      <div
        className="absolute top-0 inset-x-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0 pr-4">
          {title && <span className="font-medium text-sm sm:text-base truncate drop-shadow">{title}</span>}
          {images.length > 1 && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full text-white/90 shrink-0 tabular-nums">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label="Đóng ảnh phóng to"
          onClick={close}
          className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 shrink-0"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {/* Main Image View */}
      <div
        className="relative flex items-center justify-center max-h-[85vh] max-w-[95vw] pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={appAssetUrl(currentSrc)}
          alt={title || `Ảnh ${currentIndex + 1}`}
          className="max-h-[82vh] w-auto max-w-[90vw] object-contain rounded-lg shadow-2xl transition-all"
        />
      </div>

      {/* Previous / Next buttons */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Ảnh trước"
            onClick={prev}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white border border-white/10 backdrop-blur-sm transition-all hover:bg-black/80 hover:scale-105"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            aria-label="Ảnh sau"
            onClick={next}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white border border-white/10 backdrop-blur-sm transition-all hover:bg-black/80 hover:scale-105"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      )}

      {/* Thumbnail dots when multiple images */}
      {images.length > 1 && images.length <= 15 && (
        <div
          className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5 px-4 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
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
                idx === currentIndex ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
              )}
            />
          ))}
        </div>
      )}
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
