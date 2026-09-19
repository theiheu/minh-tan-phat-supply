"use client";

import * as React from "react";
import { Sparkles, GripVertical } from "lucide-react";
import { AICopilotDrawer } from "./ai-copilot-drawer";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mtp_ai_copilot_fab_pos";
const BUTTON_WIDTH_DESKTOP = 140;
const BUTTON_HEIGHT_DESKTOP = 48;
const BUTTON_SIZE_MOBILE = 44;
const PADDING = 12;
const DRAG_THRESHOLD = 6;

export function AIFloatingTrigger() {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const buttonRef = React.useRef<HTMLDivElement>(null);
  const isPointerDownRef = React.useRef(false);
  const isDraggingRef = React.useRef(false);
  const hasJustDraggedRef = React.useRef(false);
  const dragStartRef = React.useRef({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  const clampPosition = React.useCallback((x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const isMobile = window.innerWidth < 640;
    const btnWidth = isMobile ? BUTTON_SIZE_MOBILE : BUTTON_WIDTH_DESKTOP;
    const btnHeight = isMobile ? BUTTON_SIZE_MOBILE : BUTTON_HEIGHT_DESKTOP;
    const maxX = Math.max(PADDING, window.innerWidth - btnWidth - PADDING);
    const maxY = Math.max(PADDING, window.innerHeight - btnHeight - PADDING);
    return {
      x: Math.min(Math.max(PADDING, x), maxX),
      y: Math.min(Math.max(PADDING, y), maxY),
    };
  }, []);

  // Khởi tạo vị trí ban đầu
  React.useEffect(() => {
    setMounted(true);

    const getInitialPos = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (
            typeof parsed.x === "number" &&
            typeof parsed.y === "number" &&
            parsed.x >= 0 &&
            parsed.x <= window.innerWidth &&
            parsed.y >= 0 &&
            parsed.y <= window.innerHeight
          ) {
            return clampPosition(parsed.x, parsed.y);
          }
        } catch {
          // ignore corrupted json
        }
      }

      // Vị trí mặc định ở góc phải dưới (tránh thanh bottom nav trên mobile)
      const isMobile = window.innerWidth < 640;
      const btnWidth = isMobile ? BUTTON_SIZE_MOBILE : BUTTON_WIDTH_DESKTOP;
      const btnHeight = isMobile ? BUTTON_SIZE_MOBILE : BUTTON_HEIGHT_DESKTOP;
      const bottomOffset = isMobile ? 80 : 24;
      const rightOffset = isMobile ? 16 : 24;

      return clampPosition(
        window.innerWidth - btnWidth - rightOffset,
        window.innerHeight - btnHeight - bottomOffset
      );
    };

    setPosition(getInitialPos());

    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return getInitialPos();
        return clampPosition(prev.x, prev.y);
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition]);

  // Pointer Drag Handlers (Hỗ trợ đồng nhất cả Mouse, Touch và Stylus)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !position) return;

    isPointerDownRef.current = true;
    isDraggingRef.current = false;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const distance = Math.hypot(deltaX, deltaY);

    if (!isDraggingRef.current) {
      if (distance > DRAG_THRESHOLD) {
        isDraggingRef.current = true;
        setIsDragging(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore pointer capture errors if any
        }
      } else {
        return;
      }
    }

    const clamped = clampPosition(
      dragStartRef.current.initialX + deltaX,
      dragStartRef.current.initialY + deltaY
    );
    setPosition(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      hasJustDraggedRef.current = true;
      setTimeout(() => {
        hasJustDraggedRef.current = false;
      }, 150);

      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }

      // Lưu tọa độ mới vào localStorage
      setPosition((latest) => {
        if (latest) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
        }
        return latest;
      });
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (hasJustDraggedRef.current || isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setOpen(true);
  };

  if (!mounted || !position) {
    return null;
  }

  return (
    <>
      {/* Draggable Floating Action Button (FAB) */}
      <div
        ref={buttonRef}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={cn(
          "fixed top-0 left-0 z-40 select-none transition-opacity duration-200",
          open && "opacity-0 pointer-events-none",
          isDragging ? "cursor-grabbing shadow-2xl opacity-90" : "cursor-grab",
          !isDragging && "transition-transform duration-100 ease-out"
        )}
      >
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "group relative flex items-center rounded-full cursor-pointer",
            "bg-linear-to-r from-primary via-primary/95 to-amber-500",
            "text-primary-foreground shadow-lg hover:shadow-xl hover:shadow-primary/25",
            "border border-white/20 active:scale-95 transition-transform",
            "size-11 justify-center p-0",
            "sm:h-12 sm:w-[140px] sm:justify-between sm:pl-2.5 sm:pr-4 sm:py-2.5 sm:gap-2"
          )}
          aria-label="Mở trợ lý AI Copilot (Ctrl+J)"
          title="Trợ lý AI Copilot (Kéo để di chuyển, bấm để mở)"
        >
          {/* Glowing pulse ring */}
          <span className="absolute -inset-0.5 rounded-full bg-linear-to-r from-primary to-amber-400 opacity-40 blur-xs group-hover:opacity-75 transition duration-500 animate-pulse pointer-events-none" />

          {/* Grip drag handle icon - visible on desktop */}
          <div className="relative hidden sm:flex items-center justify-center text-white/60 group-hover:text-white transition-colors pointer-events-none">
            <GripVertical className="size-3.5" />
          </div>

          <div className="relative flex items-center justify-center size-5 shrink-0 pointer-events-none">
            <Sparkles className="size-5 sm:size-4.5 text-amber-200 animate-[spin_4s_linear_infinite]" />
          </div>

          {/* Label - visible on desktop */}
          <div className="relative hidden sm:flex items-center gap-1 font-semibold text-xs sm:text-sm tracking-wide shrink-0 pointer-events-none">
            <span>AI Copilot</span>
          </div>
        </button>
      </div>

      {/* Slide-over AI Drawer */}
      <AICopilotDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
