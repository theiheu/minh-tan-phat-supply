"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  ArrowDownToLine,
  ArrowUpFromLine,
  Layers,
  Search,
  FileText,
  Package,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SlipCodeButton } from "@/components/slip-code-button";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StockCardData } from "../types";
import type { StockLocationOption } from "./report-date-filters";

export interface StockVariantOption {
  id: string;
  productName?: string;
  name?: string;
  variantLabel?: string;
  label?: string;
  unit?: string;
  sku?: string | null;
}

export interface StockCardTabProps {
  variants?: StockVariantOption[];
  locations?: StockLocationOption[];
  data?: StockCardData | null;
  onSelectVariant: (variantId: string) => void;
  selectedVariantId?: string;
  isLoading?: boolean;
}

/**
 * Format variant option label: "Tên sản phẩm - Tên biến thể (ĐVT)"
 */
export function formatVariantOptionLabel(v: StockVariantOption): string {
  const name = v.productName || v.name || v.label || "Vật tư";
  const label = v.variantLabel || (v.productName && v.label ? v.label : "");
  const unit = v.unit;

  const parts: string[] = [name];
  if (label && label !== name) {
    parts.push(label);
  }
  const mainStr = parts.join(" - ");
  return unit ? `${mainStr} (${unit})` : mainStr;
}

export function getMovementBadgeVariant(movementType: string, inQty: number): {
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
} {
  const isIncoming = inQty > 0 || movementType.endsWith("_in") || movementType === "receipt";
  if (isIncoming) {
    return {
      variant: "secondary",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 font-medium",
    };
  }
  if (
    movementType.includes("defect") ||
    movementType.includes("liquidation") ||
    movementType === "repair_out"
  ) {
    return {
      variant: "destructive",
      className:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-400 font-medium",
    };
  }
  if (movementType.includes("repair") || movementType.includes("borrow") || movementType.includes("tool")) {
    return {
      variant: "secondary",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400 font-medium",
    };
  }
  return {
    variant: "secondary",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400 font-medium",
  };
}

