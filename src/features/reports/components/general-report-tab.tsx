"use client";

import { useMemo, useState } from "react";
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  DollarSign,
  Search,
  Wrench,
  Fuel,
  AlertTriangle,
  Boxes,
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
import { formatNumber, formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GeneralReportData } from "../types";

export interface GeneralReportTabProps {
  data: GeneralReportData | null;
  isLoading?: boolean;
}

export function GeneralReportTab({ data, isLoading = false }: GeneralReportTabProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLedger = useMemo(() => {
    if (!data?.stockLedger) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data.stockLedger;

    return data.stockLedger.filter(
      (row) =>
        row.productName.toLowerCase().includes(term) ||
        row.variantLabel.toLowerCase().includes(term) ||
        row.categoryName.toLowerCase().includes(term)
    );
  }, [data?.stockLedger, searchTerm]);

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
      {/* 1. Top KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Tổng giá trị kho hiện tại */}
        <Card className="p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Tổng giá trị kho hiện tại
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Package className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-xl font-bold tracking-tight text-foreground">
                {formatVnd(data?.totalInventoryValue ?? 0)}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Tính theo đơn giá và tồn cuối kỳ
            </p>
          </div>
        </Card>

        {/* Card 2: Tổng tiền nhập kho */}
        <Card className="p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Tổng tiền nhập kho
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <ArrowDownToLine className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatVnd(data?.totalImportValue ?? 0)}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Phiếu nhập kho đã hoàn tất trong kỳ
            </p>
          </div>
        </Card>

        {/* Card 3: Tổng chi phí xuất dùng */}
        <Card className="p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Tổng chi phí xuất dùng
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <ArrowUpFromLine className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {formatVnd(data?.totalIssuedCost ?? 0)}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Xuất chuồng trại & nội bộ trại
            </p>
          </div>
        </Card>

        {/* Card 4: Doanh thu xuất bán & thanh lý */}
        <Card className="p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Doanh thu xuất bán & thanh lý
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
              <DollarSign className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-xl font-bold tracking-tight text-violet-600 dark:text-violet-400">
                {formatVnd(data?.totalSalesRevenue ?? 0)}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Xuất bán khách & thu hồi thanh lý
            </p>
          </div>
        </Card>
      </div>

      {/* 2. Category Cost Breakdown Section */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Boxes className="size-4 text-primary" aria-hidden="true" />
            <CardTitle className="text-base font-semibold">
              Cơ cấu giá trị kho theo danh mục
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Tỷ trọng phân bổ giá trị tồn kho theo từng nhóm danh mục vật tư
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : !data?.categoryBreakdown || data.categoryBreakdown.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Chưa có dữ liệu phân loại danh mục trong kỳ này.
            </div>
          ) : (
            <div className="space-y-3.5">
              {data.categoryBreakdown.map((cat) => (
                <div key={cat.categoryName} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {cat.categoryName}
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-semibold text-foreground">
                        {formatVnd(cat.cost)}
                      </span>
                      <span className="text-muted-foreground">
                        ({cat.percentage}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, cat.percentage))}%`,
                      }}
                      role="progressbar"
                      aria-valuenow={cat.percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Subsystem Summary Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Subsystem 1: Sự cố & Thiết bị */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Wrench className="size-4 text-amber-500" aria-hidden="true" />
              <CardTitle className="text-base font-semibold">
                Sự cố & Thiết bị
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Tổng hợp tình hình báo hỏng, sửa chữa và thanh lý phế liệu
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">
                    Tổng sự cố báo hỏng
                  </div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {formatNumber(data?.defectsSummary?.totalDefects ?? 0)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    phiếu báo hỏng
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">
                    Sửa chữa phục hồi
                  </div>
                  <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatNumber(data?.defectsSummary?.repairedCount ?? 0)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    thiết bị tái sử dụng
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">
                    Chi phí sửa chữa
                  </div>
                  <div className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">
                    {formatVnd(data?.defectsSummary?.repairCost ?? 0)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    phụ tùng & dịch vụ
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">
                    Thu tiền thanh lý
                  </div>
                  <div className="mt-1 text-lg font-bold text-violet-600 dark:text-violet-400">
                    {formatVnd(data?.defectsSummary?.liquidationRevenue ?? 0)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    bán phế liệu & hủy
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subsystem 2: Tổng hợp Kho Dầu */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Fuel className="size-4 text-blue-500" aria-hidden="true" />
              <CardTitle className="text-base font-semibold">
                Tổng hợp Kho Dầu
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Tình hình nhập, cấp phát và tồn trữ nhiên liệu toàn trại
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">
                    Nhập bồn trong kỳ
                  </div>
                  <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatNumber(data?.fuelSummary?.totalImportedLiters ?? 0)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      Lít
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    nhiên liệu nhập kho
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">
                    Đã cấp phát
                  </div>
                  <div className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">
                    {formatNumber(data?.fuelSummary?.totalDispensedLiters ?? 0)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      Lít
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    cho xe máy & thiết bị
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">
                    Tồn bồn hiện tại
                  </div>
                  <div className="mt-1 text-lg font-bold text-blue-600 dark:text-blue-400">
                    {formatNumber(data?.fuelSummary?.currentTankStock ?? 0)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      Lít
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    khả dụng trong bồn
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">
                    Ước tính chi phí dầu
                  </div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {formatVnd(data?.fuelSummary?.estimatedCost ?? 0)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    theo đơn giá nhập bình quân
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Bảng Báo cáo Xuất - Nhập - Tồn (XNT) Toàn Diện */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Bảng Báo Cáo Xuất - Nhập - Tồn (XNT)
              </CardTitle>
              <CardDescription className="text-xs">
                Tổng hợp chi tiết biến động số lượng và giá trị tồn kho theo từng biến thể vật tư
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search
                className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Tìm kiếm vật tư, quy cách, danh mục..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
                aria-label="Tìm kiếm vật tư trong bảng XNT"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Tên vật tư & Biến thể</TableHead>
                <TableHead className="w-[70px]">ĐVT</TableHead>
                <TableHead className="min-w-[130px]">Danh mục</TableHead>
                <TableHead className="w-[100px] text-right">Tồn đầu kỳ</TableHead>
                <TableHead className="w-[100px] text-right">Nhập trong kỳ</TableHead>
                <TableHead className="w-[100px] text-right">Xuất trong kỳ</TableHead>
                <TableHead className="w-[100px] text-right">Tồn cuối kỳ</TableHead>
                <TableHead className="w-[110px] text-right">Đơn giá</TableHead>
                <TableHead className="w-[130px] text-right">Giá trị tồn cuối</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="mt-1 h-3 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded-full" />
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
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredLedger.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-32 text-center text-xs text-muted-foreground"
                  >
                    {searchTerm
                      ? `Không tìm thấy vật tư nào khớp với từ khóa "${searchTerm}".`
                      : "Chưa có dữ liệu Xuất - Nhập - Tồn trong kỳ này."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLedger.map((row) => {
                  const isOutOfStock = row.closingQty <= 0;
                  return (
                    <TableRow key={row.variantId}>
                      <TableCell className="py-2.5">
                        <div className="flex items-start gap-1.5">
                          <div>
                            <div className="font-medium text-foreground">
                              {row.productName}
                            </div>
                            {row.variantLabel && (
                              <div className="text-xs text-muted-foreground">
                                {row.variantLabel}
                              </div>
                            )}
                          </div>
                          {isOutOfStock && (
                            <Badge
                              variant="destructive"
                              className="ml-1.5 h-4.5 px-1.5 text-[10px] font-normal"
                            >
                              <AlertTriangle className="mr-0.5 size-2.5" />
                              Hết hàng
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.unit}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-normal text-xs"
                        >
                          {row.categoryName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(row.openingQty)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono",
                          row.inQty > 0 &&
                            "font-semibold text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {row.inQty > 0 ? `+${formatNumber(row.inQty)}` : formatNumber(row.inQty)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono",
                          row.outQty > 0 &&
                            "font-semibold text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {row.outQty > 0 ? `-${formatNumber(row.outQty)}` : formatNumber(row.outQty)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono font-semibold",
                          isOutOfStock && "text-destructive"
                        )}
                      >
                        {formatNumber(row.closingQty)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatVnd(row.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-foreground">
                        {formatVnd(row.closingValue)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {!isLoading && filteredLedger.length > 0 && (
              <TableFooter>
                <TableRow className="border-t bg-muted/50 font-bold hover:bg-muted/50">
                  <TableCell colSpan={3} className="text-left font-semibold">
                    Tổng cộng ({formatNumber(filteredLedger.length)} vật tư):
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatNumber(totals.openingQty)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    +{formatNumber(totals.inQty)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                    -{formatNumber(totals.outQty)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatNumber(totals.closingQty)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    —
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-foreground">
                    {formatVnd(totals.closingValue)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
