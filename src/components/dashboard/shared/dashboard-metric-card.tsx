"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONES = {
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 border-orange-200 dark:border-orange-500/20",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border-amber-200 dark:border-amber-500/20",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300 border-sky-200 dark:border-sky-500/20",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300 border-violet-200 dark:border-violet-500/20",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 border-rose-200 dark:border-rose-500/20",
} as const;

export type MetricTone = keyof typeof TONES;

export interface DashboardMetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: MetricTone;
  hint?: string;
  subValue?: string;
  onClick?: () => void;
  className?: string;
}

export function DashboardMetricCard({
  icon: Icon,
  label,
  value,
  tone = "sky",
  hint,
  subValue,
  onClick,
  className,
}: DashboardMetricCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <Card
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "relative overflow-hidden py-3 sm:py-4 text-left select-none rounded-xl border border-border bg-card shadow-2xs transition-all duration-150",
        isClickable &&
          "cursor-pointer hover:border-primary/50 hover:shadow-md hover:ring-1 hover:ring-primary/20 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className
      )}
    >
      <CardContent className="flex items-center justify-between gap-3 px-3.5 sm:px-5">
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
          <div
            className={cn(
              "flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-xl border shadow-2xs",
              TONES[tone]
            )}
          >
            <Icon className="size-5 sm:size-5.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black tabular-nums tracking-tight leading-none">
              {value}
            </div>
            <div className="truncate text-xs sm:text-sm font-medium text-muted-foreground mt-1">
              {label}
            </div>
            {subValue && (
              <div className="text-[11px] font-semibold text-foreground/80 mt-0.5 truncate">
                {subValue}
              </div>
            )}
            {hint && (
              <div className="hidden sm:block text-[11px] text-muted-foreground/75 mt-0.5 truncate">
                {hint}
              </div>
            )}
          </div>
        </div>
        {isClickable && (
          <div className="text-muted-foreground/40 shrink-0">
            <ChevronRight className="size-4" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
