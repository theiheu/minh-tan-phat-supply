"use client";

import type { ReactNode } from "react";
import { Calendar, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DatePreset } from "../types";
import { DATE_PRESETS, getPresetRange, toYmd } from "../lib/date-utils";

export { DATE_PRESETS, getPresetRange, toYmd };

export interface StockLocationOption {
  id: string;
  code: string;
  name: string;
}

export interface ReportDateFiltersProps {
  value: {
    from: string; // YYYY-MM-DD
    to: string; // YYYY-MM-DD
    preset: DatePreset;
    locationId?: string;
  };
  onChange: (next: {
    from: string;
    to: string;
    preset: DatePreset;
    locationId?: string;
  }) => void;
  locations?: StockLocationOption[];
  showLocation?: boolean; // Default true
  actions?: ReactNode;
  className?: string;
}

export function ReportDateFilters({
  value,
  onChange,
  locations = [],
  showLocation = true,
  actions,
  className,
}: ReportDateFiltersProps) {
  const isCustom = value.preset === "custom";

  const handlePresetSelect = (preset: DatePreset) => {
    if (preset === "custom") {
      onChange({
        ...value,
        preset: "custom",
      });
      return;
    }

    const range = getPresetRange(preset);
    onChange({
      from: range.from,
      to: range.to,
      preset,
      locationId: value.locationId,
    });
  };

  const handleFromChange = (newFrom: string) => {
    onChange({
      ...value,
      from: newFrom,
      preset: "custom",
    });
  };

  const handleToChange = (newTo: string) => {
    onChange({
      ...value,
      to: newTo,
      preset: "custom",
    });
  };

  const handleLocationChange = (locationId: string) => {
    onChange({
      ...value,
      locationId: locationId || undefined,
    });
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 shadow-xs space-y-2.5",
        className
      )}
    >
      {/* Main bar: Preset buttons on left, Date range badge & Warehouse select firmly pushed to the right */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Presets buttons - Giữ nguyên thiết kế ban đầu với Button chuẩn */}
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map((p) => {
            const isActive = value.preset === p.id;
            return (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={isActive ? "default" : "outline"}
                aria-pressed={isActive}
                className={cn(
                  "h-8 px-2.5 text-xs font-medium transition-colors cursor-pointer",
                  !isActive &&
                    "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                onClick={() => handlePresetSelect(p.id)}
              >
                {p.id === "custom" && (
                  <Calendar className="mr-1 size-3.5" aria-hidden="true" />
                )}
                {p.label}
              </Button>
            );
          })}
        </div>

        {/* Right side: Date Range summary badge & Location selector (Pushed to the right) */}
        <div className="flex flex-wrap items-center gap-2.5 sm:ml-auto justify-start sm:justify-end">
          {/* Formatted Date Range summary badge */}
          <div className="inline-flex items-center gap-1.5 rounded-md border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground font-medium shadow-2xs">
            <Calendar className="size-3.5 text-primary/70" aria-hidden="true" />
            <span className="tabular-nums">
              {formatDate(value.from)} – {formatDate(value.to)}
            </span>
          </div>

          {/* Location selector */}
          {showLocation && (
            <div className="flex items-center gap-1.5">
              <Warehouse className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <select
                aria-label="Kho"
                value={value.locationId ?? ""}
                onChange={(e) => handleLocationChange(e.target.value)}
                className="h-8 min-w-[150px] max-w-[240px] rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-2xs outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50"
              >
                <option value="">Tất cả kho</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code ? `${loc.name} (${loc.code})` : loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {actions ? (
            <div
              data-testid="report-filter-toolbar"
              className="flex items-center gap-1 border-l pl-2"
            >
              {actions}
            </div>
          ) : (
            <div data-testid="report-filter-toolbar" />
          )}
        </div>
      </div>

      {/* Collapsible Custom Date Pickers - Sổ ra khi chọn 'Tùy chọn ngày' */}
      {isCustom && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-2.5 text-xs animate-in fade-in duration-150">
          <span className="font-medium text-muted-foreground">Khoảng ngày tùy chọn:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Từ ngày:</span>
            <Input
              type="date"
              aria-label="Từ ngày"
              value={value.from}
              onChange={(e) => handleFromChange(e.target.value)}
              className="h-8 w-[135px] px-2 text-xs bg-background"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Đến ngày:</span>
            <Input
              type="date"
              aria-label="Đến ngày"
              value={value.to}
              onChange={(e) => handleToChange(e.target.value)}
              className="h-8 w-[135px] px-2 text-xs bg-background"
            />
          </div>
        </div>
      )}
    </div>
  );
}
