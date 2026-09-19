"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export interface DriverAccountOption {
  id: string;
  name: string;
  username?: string;
  email?: string | null;
}

export interface DriverAccountSelectProps {
  drivers: DriverAccountOption[];
  driverId: string;
  driverName: string;
  onDriverChange: (driverId: string, driverName: string) => void;
  disabled?: boolean;
}

export function DriverAccountSelect({
  drivers,
  driverId,
  driverName,
  onDriverChange,
  disabled = false,
}: DriverAccountSelectProps) {
  const isCustom = driverId === "custom" || (!driverId && Boolean(driverName));

  const handleSelectChange = (val: string) => {
    if (val === "none") {
      onDriverChange("", "");
    } else if (val === "custom") {
      onDriverChange("custom", driverName || "");
    } else {
      const found = drivers.find((d) => d.id === val);
      if (found) {
        onDriverChange(found.id, found.name);
      }
    }
  };

  const handleCustomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDriverChange("custom", e.target.value);
  };

  const selectedValue = isCustom ? "custom" : (driverId || "none");

  return (
    <div className="space-y-2">
      <div className="space-y-1.5 min-w-0">
        <Label htmlFor="driverSelect" className="text-xs font-semibold">
          Tài xế / Người lái (Nhận thông báo email)
        </Label>
        <Select
          value={selectedValue}
          onValueChange={handleSelectChange}
          disabled={disabled}
        >
          <SelectTrigger id="driverSelect" className="w-full">
            <SelectValue placeholder="Chọn tài xế có tài khoản..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-- Không gán tài xế --</SelectItem>
            {drivers.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                🚗 {d.name} {d.username ? `(@${d.username})` : ""}
              </SelectItem>
            ))}
            <SelectItem value="custom">-- Nhập tên tài xế tự do / Vãng lai --</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isCustom && (
        <div className="space-y-1.5 min-w-0 animate-in fade-in-50">
          <Label htmlFor="customDriverName" className="text-xs font-medium text-muted-foreground">
            Tên tài xế nhập tay (Không gửi email định danh)
          </Label>
          <Input
            id="customDriverName"
            placeholder="Nhập tên tài xế vãng lai..."
            value={driverName}
            onChange={handleCustomNameChange}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
