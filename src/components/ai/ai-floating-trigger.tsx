"use client";

import * as React from "react";
import { Sparkles, GripVertical } from "lucide-react";
import { AICopilotDrawer } from "./ai-copilot-drawer";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mtp_ai_copilot_fab_pos";
const BUTTON_WIDTH = 140;
const BUTTON_HEIGHT = 48;
const PADDING = 12;

export function AIFloatingTrigger() {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const dragRef = React.useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
  });

  const buttonRef = React.useRef<HTMLDivElement>(null);

  // Initialize position
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
            // Keep within current window bounds
            const maxX = Math.max(PADDING, window.innerWidth - BUTTON_WIDTH - PADDING);
            const maxY = Math.max(PADDING, window.innerHeight - BUTTON_HEIGHT - PADDING);
            return {
              x: Math.min(Math.max(PADDING, parsed.x), maxX),
              y: Math.min(Math.max(PADDING, parsed.y), maxY),
            };
          }
        } catch {
          // ignore corrupted json
        }
      }

      // Default bottom-right (taking into account mobile bottom nav bar)
      const isMobile = window.innerWidth < 1024;
      const bottomOffset = isMobile ? 84 : 24;
      const rightOffset = isMobile ? 16 : 24;

      return {
        x: Math.max(PADDING, window.innerWidth - BUTTON_WIDTH - rightOffset),
        y: Math.max(PADDING, window.innerHeight - BUTTON_HEIGHT - bottomOffset),
      };
    };

    setPosition(getInitialPos());

    // Update bounds on window resize
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return getInitialPos();
        const maxX = Math.max(PADDING, window.innerWidth - BUTTON_WIDTH - PADDING);
        const maxY = Math.max(PADDING, window.innerHeight - BUTTON_HEIGHT - PADDING);
        return {
          x: Math.min(Math.max(PADDING, prev.x), maxX),
          y: Math.min(Math.max(PADDING, prev.y), maxY),
        };
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !position) return; // Chỉ bắt chuột trái

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
      hasMoved: false,
    };
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - dragRef.current.startX;
      const deltaY = moveEvent.clientY - dragRef.current.startY;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        dragRef.current.hasMoved = true;
      }

      const maxX = Math.max(PADDING, window.innerWidth - BUTTON_WIDTH - PADDING);
      const maxY = Math.max(PADDING, window.innerHeight - BUTTON_HEIGHT - PADDING);

      const newX = Math.min(Math.max(PADDING, dragRef.current.initialX + deltaX), maxX);
      const newY = Math.min(Math.max(PADDING, dragRef.current.initialY + deltaY), maxY);

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      // Save position to localStorage
      setPosition((latest) => {
        if (latest) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
        }
        return latest;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Touch Drag Handlers (Mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!position || e.touches.length !== 1) return;
    const touch = e.touches[0];

    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialX: position.x,
      initialY: position.y,
      hasMoved: false,
    };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];

    const deltaX = touch.clientX - dragRef.current.startX;
    const deltaY = touch.clientY - dragRef.current.startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragRef.current.hasMoved = true;
    }

    const maxX = Math.max(PADDING, window.innerWidth - BUTTON_WIDTH - PADDING);
    const maxY = Math.max(PADDING, window.innerHeight - BUTTON_HEIGHT - PADDING);

    const newX = Math.min(Math.max(PADDING, dragRef.current.initialX + deltaX), maxX);
    const newY = Math.min(Math.max(PADDING, dragRef.current.initialY + deltaY), maxY);

    setPosition({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setPosition((latest) => {
      if (latest) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
      }
      return latest;
    });
  };

  const handleClick = () => {
    // Nếu vừa kéo rê nút thì không kích hoạt click mở drawer
    if (dragRef.current.hasMoved) {
      dragRef.current.hasMoved = false;
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
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "fixed top-0 left-0 z-40 select-none",
          isDragging ? "cursor-grabbing scale-105 shadow-2xl opacity-90" : "cursor-grab",
          !isDragging && "transition-transform duration-75 ease-out"
        )}
      >
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "group relative flex items-center gap-2 rounded-full",
            "bg-linear-to-r from-primary via-primary/95 to-amber-500",
            "text-primary-foreground shadow-lg hover:shadow-xl hover:shadow-primary/25",
            "pl-2.5 pr-4 py-2.5 sm:py-3",
            "border border-white/20 active:scale-95 transition-all",
            "h-12 w-[140px] justify-between"
          )}
          aria-label="Mở trợ lý AI Copilot (Ctrl+J)"
          title="Trợ lý AI Copilot (Kéo để di chuyển, bấm để mở)"
        >
          {/* Glowing pulse ring */}
          <span className="absolute -inset-0.5 rounded-full bg-linear-to-r from-primary to-amber-400 opacity-40 blur-xs group-hover:opacity-75 transition duration-500 animate-pulse pointer-events-none" />

          {/* Grip drag handle icon */}
          <div className="relative flex items-center justify-center text-white/60 group-hover:text-white transition-colors">
            <GripVertical className="size-3.5" />
          </div>

          <div className="relative flex items-center justify-center size-5 shrink-0">
            <Sparkles className="size-4.5 text-amber-200 animate-[spin_4s_linear_infinite]" />
          </div>

          <div className="relative flex items-center gap-1 font-semibold text-xs sm:text-sm tracking-wide shrink-0">
            <span>AI Copilot</span>
          </div>
        </button>
      </div>

      {/* Slide-over AI Drawer */}
      <AICopilotDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
