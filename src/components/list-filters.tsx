"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const SELECT_CLS =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type DatePreset = "today" | "yesterday" | "this_week" | "this_month";

const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Hôm nay" },
  { value: "yesterday", label: "Hôm qua" },
  { value: "this_week", label: "Tuần này" },
  { value: "this_month", label: "Tháng này" },
];

const DATE_RANGE_OPTIONS: {
  value: DatePreset | "" | "custom";
  label: string;
}[] = [
  { value: "", label: "Tất cả ngày" },
  ...DATE_PRESET_OPTIONS,
  { value: "custom", label: "Tùy chọn ngày…" },
];

/** Chuyển Date → "YYYY-MM-DD" theo múi giờ máy người dùng. */
function toYmd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Khoảng from/to (YYYY-MM-DD) của các mốc thời gian nhanh. */
function presetRanges(
  now: Date = new Date(),
): Record<DatePreset, { from: string; to: string }> {
  const today = toYmd(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Thứ 2 đầu tuần
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    today: { from: today, to: today },
    yesterday: { from: toYmd(yesterday), to: toYmd(yesterday) },
    this_week: { from: toYmd(monday), to: toYmd(sunday) },
    this_month: { from: toYmd(first), to: toYmd(last) },
  };
}

/** Tìm mốc nhanh khớp cặp from/to hiện tại; "" = chưa lọc, "custom" = khoảng tùy chỉnh. */
function presetValueFor(from: string, to: string): DatePreset | "" | "custom" {
  if (!from && !to) return "";
  for (const [key, r] of Object.entries(presetRanges()) as [
    DatePreset,
    { from: string; to: string },
  ][]) {
    if (r.from === from && r.to === to) return key;
  }
  return "custom";
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface SelectFilter {
  /** Tên query param (VD "status", "type", "zone"). */
  param: string;
  /** Nhãn hiển thị trong sheet (VD "Trạng thái"). */
  label: string;
  /** Nhãn option "chọn tất cả" (mặc định "Tất cả"). */
  allLabel?: string;
  options: FilterOption[];
}

export interface ListFiltersProps {
  /** Đường dẫn gốc của trang (VD "/requisitions"). */
  basePath: string;
  /** Cho phép hiện ô tìm kiếm (mặc định true). */
  showSearch?: boolean;
  /** Placeholder ô tìm kiếm. */
  searchPlaceholder?: string;
  /** Các filter dạng dropdown, hiển thị theo đúng thứ tự khai báo. */
  filters?: SelectFilter[];
  /** Bật lọc ngày: drop-down mốc nhanh (hôm nay/hôm qua/tuần này/tháng này) + "Tùy chọn ngày" để chọn Từ/Đến. */
  showDateRange?: boolean;
  /** Nhãn cho nhóm ngày trong sheet (mặc định "Ngày tạo"). */
  dateLabel?: string;
  /** Tiêu đề sheet (mặc định "Lọc danh sách"). */
  title?: string;
  /**
   * Giá trị hiện tại từ searchParams (để đồng bộ lại khi URL thay đổi).
   * Bao gồm `q`, `from`, `to` và mỗi `param` của `filters`. Giá trị trống dùng "".
   */
  initial?: Record<string, string | undefined>;
}

/**
 * Form tìm kiếm + bộ lọc dùng chung cho các trang danh sách của repo.
 * - Desktop (md+): hiển thị đầy đủ bộ lọc inline.
 * - Mobile: chỉ hiện ô tìm kiếm + nút "Lọc"; bấm "Lọc" mở bottom sheet chứa bộ lọc.
 */
export function ListFilters({
  basePath,
  showSearch = true,
  searchPlaceholder = "Tìm kiếm…",
  filters = [],
  showDateRange = false,
  dateLabel = "Ngày tạo",
  title = "Lọc danh sách",
  initial = {},
}: ListFiltersProps) {
  const router = useRouter();

  const [q, setQ] = useState(initial.q ?? "");
  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState(initial.to ?? "");
  const [datePreset, setDatePreset] = useState<DatePreset | "" | "custom">(() =>
    presetValueFor(initial.from ?? "", initial.to ?? ""),
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of filters) v[f.param] = initial[f.param] ?? "";
    return v;
  });
  const [open, setOpen] = useState(false);

  // Lưu các tham số bổ sung trong URL (ví dụ `tab=reports`) để không bị mất khi lọc/xóa lọc.
  const filterParamSet = new Set(filters.map((f) => f.param));
  const extraParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(initial)) {
    if (k !== "q" && k !== "from" && k !== "to" && !filterParamSet.has(k) && v != null && v !== "") {
      extraParams[k] = v;
    }
  }

  // Đồng bộ state khi URL thay đổi (điều hướng, back/forward).
  const initialKey = JSON.stringify(initial);
  useEffect(() => {
    setQ(initial.q ?? "");
    setFrom(initial.from ?? "");
    setTo(initial.to ?? "");
    setDatePreset(presetValueFor(initial.from ?? "", initial.to ?? ""));
    const v: Record<string, string> = {};
    for (const f of filters) v[f.param] = initial[f.param] ?? "";
    setValues(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  const hasFilter =
    (showSearch && Boolean(q.trim())) ||
    Object.values(values).some(Boolean) ||
    Boolean(from || to);

  function setValue(param: string, value: string) {
    setValues((prev) => ({ ...prev, [param]: value }));
  }

  function onDatePresetChange(value: DatePreset | "" | "custom") {
    setDatePreset(value);
    if (value === "") {
      setFrom("");
      setTo("");
    } else if (value !== "custom") {
      const r = presetRanges()[value];
      setFrom(r.from);
      setTo(r.to);
    }
  }

  function buildQuery(): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) params.set(k, v);
    }
    if (showSearch && q.trim()) params.set("q", q.trim());
    for (const f of filters) {
      const v = values[f.param];
      if (v) params.set(f.param, v);
    }
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const s = params.toString();
    return s ? `${basePath}?${s}` : basePath;
  }

  function apply() {
    router.push(buildQuery());
    setOpen(false);
  }

  function reset() {
    setQ("");
    setFrom("");
    setTo("");
    setDatePreset("");
    const v: Record<string, string> = {};
    for (const f of filters) v[f.param] = "";
    setValues(v);

    const params = new URLSearchParams();
    for (const [k, val] of Object.entries(extraParams)) {
      if (val) params.set(k, val);
    }
    const s = params.toString();
    router.push(s ? `${basePath}?${s}` : basePath);
    setOpen(false);
  }

  function renderDateOptions() {
    return DATE_RANGE_OPTIONS.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ));
  }

  function renderSelect(f: SelectFilter, fullWidth: boolean) {
    return (
      <select
        value={values[f.param] ?? ""}
        onChange={(e) => setValue(f.param, e.target.value)}
        className={cn(SELECT_CLS, fullWidth && "w-full")}
      >
        <option value="">{f.allLabel ?? "Tất cả"}</option>
        {f.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <>
      {/* Desktop: đầy đủ bộ lọc inline */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        className="hidden flex-wrap items-center gap-2 md:flex"
      >
        {showSearch && (
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-[200px] max-w-xs"
          />
        )}
        {filters.map((f) => (
          <span key={f.param}>{renderSelect(f, false)}</span>
        ))}
        {showDateRange && (
          <span className="flex items-center gap-1.5">
            <select
              value={datePreset}
              onChange={(e) =>
                onDatePresetChange(e.target.value as DatePreset | "" | "custom")
              }
              aria-label={dateLabel}
              className={SELECT_CLS}
            >
              {renderDateOptions()}
            </select>
            {datePreset === "custom" && (
              <>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-auto"
                  aria-label="Từ ngày"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-auto"
                  aria-label="Đến ngày"
                />
              </>
            )}
          </span>
        )}
        <Button type="submit">Lọc</Button>
        {hasFilter && (
          <Button type="button" variant="ghost" onClick={reset}>
            Xóa lọc
          </Button>
        )}
      </form>

      {/* Mobile: chỉ ô tìm kiếm + nút Lọc (hoặc chỉ nút Lọc nếu tắt tìm kiếm) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        className="flex gap-2 md:hidden"
      >
        {showSearch && (
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1"
          />
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className={!showSearch ? "w-full justify-center" : undefined}
        >
          <SlidersHorizontal className="size-4" />
          Lọc
        </Button>
      </form>

      {/* Mobile: bottom sheet chứa bộ lọc */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="border-b">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 px-4">
            {filters.map((f) => (
              <label key={f.param} className="block space-y-1.5">
                <span className="text-sm text-muted-foreground">{f.label}</span>
                {renderSelect(f, true)}
              </label>
            ))}
            {showDateRange && (
              <div>
                <span className="mb-1.5 block text-sm text-muted-foreground">
                  {dateLabel}
                </span>
                <select
                  value={datePreset}
                  onChange={(e) =>
                    onDatePresetChange(
                      e.target.value as DatePreset | "" | "custom",
                    )
                  }
                  className={cn(SELECT_CLS, "w-full")}
                >
                  {renderDateOptions()}
                </select>
                {datePreset === "custom" && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">
                        Từ ngày
                      </span>
                      <Input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">
                        Đến ngày
                      </span>
                      <Input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t p-4">
            <Button className="flex-1" onClick={apply}>
              Áp dụng
            </Button>
            {hasFilter && (
              <Button variant="outline" onClick={reset}>
                Xóa lọc
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
