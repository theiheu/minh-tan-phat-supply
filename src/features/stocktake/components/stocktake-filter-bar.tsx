"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CheckFilter } from "../lib/grouping";

const CHIP_CLS =
  "h-7 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-50";

/** Nhãn hiển thị từng nút lọc trạng thái. */
export const CHECK_FILTER_LABEL: Record<CheckFilter, string> = {
  all: "Tất cả",
  checked: "Đã kiểm",
  unchecked: "Chưa kiểm",
  diff: "Có lệch",
};

/**
 * Thanh công cụ của một phiếu kiểm kê: ô tìm vật tư + lọc danh mục
 * + nút lọc theo trạng thái. Dùng chung bảng nhập & bảng chi tiết.
 */
export function StocktakeFilterBar({
  query,
  onQuery,
  filter,
  onFilter,
  counts,
  options = ["all", "checked", "unchecked", "diff"],
  categories,
  category,
  onCategoryChange,
}: {
  query: string;
  onQuery: (q: string) => void;
  filter: CheckFilter;
  onFilter: (f: CheckFilter) => void;
  counts: Record<CheckFilter, number>;
  /** Các nút lọc được phép hiển thị (chi tiết phiếu đã chốt: chỉ Tất cả/Có lệch). */
  options?: CheckFilter[];
  /** Danh mục để lọc ('' = tất cả). */
  categories?: { value: string; label: string }[];
  category?: string;
  onCategoryChange?: (v: string) => void;
}) {
  const selectCls =
    "h-7 rounded-md border border-input bg-background px-2 text-xs font-medium text-muted-foreground outline-none focus-visible:border-ring";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Tìm vật tư (tên, biến thể)…"
          className="pl-8"
        />
      </div>
      {categories && categories.length > 1 && onCategoryChange && (
        <select
          value={category ?? ""}
          onChange={(e) => onCategoryChange(e.target.value)}
          className={cn(selectCls, "h-9 px-2.5")}
          aria-label="Lọc danh mục"
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={filter === o}
            onClick={() => onFilter(o)}
            className={cn(
              CHIP_CLS,
              filter === o
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {CHECK_FILTER_LABEL[o]} ({counts[o]})
          </button>
        ))}
      </div>
    </div>
  );
}
