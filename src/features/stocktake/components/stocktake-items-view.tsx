"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, UnfoldVertical } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { StocktakeItemView } from "../types";
import { postStocktake, toggleStocktakeItemChecked } from "../actions";
import { groupByProduct, paginateGroups, type CheckFilter } from "../lib/grouping";
import { StocktakeFilterBar } from "./stocktake-filter-bar";
import { StocktakeImageViewer } from "./stocktake-image-viewer";
import { StocktakePager } from "./stocktake-pager";

const PAGE_SIZE = 20;
/** Giá trị đại diện "vật tư chưa phân danh mục" khi lọc. */
const NO_CATEGORY = "__none__";

function variantLabelText(item: StocktakeItemView): string {
  if (item.attributes && typeof item.attributes === "object" && !Array.isArray(item.attributes)) {
    const values = Object.values(item.attributes as Record<string, unknown>).filter(
      (v) => typeof v === "string" && v.length > 0,
    );
    if (values.length > 0) return values.join(" · ");
  }
  return item.unit ?? "—";
}

/**
 * Danh sách vật tư của một phiếu kiểm kê, GOM THEO VẬT TƯ CHÍNH (product):
 * mỗi product là một nhóm có thẻ ảnh + tên; bấm vào mở/đóng danh sách biến thể.
 * - mode "entry": phiếu draft — tick đã kiểm, nhập số thực tế + ghi chú, Chốt kiểm kê.
 * - mode "view": phiếu đã chốt (posted) — chỉ hiện dòng đã kiểm, đọc-only.
 * Cả 2 chế độ: ô tìm kiếm, lọc danh mục, lọc trạng thái, phân trang, bấm ảnh phóng to.
 */
