import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  /** Màu chip icon; mặc định cam chủ đạo. */
  tone?: StatTone;
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          <div className="truncate text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