export function StockCardTab({
  variants = [],
  data = null,
  onSelectVariant,
  selectedVariantId = "",
  isLoading = false,
}: StockCardTabProps) {
  const [variantSearch, setVariantSearch] = useState("");
  const [entrySearch, setEntrySearch] = useState("");

  // Filter variants list for selector
  const filteredVariants = useMemo(() => {
    const term = variantSearch.trim().toLowerCase();
    if (!term) return variants;

    return variants.filter((v) => {
      const name = (v.productName || v.name || v.label || "").toLowerCase();
      const label = (v.variantLabel || "").toLowerCase();
      const sku = (v.sku || "").toLowerCase();
      const unit = (v.unit || "").toLowerCase();
      return (
        name.includes(term) ||
        label.includes(term) ||
        sku.includes(term) ||
        unit.includes(term)
      );
    });
  }, [variants, variantSearch]);

  // Filter ledger entries by search term
  const filteredEntries = useMemo(() => {
    if (!data?.entries) return [];
    const term = entrySearch.trim().toLowerCase();
    if (!term) return data.entries;

    return data.entries.filter((entry) => {
      const code = (entry.refCode || "").toLowerCase();
      const label = (entry.movementLabel || "").toLowerCase();
      const notes = (entry.notes || "").toLowerCase();
      const actor = (entry.actorName || "").toLowerCase();
      return (
        code.includes(term) ||
        label.includes(term) ||
        notes.includes(term) ||
        actor.includes(term)
      );
    });
  }, [data?.entries, entrySearch]);

  const hasSelectedVariant = Boolean(selectedVariantId || data);

  return (
    <div className="space-y-6">
      {/* 1. Variant Selector Bar */}
      <Card className="p-4 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Chọn vật tư xem thẻ kho
              </h2>
              <p className="text-xs text-muted-foreground">
                Tra cứu lịch sử biến động nhập, xuất và tồn lũy kế theo từng mặt hàng
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Quick search input to filter variant dropdown */}
            <div className="relative min-w-[200px]">
              <Search
                className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="text"
                placeholder="Lọc vật tư…"
                aria-label="Tìm kiếm vật tư"
                value={variantSearch}
                onChange={(e) => setVariantSearch(e.target.value)}
                className="h-9 pl-8 text-xs"
              />
            </div>

            {/* Variant Select element */}
            <select
              aria-label="Chọn vật tư"
              value={selectedVariantId}
              onChange={(e) => onSelectVariant(e.target.value)}
              className="h-9 min-w-[260px] max-w-full rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50"
            >
              <option value="">-- Chọn vật tư / biến thể --</option>
              {filteredVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatVariantOptionLabel(v)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* 2. Empty state when no variant selected */}
      {!hasSelectedVariant && !isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center bg-card">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen className="size-7" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Vui lòng chọn một vật tư để xem sổ thẻ kho
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">
            Chọn một vật tư trong danh sách ở trên để theo dõi biến động nhập, xuất và tồn lũy kế theo thời gian.
          </p>
        </div>
      )}

      {/* 3. Stock Summary Cards & Detailed Ledger */}
      {(hasSelectedVariant || isLoading) && (
        <>
          {/* Top 4 Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Tồn đầu kỳ */}
            <Card className="p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tồn đầu kỳ
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <BookOpen className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold tracking-tight text-foreground">
                      {formatNumber(data?.openingStock ?? 0)}
                    </span>
                    {data?.unit && (
                      <span className="text-xs text-muted-foreground">
                        {data.unit}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Card 2: Tổng nhập trong kỳ */}
            <Card className="p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tổng nhập trong kỳ
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <ArrowDownToLine className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                      +{formatNumber(data?.totalIn ?? 0)}
                    </span>
                    {data?.unit && (
                      <span className="text-xs text-muted-foreground">
                        {data.unit}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Card 3: Tổng xuất trong kỳ */}
            <Card className="p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tổng xuất trong kỳ
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                  <ArrowUpFromLine className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                      -{formatNumber(data?.totalOut ?? 0)}
                    </span>
                    {data?.unit && (
                      <span className="text-xs text-muted-foreground">
                        {data.unit}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Card 4: Tồn cuối kỳ */}
            <Card className="p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tồn cuối kỳ
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold tracking-tight text-primary">
                      {formatNumber(data?.closingStock ?? 0)}
                    </span>
                    {data?.unit && (
                      <span className="text-xs font-semibold text-primary">
                        {data.unit}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Detailed Movement Ledger Table */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Sổ chi tiết phát sinh trong kỳ
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {data ? (
                      <>
                        <span className="font-semibold text-foreground">
                          {data.productName}
                        </span>
                        {data.variantLabel && (
                          <span className="text-muted-foreground">
                            {" "}
                            — {data.variantLabel}
                          </span>
                        )}
                        {data.unit && (
                          <span className="text-muted-foreground">
                            {" "}
                            ({data.unit})
                          </span>
                        )}
                        {data.locationName && (
                          <span className="text-muted-foreground">
                            {" "}
                            · Kho: {data.locationName}
                          </span>
                        )}
                      </>
                    ) : (
                      "Danh sách chứng từ và dòng nhật ký xuất nhập tồn"
                    )}
                  </CardDescription>
                </div>

                {/* Ledger search filter */}
                <div className="relative w-full sm:w-64">
                  <Search
                    className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="text"
                    placeholder="Tìm mã phiếu, loại, ghi chú…"
                    aria-label="Tìm kiếm giao dịch trong thẻ kho"
                    value={entrySearch}
                    onChange={(e) => setEntrySearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[140px] text-xs font-semibold">
                        Ngày giờ phát sinh
                      </TableHead>
                      <TableHead className="w-[140px] text-xs font-semibold">
                        Mã chứng từ
                      </TableHead>
                      <TableHead className="w-[150px] text-xs font-semibold">
                        Loại phát sinh
                      </TableHead>
                      <TableHead className="min-w-[180px] text-xs font-semibold">
                        Diễn giải / Ghi chú
                      </TableHead>
                      <TableHead className="w-[120px] text-right text-xs font-semibold">
                        Số lượng Nhập (+)
                      </TableHead>
                      <TableHead className="w-[120px] text-right text-xs font-semibold">
                        Số lượng Xuất (-)
                      </TableHead>
                      <TableHead className="w-[120px] text-right text-xs font-semibold">
                        Tồn lũy kế
                      </TableHead>
                      <TableHead className="w-[140px] text-xs font-semibold">
                        Người thực hiện
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 4 }).map((_, idx) => (
                        <TableRow key={`skeleton-row-${idx}`}>
                          <TableCell>
                            <Skeleton className="h-4 w-28" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-24 rounded-md" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-40" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-4 w-12" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-4 w-12" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-4 w-12" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : !data || data.entries.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-32 text-center text-xs text-muted-foreground"
                        >
                          <FileText className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                          Chưa có phát sinh nhập/xuất nào cho vật tư này trong kỳ đã chọn.
                        </TableCell>
                      </TableRow>
                    ) : filteredEntries.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-32 text-center text-xs text-muted-foreground"
                        >
                          {`Không tìm thấy giao dịch nào khớp với từ khóa "${entrySearch}".`}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEntries.map((entry) => {
                        const badgeStyle = getMovementBadgeVariant(
                          entry.movementType,
                          entry.inQty
                        );
                        return (
                          <TableRow key={entry.id} className="text-xs">
                            {/* 1. Ngày giờ */}
                            <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                              {formatDateTime(entry.createdAt)}
                            </TableCell>

                            {/* 2. Mã chứng từ */}
                            <TableCell className="font-medium whitespace-nowrap">
                              {entry.refType && entry.refCode ? (
                                <SlipCodeButton
                                  type={entry.refType}
                                  id={entry.refCode}
                                  code={entry.refCode}
                                />
                              ) : entry.refCode ? (
                                <span className="font-mono text-xs font-semibold text-foreground">
                                  {entry.refCode}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            {/* 3. Loại phát sinh */}
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={badgeStyle.variant}
                                className={cn("text-[11px]", badgeStyle.className)}
                              >
                                {entry.movementLabel}
                              </Badge>
                            </TableCell>

                            {/* 4. Ghi chú / Diễn giải */}
                            <TableCell className="max-w-[240px] truncate text-muted-foreground">
                              {entry.notes || "—"}
                            </TableCell>

                            {/* 5. Nhập (+) */}
                            <TableCell className="text-right font-medium whitespace-nowrap">
                              {entry.inQty > 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  +{formatNumber(entry.inQty)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            {/* 6. Xuất (-) */}
                            <TableCell className="text-right font-medium whitespace-nowrap">
                              {entry.outQty > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                  -{formatNumber(entry.outQty)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            {/* 7. Tồn lũy kế */}
                            <TableCell className="text-right font-bold text-foreground whitespace-nowrap">
                              {formatNumber(entry.runningBalance)}
                            </TableCell>

                            {/* 8. Người thực hiện */}
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {entry.actorName || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>

                  {!isLoading && data && filteredEntries.length > 0 && (
                    <TableFooter className="bg-muted/50 font-medium">
                      <TableRow className="text-xs">
                        <TableCell colSpan={4} className="font-semibold text-foreground">
                          Tổng cộng phát sinh trong kỳ ({filteredEntries.length} giao dịch)
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          +{formatNumber(data.totalIn)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          -{formatNumber(data.totalOut)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary whitespace-nowrap">
                          {formatNumber(data.closingStock)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