export function StocktakeItemsView({
  mode,
  sessionId,
  items,
  onDone,
}: {
  mode: "entry" | "view";
  /** Chỉ dùng khi mode="entry". */
  sessionId?: string;
  items: StocktakeItemView[];
  /** Gọi khi chốt xong (mode="entry") để đóng bảng. */
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [filter, setFilter] = useState<CheckFilter>("all");
  const [page, setPage] = useState(1);
  /**
   * Nhóm đang MỞ RỘNG. MẶC ĐỊNH THU GỌN HẾT ở CẢ 2 bảng (nhập & đã chốt):
   * chỉ khi bấm vào thẻ vật tư chính thì danh sách biến thể mới xổ ra.
   * Nút "Mở rộng tất cả" ở dòng thống kê để xổ hết khi cần.
   */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  /** Chỉ mode="entry": ghi đè checked đã tick (UI đổi ngay; server là nguồn sau revalidate). */
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const isEntry = mode === "entry";
  // Entry ghi đè checked từ map; view lọc chỉ dòng đã kiểm.
  const working: StocktakeItemView[] = useMemo(() => {
    if (isEntry) {
      return items.map((i) => ({ ...i, checked: checkedMap[i.id] ?? i.checked }));
    }
    return items.filter((i) => i.checked);
  }, [isEntry, items, checkedMap]);

  // Tuỳ chọn danh mục: view chỉ lấy các danh mục của dòng đã kiểm; entry lấy của toàn phiếu.
  const categorySource = useMemo(
    () => (isEntry ? items : items.filter((i) => i.checked)),
    [isEntry, items],
  );
  const categoryOptions = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const it of categorySource) {
      const v = it.categoryName ?? NO_CATEGORY;
      if (!seen.has(v)) {
        seen.add(v);
        names.push(v);
      }
    }
    const sorted = [...names].sort((a, b) =>
      (a === NO_CATEGORY ? "~" : a).localeCompare(b === NO_CATEGORY ? "~" : b, "vi"),
    );
    return [{ value: "", label: "Tất cả danh mục" }, ...sorted.map((v) => ({
      value: v,
      label: v === NO_CATEGORY ? "(Chưa phân danh mục)" : v,
    }))];
  }, [categorySource]);

  // Bước 1: lọc theo danh mục để tính số liệu cho từng nút lọc.
  const byCategory = useMemo(() => {
    if (!category) return working;
    return working.filter((it) => (it.categoryName ?? NO_CATEGORY) === category);
  }, [working, category]);

  const counts = useMemo(() => {
    const checked = byCategory.filter((i) => i.checked).length;
    const diff = byCategory.filter(
      (i) => ((Number(quantities[i.id] ?? i.actualQty) || 0) - i.systemQty) !== 0,
    ).length;
    return {
      all: byCategory.length,
      checked,
      unchecked: byCategory.length - checked,
      diff,
    };
  }, [byCategory, quantities]);

  // Bước 2: lọc theo từ khoá + nút lọc trạng thái.
  const visible = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return byCategory.filter((it) => {
      if (filter === "checked" && !it.checked) return false;
      if (filter === "unchecked" && it.checked) return false;
      if (filter === "diff") {
        const diff = (Number(quantities[it.id] ?? it.actualQty) || 0) - it.systemQty;
        if (diff === 0) return false;
      }
      if (!kw) return true;
      const hay = [it.productName, variantLabelText(it), it.unit, it.categoryName ?? ""]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(kw);
    });
  }, [byCategory, q, filter, quantities]);

  const groups = useMemo(() => groupByProduct(visible), [visible]);
  const pages = useMemo(() => paginateGroups(groups, PAGE_SIZE), [groups]);
  const totalPages = Math.max(1, pages.length);
  const currentPage = Math.min(page, totalPages);
  const pageGroups = pages[currentPage - 1] ?? [];
  /** Đang lọc (tìm kiếm / danh mục / trạng thái) → tự xổ các nhóm khớp để thấy biến thể. */
  const narrowing = q.trim() !== "" || filter !== "all" || category !== "";
  const allExpanded = groups.length > 0 && groups.every((g) => expandedIds.has(g.productId));

  function changeQuery(value: string) {
    setQ(value);
    setPage(1);
  }
  function changeFilter(value: CheckFilter) {
    setFilter(value);
    setPage(1);
  }
  function toggleGroup(productId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }
  function toggleAll() {
    if (allExpanded) setExpandedIds(new Set());
    else setExpandedIds(new Set(groups.map((g) => g.productId)));
  }

  function setChecked(item: StocktakeItemView, next: boolean) {
    setCheckedMap((prev) => ({ ...prev, [item.id]: next }));
    startTransition(async () => {
      try {
        await toggleStocktakeItemChecked(item.id, next);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Cập nhật trạng thái thất bại");
        setCheckedMap((prev) => ({ ...prev, [item.id]: !next }));
      }
    });
  }

  function chot() {
    if (!sessionId) return;
    const base = items.map((i) => ({ ...i, checked: checkedMap[i.id] ?? i.checked }));
    const checkedRows = base.filter((i) => i.checked);
    const unchecked = base.length - checkedRows.length;
    const ok =
      unchecked === 0 ||
      window.confirm(
        `Còn ${unchecked} dòng chưa đánh dấu đã kiểm — các dòng này sẽ bị BỎ QUA (không điều chỉnh tồn kho). Vẫn chốt phiếu?`,
      );
    if (!ok) return;
    startTransition(async () => {
      try {
        await postStocktake(
          sessionId,
          checkedRows.map((i) => ({
            itemId: i.id,
            actualQty: Number(quantities[i.id] ?? i.actualQty) || 0,
            notes: noteDrafts[i.id] ?? i.notes,
          })),
        );
        toast.success("Đã chốt kiểm kê");
        onDone?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  const filterOptions: CheckFilter[] = isEntry
    ? ["all", "checked", "unchecked", "diff"]
    : ["all", "diff"];

  return (
    <div className="space-y-3">
      <StocktakeFilterBar
        query={q}
        onQuery={changeQuery}
        filter={filter}
        onFilter={changeFilter}
        counts={counts}
        options={filterOptions}
        categories={categoryOptions.length > 2 ? categoryOptions : undefined}
        category={category}
        onCategoryChange={(v) => {
          setCategory(v);
          setPage(1);
        }}
      />

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {isEntry ? (
            <>
              Đã kiểm <b className="text-foreground">{counts.checked}</b>/{counts.all} dòng
              {counts.unchecked > 0 && (
                <span className="ml-2 text-amber-600">Còn {counts.unchecked} dòng chưa kiểm (sẽ bỏ qua khi chốt)</span>
              )}
            </>
          ) : (
            <>
              <b className="text-foreground">{counts.all}</b> dòng đã kiểm
              {counts.diff > 0 && <span className="ml-2 text-amber-600">trong đó {counts.diff} dòng lệch</span>}
            </>
          )}
        </span>
        {groups.length > 1 && !narrowing && (
          <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs" onClick={toggleAll}>
            <UnfoldVertical className="size-3.5" aria-hidden />
            {allExpanded ? "Thu gọn tất cả" : "Mở rộng tất cả"}
          </Button>
        )}
      </div>

      {pageGroups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Không có vật tư khớp.</p>
      ) : (
        <div className="space-y-3">
          {pageGroups.map((group) => {
            // Đang lọc thì xổ sẵn các nhóm có dòng khớp để thấy biến thể; không lọc thì bấm mới xổ.
            const isExpanded = narrowing || expandedIds.has(group.productId);
            return (
              <div key={group.productId} className="overflow-hidden rounded-lg border">
                {/* Thẻ vật tư chính */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => toggleGroup(group.productId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleGroup(group.productId);
                    }
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 bg-muted/30 px-3 py-2.5 text-left hover:bg-accent/60"
                >
                  <StocktakeImageViewer images={group.images} name={group.productName} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{group.productName}</span>
                      {group.categoryName && (
                        <Badge variant="info" className="text-[10px]">
                          {group.categoryName}
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {group.variants.length} biến thể
                      {group.description ? ` · ${group.description}` : ""}
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      !isExpanded && "-rotate-90",
                    )}
                    aria-hidden
                  />
                </div>

                {isExpanded && (
                  /* Biến thể THỤT VÀO dưới vật tư chính (vẽ đường lề trái cho rõ là cấp con) */
                  <div className="ml-3 divide-y border-l-2 border-muted/60 py-0.5 pl-1 pr-1 sm:ml-4 sm:pl-2">
                    {group.variants.map((item) => {
                      const val = quantities[item.id] ?? String(item.actualQty);
                      const diff = (Number(val) || 0) - item.systemQty;
                      const diffCls =
                        diff === 0
                          ? "text-muted-foreground"
                          : diff > 0
                            ? "text-emerald-600"
                            : "text-red-600";
                      return (
                        <div key={item.id} className={cn("px-3 py-2", !item.checked && isEntry && "bg-muted/20")}>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            {/* Đã kiểm */}
                            {isEntry ? (
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={item.checked}
                                onClick={() => setChecked(item, !item.checked)}
                                title={item.checked ? "Bỏ đánh dấu đã kiểm" : "Đánh dấu đã kiểm"}
                                className={cn(
                                  "flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                                  item.checked
                                    ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "border-input text-transparent hover:bg-accent",
                                )}
                              >
                                <Check className="size-4" aria-hidden />
                              </button>
                            ) : null}

                            {/* Biến thể */}
                            <StocktakeImageViewer
                              images={item.variantImages.length > 0 ? item.variantImages : item.productImages}
                              name={`${item.productName} — ${variantLabelText(item)}`}
                              className="size-10"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{variantLabelText(item)}</div>
                              {item.unit && <div className="text-xs text-muted-foreground">ĐVT: {item.unit}</div>}
                            </div>

                            <div className="flex shrink-0 flex-col items-end text-sm">
                              <span className="text-muted-foreground">Hệ thống</span>
                              <span className="tabular-nums">{item.systemQty}</span>
                            </div>

                            {isEntry ? (
                              <div className="flex shrink-0 flex-col items-end">
                                <span className="text-xs text-muted-foreground">Thực tế</span>
                                <Input
                                  type="number"
                                  min="0"
                                  className="h-8 w-24"
                                  value={val}
                                  onChange={(e) =>
                                    setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))
                                  }
                                />
                              </div>
                            ) : (
                              <div className="flex shrink-0 flex-col items-end text-sm">
                                <span className="text-muted-foreground">Thực tế</span>
                                <span className="font-medium tabular-nums">{item.actualQty}</span>
                              </div>
                            )}

                            <div className="flex shrink-0 flex-col items-end text-sm">
                              <span className="text-muted-foreground">Lệch</span>
                              <span className={cn("font-medium tabular-nums", diffCls)}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            </div>
                          </div>

                          {/* Ghi chú */}
                          {isEntry ? (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="w-16 shrink-0 text-xs text-muted-foreground">Ghi chú</span>
                              <Input
                                value={noteDrafts[item.id] ?? item.notes ?? ""}
                                placeholder="Ghi chú dòng này (nếu có)…"
                                onChange={(e) =>
                                  setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                                }
                                className="h-8 flex-1"
                              />
                            </div>
                          ) : item.notes ? (
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              <span className="font-medium">Ghi chú:</span> {item.notes}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <StocktakePager page={currentPage} totalPages={totalPages} onPage={setPage} />

      {isEntry && (
        <div className="flex items-center justify-end">
          <Button onClick={chot} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Chốt kiểm kê
          </Button>
        </div>
      )}
    </div>
  );
}
