"use client";

import { useMemo, useState } from "react";
import {
  Fuel,
  Truck,
  AlertTriangle,
  Search,
  CheckCircle2,
  Gauge,
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
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VehicleReportData } from "../types";

export interface VehicleReportTabProps {
  data: VehicleReportData | null;
  isLoading?: boolean;
}

export function VehicleReportTab({
  data,
  isLoading = false,
}: VehicleReportTabProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Count active vehicles (has dispensed liters or dispenseCount > 0)
  const activeVehiclesCount = useMemo(() => {
    if (!data?.vehicles) return 0;
    return data.vehicles.filter(
      (v) => v.totalLiters > 0 || v.dispenseCount > 0
    ).length;
  }, [data?.vehicles]);

  // Count vehicles exceeding norm
  const overNormVehiclesCount = useMemo(() => {
    if (!data?.vehicles) return 0;
    return data.vehicles.filter((v) => v.isOverNorm).length;
  }, [data?.vehicles]);

  // Filtered vehicles list
  const filteredVehicles = useMemo(() => {
    if (!data?.vehicles) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data.vehicles;

    return data.vehicles.filter(
      (v) =>
        v.name.toLowerCase().includes(term) ||
        v.code.toLowerCase().includes(term) ||
        (v.plate && v.plate.toLowerCase().includes(term))
    );
  }, [data?.vehicles, searchTerm]);

  // Totals for table footer
  const totals = useMemo(() => {
    return filteredVehicles.reduce(
      (acc, row) => {
        acc.totalLiters += row.totalLiters;
        acc.dispenseCount += row.dispenseCount;
        acc.totalUsageDiff += row.totalUsageDiff;
        return acc;
      },
      {
        totalLiters: 0,
        dispenseCount: 0,
        totalUsageDiff: 0,
      }
    );
  }, [filteredVehicles]);

  return (
    <div className="space-y-6">
      {/* 1. Top KPI Summary Cards (3 Cards) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Tổng dầu đã cấp */}
        <Card className="p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Tổng dầu đã cấp
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Fuel className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400 font-mono">
                {formatNumber(data?.totalLitersAllVehicles ?? 0)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  Lít
                </span>
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Tổng nhiên liệu đã cấp cho toàn bộ xe & máy móc trong kỳ
            </p>
          </div>
        </Card>

        {/* Card 2: Số phương tiện hoạt động */}
        <Card className="p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Số phương tiện hoạt động
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Truck className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-xl font-bold tracking-tight text-foreground font-mono">
                {formatNumber(activeVehiclesCount)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  phương tiện
                </span>
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Xe máy & máy phát điện có phát sinh cấp dầu
            </p>
          </div>
        </Card>

        {/* Card 3: Phương tiện vượt định mức */}
        <Card className="p-4 shadow-xs sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Phương tiện vượt định mức
            </span>
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                overNormVehiclesCount > 0
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <AlertTriangle className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div
                className={cn(
                  "text-xl font-bold tracking-tight font-mono",
                  overNormVehiclesCount > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-foreground"
                )}
              >
                {formatNumber(overNormVehiclesCount)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  xe cảnh báo
                </span>
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {overNormVehiclesCount > 0
                ? "Có phương tiện tiêu hao nhiên liệu vượt mức quy định"
                : "Tất cả phương tiện tiêu hao đúng hoặc dưới định mức"}
            </p>
          </div>
        </Card>
      </div>

      {/* 2. Vehicle Table Card */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Gauge className="size-4 text-primary" aria-hidden="true" />
                <CardTitle className="text-base font-semibold">
                  Bảng Theo Dõi Tiêu Hao Nhiên Liệu Phương Tiện
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Chi tiết số lít dầu cấp phát, chỉ số vận hành và đánh giá định mức tiêu hao
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search
                className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Tìm kiếm mã xe, tên xe, biển số..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
                aria-label="Tìm kiếm phương tiện trong bảng báo cáo dầu"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Mã xe & Tên xe</TableHead>
                <TableHead className="min-w-[120px]">Biển số / Model</TableHead>
                <TableHead className="w-[80px]">ĐVT</TableHead>
                <TableHead className="w-[120px] text-right">Tổng lít đã cấp</TableHead>
                <TableHead className="min-w-[140px] text-right">Quãng đường / Giờ chạy</TableHead>
                <TableHead className="min-w-[140px] text-right">Tiêu hao thực tế</TableHead>
                <TableHead className="min-w-[130px] text-right">Định mức quy định</TableHead>
                <TableHead className="w-[110px] text-right">Chênh lệch</TableHead>
                <TableHead className="w-[140px] text-center">Đánh giá</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="mt-1 h-3 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-12 rounded-full" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="mx-auto h-6 w-24 rounded-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredVehicles.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-32 text-center text-xs text-muted-foreground"
                  >
                    {searchTerm
                      ? `Không tìm thấy phương tiện nào khớp với từ khóa "${searchTerm}".`
                      : "Chưa có dữ liệu cấp dầu phương tiện trong kỳ này."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredVehicles.map((v) => {
                  const unitLabel = v.odoUnit === "hours" ? "L/giờ" : "L/100km";
                  const distLabel = v.odoUnit === "hours" ? "giờ" : "km";

                  return (
                    <TableRow key={v.vehicleId}>
                      <TableCell className="py-3">
                        <div className="font-medium text-foreground">
                          {v.name}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {v.code}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {v.plate || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-normal text-xs uppercase"
                        >
                          {v.odoUnit === "hours" ? "giờ" : "km"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-foreground">
                        {formatNumber(v.totalLiters)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          L
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {v.totalUsageDiff > 0 ? (
                          <>
                            {formatNumber(v.totalUsageDiff)}{" "}
                            <span className="text-muted-foreground">
                              {distLabel}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {v.avgRate !== null ? (
                          <span
                            className={cn(
                              "font-semibold",
                              v.isOverNorm
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-foreground"
                            )}
                          >
                            {formatNumber(v.avgRate)}{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                              {unitLabel}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {v.fuelNorm !== null ? (
                          <>
                            {formatNumber(v.fuelNorm)}{" "}
                            <span className="text-xs font-normal">
                              {unitLabel}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {v.normDiff !== null ? (
                          <span
                            className={cn(
                              "font-semibold",
                              v.normDiff > 0
                                ? "text-rose-600 dark:text-rose-400"
                                : v.normDiff < 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-muted-foreground"
                            )}
                          >
                            {v.normDiff > 0
                              ? `+${formatNumber(v.normDiff)}`
                              : formatNumber(v.normDiff)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {v.isOverNorm ? (
                          <Badge
                            variant="destructive"
                            className="inline-flex items-center gap-1 font-normal text-xs"
                          >
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            Vượt định mức
                          </Badge>
                        ) : v.fuelNorm !== null && v.avgRate !== null ? (
                          <Badge
                            variant="success"
                            className="inline-flex items-center gap-1 font-normal text-xs"
                          >
                            <CheckCircle2 className="size-3" aria-hidden="true" />
                            Bình thường
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {!isLoading && filteredVehicles.length > 0 && (
              <TableFooter>
                <TableRow className="border-t bg-muted/50 font-bold hover:bg-muted/50">
                  <TableCell colSpan={3} className="text-left font-semibold">
                    Tổng cộng ({formatNumber(filteredVehicles.length)} phương tiện):
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                    {formatNumber(Number(totals.totalLiters.toFixed(2)))} Lít
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {formatNumber(totals.dispenseCount)} lần cấp
                  </TableCell>
                  <TableCell
                    colSpan={4}
                    className="text-center text-xs text-muted-foreground"
                  >
                    —
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
