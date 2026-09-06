"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StockLocationOption {
  id: string;
  code: string;
  name: string;
}

// Nút "In bảng tồn" theo kho (Task 12): chọn kho rồi mở PDF /api/reports/stock/pdf?location=<id>
// trong tab mới. Mặc định chọn Kho chính (KHO_CHINH) — khớp mặc định của route PDF.
export function StockPdfButton({ locations }: { locations: StockLocationOption[] }) {
  const [locationId, setLocationId] = useState<string>(() => {
    const main = locations.find((l) => l.code === "KHO_CHINH");
    return (main ?? locations[0])?.id ?? "";
  });
  const location = locations.find((l) => l.id === locationId);

  return (
    <div className="flex items-center gap-2">
      <Select value={locationId} onValueChange={setLocationId} disabled={locations.length === 0}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Chọn kho" />
        </SelectTrigger>
        <SelectContent>
          {locations.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name} ({l.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {location ? (
        <Link
          href={`/api/reports/stock/pdf?location=${location.id}`}
          target="_blank"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          In bảng tồn
        </Link>
      ) : (
        <span className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground" aria-disabled="true">
          In bảng tồn
        </span>
      )}
    </div>
  );
}
