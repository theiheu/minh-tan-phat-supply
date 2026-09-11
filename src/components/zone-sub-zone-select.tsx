"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ZoneOption {
  id: string;
  name: string;
}

export interface SubZoneOption {
  id: string;
  zone_id: string;
  name: string;
}

export interface ZoneSubZoneSelectProps {
  zones: ZoneOption[];
  subZones?: SubZoneOption[];
  zoneId: string;
  subZoneId?: string;
  onZoneChange: (zoneId: string) => void;
  onSubZoneChange?: (subZoneId: string) => void;
  zoneLabel?: string;
  subZoneLabel?: string;
  zonePlaceholder?: string;
  subZonePlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  layout?: "grid" | "stack";
}

export function ZoneSubZoneSelect({
  zones,
  subZones = [],
  zoneId,
  subZoneId = "",
  onZoneChange,
  onSubZoneChange,
  zoneLabel = "Khu vực",
  subZoneLabel = "Trại / Phân xưởng",
  zonePlaceholder = "Chọn khu vực...",
  subZonePlaceholder = "Chọn trại / phân xưởng...",
  required = true,
  disabled = false,
  className,
  layout = "grid",
}: ZoneSubZoneSelectProps) {
  // Lọc các sub_zones trực thuộc zoneId đang chọn
  const availableSubZones = useMemo(() => {
    if (!zoneId || zoneId === "all" || zoneId === "none") return [];
    return subZones.filter((s) => s.zone_id === zoneId);
  }, [subZones, zoneId]);

  function handleZoneSelect(newZoneId: string) {
    onZoneChange(newZoneId);
    if (onSubZoneChange) {
      onSubZoneChange("");
    }
  }

  const hasSubZones = availableSubZones.length > 0;

  return (
    <div
      className={cn(
        layout === "grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "space-y-4",
        className
      )}
    >
      {/* Dropdown 1: Khu vực */}
      <div className="space-y-1.5">
        {zoneLabel && (
          <Label className="text-sm font-medium">
            {zoneLabel} {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        <Select
          value={zoneId || ""}
          onValueChange={handleZoneSelect}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={zonePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {zones.map((z) => (
              <SelectItem key={z.id} value={z.id}>
                {z.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dropdown 2: Trại / Phân xưởng trực thuộc */}
      {onSubZoneChange && (
        <div className="space-y-1.5">
          {subZoneLabel && (
            <Label className="text-sm font-medium">
              {subZoneLabel}
              {!hasSubZones && zoneId && (
                <span className="text-xs text-muted-foreground font-normal ml-1.5">
                  (Khu này không có trại con)
                </span>
              )}
            </Label>
          )}
          <Select
            value={subZoneId || "none"}
            onValueChange={(val) => onSubZoneChange(val === "none" ? "" : val)}
            disabled={disabled || !zoneId || !hasSubZones}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  !zoneId
                    ? "Vui lòng chọn khu trước"
                    : !hasSubZones
                    ? "Không có trại/xưởng con"
                    : subZonePlaceholder
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- Để chung toàn khu --</SelectItem>
              {availableSubZones.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
