"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Gallery trượt ngang hiển thị nhiều ảnh trong một khung vuông cố định.
 * - Các slide được cắt lấp đầy (object-cover) → mọi thẻ hiển thị ảnh đồng nhất kích thước.
 * - Trượt bằng tay (mobile) hoặc nút mũi tên (desktop hover); chấm tròn để chuyển nhanh.
 */
export function ProductImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;

  function syncIndex() {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(Math.min(count - 1, Math.max(0, idx)));
  }

  function goTo(i: number, e?: React.MouseEvent) {
    e?.stopPropagation();
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  }

  return (
    <div className="group relative aspect-square w-full overflow-hidden bg-muted">
      <div
        ref={scrollerRef}
        onScroll={syncIndex}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <div key={i} className="relative h-full w-full shrink-0 snap-center">
            <Image
              src={src}
              alt={alt}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Ảnh trước"
            onClick={(e) => goTo(Math.max(0, index - 1), e)}
            className="absolute top-1/2 left-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white opacity-0 transition-opacity hover:bg-black/50 group-hover:opacity-100"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Ảnh sau"
            onClick={(e) => goTo(Math.min(count - 1, index + 1), e)}
            className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white opacity-0 transition-opacity hover:bg-black/50 group-hover:opacity-100"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ảnh ${i + 1}`}
                onClick={(e) => goTo(i, e)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
