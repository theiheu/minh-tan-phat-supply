"use client";

import { Calendar, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  className?: string;
}

export function ReportDateFilters({
  value,
  onChange,
  locations = [],
  showLocation = true,
  className,
}: ReportDateFiltersProps) {
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
        "flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-xs lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      {/* Presets buttons */}
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
                "h-8 px-2.5 text-xs font-medium transition-colors",
                !isActive &&
                  "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              onClick={() => handlePresetSelect(p.id)}
            >
              {p.label}
            </Button>
          );
        })}
      </div>

      {/* Date Range Inputs & Location Selector */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Custom date range picker */}
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Từ</span>
            <Input
              type="date"
              aria-label="Từ ngày"
              value={value.from}
              onChange={(e) => handleFromChange(e.target.value)}
              className="h-8 w-[130px] px-2 text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Đến</span>
            <Input
              type="date"
              aria-label="Đến ngày"
              value={value.to}
              onChange={(e) => handleToChange(e.target.value)}
              className="h-8 w-[130px] px-2 text-xs"
            />
          </div>
        </div>

        {/* Location selector */}
        {showLocation && (
          <div className="flex items-center gap-1.5">
            <Warehouse className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <select
              aria-label="Kho"
              value={value.locationId ?? ""}
              onChange={(e) => handleLocationChange(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50"
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
      </div>
    </div>
  );
}
