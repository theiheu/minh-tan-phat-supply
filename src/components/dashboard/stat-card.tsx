import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

/**
 * Tông màu chip icon của thẻ thống kê — nền nhạt + chữ đậm cho dễ phân biệt.
 * (Phải là chuỗi đầy đủ để Tailwind giữ class; không nối động.)
 */
const TONES = {
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
} as const;

export type StatTone = keyof typeof TONES;

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "orange",
  onClick,
  hint,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  /** Màu chip icon; mặc định cam chủ đạo. */
  tone?: StatTone;
  onClick?: () => void;
  hint?: string;
  className?: string;
}) {
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
        "py-2.5 sm:py-4 text-left select-none",
        isClickable &&
          "cursor-pointer transition-all duration-150 hover:border-primary/50 hover:shadow-md hover:ring-1 hover:ring-primary/20 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      <CardContent className="flex items-center justify-between gap-2 px-3.5 sm:px-6">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div
            className={`flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}
          >
            <Icon className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold tabular-nums leading-tight">{value}</div>
            <div className="truncate text-xs sm:text-sm text-muted-foreground">{label}</div>
            {hint && <div className="hidden sm:block text-[11px] text-muted-foreground/80 mt-0.5">{hint}</div>}
          </div>
        </div>
        {isClickable && (
          <div className="text-muted-foreground/50 shrink-0 pr-0.5 sm:pr-1">
            <ChevronRight className="size-3.5 sm:size-4" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
