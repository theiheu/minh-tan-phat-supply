"use client";

import { useMemo, useState } from "react";
import {
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Filter,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GeneralReportData } from "../types";

export interface XntReportTabProps {
  data: GeneralReportData | null;
  isLoading?: boolean;
}

export function XntReportTab({ data, isLoading = false }: XntReportTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Count items with inventory changes (chênh lệch/phát sinh nhập xuất)
  const changedCount = useMemo(() => {
    return (data?.stockLedger ?? []).filter(
      (row) => row.inQty > 0 || row.outQty > 0 || row.openingQty !== row.closingQty
    ).length;
  }, [data?.stockLedger]);

  // Filter stock ledger by search keyword & onlyChanged toggle
  const filteredLedger = useMemo(() => {
    let list = data?.stockLedger ?? [];

    if (onlyChanged) {
      list = list.filter(
        (row) => row.inQty > 0 || row.outQty > 0 || row.openingQty !== row.closingQty
      );
    }

    const term = searchTerm.trim().toLowerCase();
    if (!term) return list;

    return list.filter(
      (row) =>
        row.productName.toLowerCase().includes(term) ||
        row.variantLabel.toLowerCase().includes(term) ||
        row.categoryName.toLowerCase().includes(term)
    );
  }, [data?.stockLedger, onlyChanged, searchTerm]);

  // Reset page when search term or page size changes
  const totalPages = Math.max(1, Math.ceil(filteredLedger.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  // Paginated slice
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLedger.slice(start, start + pageSize);
  }, [filteredLedger, currentPage, pageSize]);

  // Totals for the entire filtered dataset
  const totals = useMemo(() => {
    return filteredLedger.reduce(
      (acc, row) => {
        acc.openingQty += row.openingQty;
        acc.inQty += row.inQty;
        acc.outQty += row.outQty;
        acc.closingQty += row.closingQty;
        acc.closingValue += row.closingValue;
        return acc;
      },
      {
        openingQty: 0,
        inQty: 0,
        outQty: 0,
        closingQty: 0,
        closingValue: 0,
      }
    );
  }, [filteredLedger]);

  return (
    <div className="space-y-6">
      {/* 1. Summary Quick Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Tổng số mặt hàng */}
        <Card className="p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tổng số mặt hàng</span>
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Boxes className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold tracking-tight text-foreground">
            {isLoading ? <Skeleton className="h-6 w-20" /> : `${filteredLedger.length} vật tư`}
          </div>
        </Card>

        {/* Card 2: Tổng nhập trong kỳ */}
        <Card className="p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tổng nhập trong kỳ</span>
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <ArrowDownToLine className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {isLoading ? <Skeleton className="h-6 w-24" /> : `+${formatNumber(totals.inQty)}`}
          </div>
        </Card>

        {/* Card 3: Tổng xuất trong kỳ */}
        <Card className="p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tổng xuất trong kỳ</span>
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <ArrowUpFromLine className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {isLoading ? <Skeleton className="h-6 w-24" /> : `-${formatNumber(totals.outQty)}`}
          </div>
        </Card>

        {/* Card 4: Tổng giá trị tồn cuối */}
        <Card className="p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tổng giá trị tồn cuối</span>
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DollarSign className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold tracking-tight text-primary">
            {isLoading ? <Skeleton className="h-6 w-32" /> : formatVnd(totals.closingValue)}
          </div>
        </Card>
      </div>

      {/* 2. Main Stock Ledger (XNT) Table Card */}
      <Card className="shadow-xs">
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Báo cáo Xuất - Nhập - Tồn Kho
            </CardTitle>
            <CardDescription className="text-xs">
              Tổng hợp số lượng đầu kỳ, phát sinh nhập/xuất và giá trị tồn cuối kỳ của từng vật tư
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Toggle only items with changes / variance */}
            <Button
              type="button"
              variant={onlyChanged ? "default" : "outline"}
              size="sm"
              aria-pressed={onlyChanged}
              onClick={() => {
                setOnlyChanged((prev) => !prev);
                setPage(1);
              }}
              className={cn(
                "h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer transition-colors",
                onlyChanged
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Filter className="size-3.5" aria-hidden="true" />
              <span>Chênh lệch</span>
              <Badge
                variant={onlyChanged ? "secondary" : "outline"}
                className={cn(
                  "ml-1 px-1.5 py-0 text-[10px] font-bold",
                  onlyChanged && "bg-primary-foreground/20 text-primary-foreground"
                )}
              >
                {changedCount}
              </Badge>
            </Button>

            {/* Search filter */}
            <div className="relative w-full sm:w-60">
              <Search
                className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="text"
                placeholder="Tìm theo tên, biến thể, danh mục…"
                aria-label="Tìm kiếm vật tư"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {/* Page size select */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="hidden sm:inline">Hiển thị:</span>
              <select
                aria-label="Số dòng mỗi trang"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground shadow-2xs outline-none focus-visible:border-ring focus-visible:ring-[2px]"
              >
                <option value={15}>15 dòng</option>
                <option value={20}>20 dòng</option>
                <option value={50}>50 dòng</option>
                <option value={100}>100 dòng</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/40">
                  <TableHead className="min-w-[220px] font-semibold text-xs">Tên vật tư & Biến thể</TableHead>
                  <TableHead className="w-20 text-center font-semibold text-xs">ĐVT</TableHead>
                  <TableHead className="min-w-[130px] font-semibold text-xs">Danh mục</TableHead>
                  <TableHead className="text-right font-semibold text-xs whitespace-nowrap">Tồn đầu</TableHead>
                  <TableHead className="text-right font-semibold text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    Nhập (+)
                  </TableHead>
                  <TableHead className="text-right font-semibold text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    Xuất (-)
                  </TableHead>
                  <TableHead className="text-right font-semibold text-xs font-bold text-foreground whitespace-nowrap">
                    Tồn cuối
                  </TableHead>
                  <TableHead className="text-right font-semibold text-xs whitespace-nowrap">Đơn giá</TableHead>
                  <TableHead className="text-right font-semibold text-xs font-bold text-primary whitespace-nowrap">
                    Giá trị tồn cuối
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="mx-auto h-4 w-10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-xs text-muted-foreground">
                      {searchTerm
                        ? `Không tìm thấy vật tư nào khớp với từ khóa "${searchTerm}".`
                        : "Chưa có dữ liệu xuất nhập tồn cho khoảng thời gian này."}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRows.map((row) => {
                    const isOutOfStock = row.closingQty <= 0;
                    return (
                      <TableRow
                        key={row.variantId}
                        className={cn(
                          "text-xs transition-colors",
                          isOutOfStock && "bg-destructive/5 hover:bg-destructive/10"
                        )}
                      >
                        {/* 1. Tên vật tư & Biến thể */}
                        <TableCell className="font-medium text-foreground">
                          <div className="flex flex-col">
                            <span className="font-semibold">{row.productName}</span>
                            {row.variantLabel && (
                              <span className="text-[11px] text-muted-foreground">
                                {row.variantLabel}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 2. ĐVT */}
                        <TableCell className="text-center text-muted-foreground">
                          {row.unit || "—"}
                        </TableCell>

                        {/* 3. Danh mục */}
                        <TableCell className="text-muted-foreground">
                          {row.categoryName || "Chưa phân loại"}
                        </TableCell>

                        {/* 4. Tồn đầu */}
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {formatNumber(row.openingQty)}
                        </TableCell>

                        {/* 5. Nhập (+) */}
                        <TableCell className="text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                          {row.inQty > 0 ? `+${formatNumber(row.inQty)}` : "0"}
                        </TableCell>

                        {/* 6. Xuất (-) */}
                        <TableCell className="text-right font-mono tabular-nums text-amber-600 dark:text-amber-400 font-medium">
                          {row.outQty > 0 ? `-${formatNumber(row.outQty)}` : "0"}
                        </TableCell>

                        {/* 7. Tồn cuối */}
                        <TableCell className="text-right font-mono tabular-nums">
                          <span
                            className={cn(
                              "font-bold",
                              isOutOfStock
                                ? "text-destructive"
                                : "text-foreground"
                            )}
                          >
                            {formatNumber(row.closingQty)}
                          </span>
                          {isOutOfStock && (
                            <Badge
                              variant="destructive"
                              className="ml-1.5 px-1 py-0 text-[10px] font-normal"
                            >
                              Hết hàng
                            </Badge>
                          )}
                        </TableCell>

                        {/* 8. Đơn giá */}
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {row.unitPrice > 0 ? formatVnd(row.unitPrice) : "—"}
                        </TableCell>

                        {/* 9. Giá trị tồn cuối */}
                        <TableCell className="text-right font-mono tabular-nums font-semibold text-primary">
                          {formatVnd(row.closingValue)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>

              {/* Table Footer: Total summary row */}
              {!isLoading && filteredLedger.length > 0 && (
                <TableFooter className="bg-muted/60 font-semibold text-xs border-t-2">
                  <TableRow>
                    <TableCell colSpan={3} className="text-left font-bold text-foreground">
                      Tổng cộng ({filteredLedger.length} mặt hàng)
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatNumber(totals.openingQty)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{formatNumber(totals.inQty)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">
                      -{formatNumber(totals.outQty)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-bold text-foreground">
                      {formatNumber(totals.closingQty)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-bold text-primary">
                      {formatVnd(totals.closingValue)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>

          {/* 3. Pagination Controls */}
          {!isLoading && filteredLedger.length > 0 && totalPages > 1 && (
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t bg-card">
              <span className="text-xs text-muted-foreground">
                Hiển thị dòng <span className="font-semibold text-foreground">{(currentPage - 1) * pageSize + 1}</span> –{" "}
                <span className="font-semibold text-foreground">
                  {Math.min(currentPage * pageSize, filteredLedger.length)}
                </span>{" "}
                trên tổng số <span className="font-semibold text-foreground">{filteredLedger.length}</span> mặt hàng
              </span>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 gap-1 px-2.5 text-xs cursor-pointer"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Trước</span>
                </Button>

                <div className="flex items-center gap-1 px-2 text-xs font-medium text-muted-foreground">
                  <span>Trang</span>
                  <span className="font-semibold text-foreground">{currentPage}</span>
                  <span>/</span>
                  <span>{totalPages}</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 gap-1 px-2.5 text-xs cursor-pointer"
                >
                  <span>Sau</span>
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
