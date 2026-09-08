"use client";

import { useMemo, useState } from "react";
import {
  DollarSign,
  Home,
  AlertCircle,
  Eye,
  Search,
  Layers,
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ZoneCostReportData, ZoneCostRow } from "../types";
import { ZoneCostDetailDialog } from "./zone-cost-detail-dialog";

export interface ZoneCostReportTabProps {
  data: ZoneCostReportData | null;
  isLoading?: boolean;
}

export function ZoneCostReportTab({
  data,
  isLoading = false,
}: ZoneCostReportTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedZone, setSelectedZone] = useState<ZoneCostRow | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Top zone with highest total cost
  const topZone = useMemo(() => {
    if (!data?.zones || data.zones.length === 0) return null;
    const withCost = data.zones.filter((z) => z.totalCost > 0);
    if (withCost.length === 0) return null;
    return withCost.reduce((max, z) => (z.totalCost > max.totalCost ? z : max), withCost[0]);
  }, [data?.zones]);

  // Count of zones with cost or issues
  const activeZonesCount = useMemo(() => {
    if (!data?.zones) return 0;
    return data.zones.filter((z) => z.totalCost > 0 || z.issueCount > 0).length;
  }, [data?.zones]);

  // Filtered zones list
  const filteredZones = useMemo(() => {
    if (!data?.zones) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data.zones;

    return data.zones.filter((row) =>
      row.zoneName.toLowerCase().includes(term)
    );
  }, [data?.zones, searchTerm]);

  // Summary totals for table footer
  const totals = useMemo(() => {
    return filteredZones.reduce(
      (acc, row) => {
        acc.totalCost += row.totalCost;
        acc.percentage += row.percentage;
        acc.issueCount += row.issueCount;
        acc.defectCount += row.defectCount;
        return acc;
      },
      {
        totalCost: 0,
        percentage: 0,
        issueCount: 0,
        defectCount: 0,
      }
    );
  }, [filteredZones]);

  const handleOpenDetail = (zone: ZoneCostRow) => {
    setSelectedZone(zone);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Top KPI Summary Cards (3 Cards) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Tổng chi phí vật tư toàn trại */}
        <Card className="p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Tổng chi phí vật tư toàn trại
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <DollarSign className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
                {formatVnd(data?.grandTotalCost ?? 0)}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Tổng giá trị vật tư đã xuất cấp cho các chuồng
            </p>
          </div>
        </Card>

        {/* Card 2: Khu chuồng chi phí cao nhất */}
        <Card className="p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Khu chuồng chi phí cao nhất
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <Home className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-7 w-36" />
            ) : topZone ? (
              <div>
                <div
                  className="text-lg font-bold tracking-tight text-foreground truncate"
                  title={topZone.zoneName}
                >
                  {topZone.zoneName}
                </div>
                <p className="mt-1 text-[11px] font-mono text-rose-600 dark:text-rose-400">
                  {formatVnd(topZone.totalCost)}{" "}
                  <span className="text-muted-foreground">
                    ({topZone.percentage}%)
                  </span>
                </p>
              </div>
            ) : (
              <div>
                <div className="text-lg font-semibold tracking-tight text-muted-foreground">
                  Không có dữ liệu
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Chưa phát sinh chi phí xuất cấp
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Card 3: Số khu vực phát sinh chi phí */}
        <Card className="p-4 shadow-xs sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Số khu vực phát sinh chi phí
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <AlertCircle className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-xl font-bold tracking-tight text-foreground font-mono">
                {formatNumber(activeZonesCount)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  khu vực
                </span>
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Khu chuồng trại có phát sinh xuất cấp hoặc báo hỏng
            </p>
          </div>
        </Card>
      </div>

      {/* 2. Zone Cost Table Card */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" aria-hidden="true" />
                <CardTitle className="text-base font-semibold">
                  Bảng Phân Bổ Chi Phí Theo Chuồng / Khu Vực
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Chi tiết giá trị vật tư tiêu hao, số phiếu cấp và sự cố báo hỏng của từng khu chuồng
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search
                className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Tìm kiếm khu vực, chuồng trại..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
                aria-label="Tìm kiếm khu vực trong bảng chi phí chuồng"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Tên khu vực / Chuồng trại</TableHead>
                <TableHead className="w-[150px] text-right">Tổng chi phí vật tư</TableHead>
                <TableHead className="min-w-[160px]">Tỷ trọng (%)</TableHead>
                <TableHead className="w-[120px] text-right">Số phiếu xuất cấp</TableHead>
                <TableHead className="w-[140px] text-right">Số lần báo hỏng (1-1)</TableHead>
                <TableHead className="w-[130px] text-center">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-2.5 w-full rounded-full" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="mx-auto h-7 w-24 rounded-md" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredZones.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-xs text-muted-foreground"
                  >
                    {searchTerm
                      ? `Không tìm thấy khu vực nào khớp với từ khóa "${searchTerm}".`
                      : "Chưa có dữ liệu chi phí khu vực trong kỳ này."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredZones.map((zone) => (
                  <TableRow key={zone.zoneId}>
                    <TableCell className="py-3">
                      <div className="font-medium text-foreground">
                        {zone.zoneName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {zone.items.length} loại vật tư đã cấp
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-foreground">
                      {formatVnd(zone.totalCost)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              zone.percentage > 30 ? "bg-amber-500" : "bg-primary"
                            )}
                            style={{
                              width: `${Math.min(100, Math.max(0, zone.percentage))}%`,
                            }}
                            role="progressbar"
                            aria-valuenow={zone.percentage}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                        <span className="w-12 text-right font-mono text-xs text-muted-foreground">
                          {zone.percentage}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatNumber(zone.issueCount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatNumber(zone.defectCount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleOpenDetail(zone)}
                        className="h-7 text-xs font-normal text-muted-foreground hover:text-foreground"
                        aria-label={`Xem chi tiết vật tư ${zone.zoneName}`}
                      >
                        <Eye className="mr-1 size-3.5" aria-hidden="true" />
                        Chi tiết vật tư
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {!isLoading && filteredZones.length > 0 && (
              <TableFooter>
                <TableRow className="border-t bg-muted/50 font-bold hover:bg-muted/50">
                  <TableCell className="text-left font-semibold">
                    Tổng cộng ({formatNumber(filteredZones.length)} khu vực):
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                    {formatVnd(totals.totalCost)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {Number(totals.percentage.toFixed(1))}%
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatNumber(totals.issueCount)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatNumber(totals.defectCount)}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    —
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      {/* 3. Drill-down Detail Dialog */}
      <ZoneCostDetailDialog
        zone={selectedZone}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}
