"use client";

import { Milestone } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { SlipDetailPayload } from "@/features/dashboard/actions/get-slip-detail";

const EVENT_DOT_CLASS: Record<string, string> = {
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-400 dark:bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-gray-400 dark:bg-gray-500",
};

const EVENT_LABEL_CLASS: Record<string, string> = {
  info: "text-sky-700 dark:text-sky-300",
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
  neutral: "text-gray-700 dark:text-gray-300",
};

const EVENT_KEY_DOT_CLASS: Record<string, string> = {
  "requisition.fulfill": "bg-orange-500",
};

const EVENT_KEY_LABEL_CLASS: Record<string, string> = {
  "requisition.fulfill": "text-orange-700 dark:text-orange-300",
};

interface SlipTimelineProps {
  timeline: SlipDetailPayload["timeline"];
}

export function SlipTimeline({ timeline }: SlipTimelineProps) {
  if (!timeline || timeline.length === 0) return null;

  return (
    <div className="space-y-3 p-3.5 border-2 border-border/80 rounded-xl bg-card">
      <div className="flex items-center gap-2 pb-2 border-b border-border/60">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
          <Milestone className="size-3.5" aria-hidden />
        </span>
        <span className="text-xs font-semibold text-foreground">Tiến trình</span>
      </div>
      <ol className="pl-1 pt-1">
        {timeline.map((t, i) => {
          const isLast = i === timeline.length - 1;
          const tone = t.tone ?? "neutral";
          const isFulfill =
            t.key === "requisition.fulfill" ||
            t.key === "fulfill" ||
            t.key === "exchange.issue" ||
            t.label?.toLowerCase().includes("cấp phát");
          const dotClass = isFulfill
            ? "bg-orange-500"
            : (EVENT_KEY_DOT_CLASS[t.key] ?? EVENT_DOT_CLASS[tone] ?? "bg-gray-400 dark:bg-gray-500");
          const labelClass = isFulfill
            ? "text-orange-700 dark:text-orange-300"
            : (EVENT_KEY_LABEL_CLASS[t.key] ?? EVENT_LABEL_CLASS[tone] ?? "text-foreground");
          return (
            <li key={i} className="flex gap-3">
              <div aria-hidden className="flex flex-col items-center self-stretch">
                <span
                  className={cn("mt-[5px] size-2.5 shrink-0 rounded-full", dotClass)}
                  style={isFulfill ? { backgroundColor: "#f97316" } : undefined}
                />
                {!isLast ? <span className="w-px flex-1 rounded-full bg-border" /> : null}
              </div>
              <div className={cn("min-w-0 flex-1", isLast ? "pb-0.5" : "pb-4")}>
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-xs">
                  <span className={cn("font-semibold", labelClass)}>
                    {t.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {t.at ? formatDateTime(t.at) : "—"}
                  </span>
                  {t.by ? <span className="text-muted-foreground">· {t.by}</span> : null}
                </div>
                {t.note && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
                    Lý do: {t.note}
                  </p>
                )}
                {t.detail && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
