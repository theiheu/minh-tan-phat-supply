"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { AICopilotDrawer } from "./ai-copilot-drawer";
import { cn } from "@/lib/utils";

export function AIFloatingTrigger() {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button (FAB) - Bottom Right */}
      <div className="fixed z-40 right-4 sm:right-6 bottom-20 lg:bottom-6 select-none">
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "group relative flex items-center gap-2.5 rounded-full",
            "bg-linear-to-r from-primary via-primary/95 to-amber-500",
            "text-primary-foreground shadow-lg hover:shadow-xl hover:shadow-primary/25",
            "px-4 py-2.5 sm:px-4.5 sm:py-3 transition-all duration-300",
            "hover:scale-105 active:scale-95 cursor-pointer border border-white/20"
          )}
          aria-label="Mở trợ lý AI Copilot (Ctrl+J)"
          title="Trợ lý AI Copilot (Ctrl+J)"
        >
          {/* Glowing pulse ring */}
          <span className="absolute -inset-0.5 rounded-full bg-linear-to-r from-primary to-amber-400 opacity-40 blur-xs group-hover:opacity-75 transition duration-500 animate-pulse" />

          <div className="relative flex items-center justify-center size-5 shrink-0">
            <Sparkles className="size-5 text-amber-200 animate-[spin_4s_linear_infinite]" />
          </div>

          <div className="relative flex items-center gap-1.5 font-semibold text-xs sm:text-sm tracking-wide">
            <span>AI Copilot</span>
            <span className="hidden sm:inline-flex items-center text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-white/20 text-white/90 backdrop-blur-xs">
              Ctrl+J
            </span>
          </div>
        </button>
      </div>

      {/* Slide-over AI Drawer */}
      <AICopilotDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
