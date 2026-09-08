"use client";

import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  DollarSign,
  Wrench,
  Fuel,
  Layers,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatVnd } from "@/lib/format";
import type { GeneralReportData } from "../types";

export interface GeneralReportTabProps {
  data: GeneralReportData | null;
  isLoading?: boolean;
  onNavigateToXnt?: () => void;
}

export function GeneralReportTab({
  data,
  isLoading = false,
  onNavigateToXnt,
}: GeneralReportTabProps) {
  const categoryBreakdown = data?.categoryBreakdown ?? [];
  const defectsSummary = data?.defectsSummary;
  const fuelSummary = data?.fuelSummary;

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
              Định giá tài sản tồn theo giá niêm yết
            </p>
          </div>
        </Card>

        {/* Card 2: Tổng tiền nhập kho trong kỳ */}
        <Card className="p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Tổng nhập kho trong kỳ
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
              Giá trị nhập từ các Nhà cung cấp
            </p>
          </div>
        </Card>

        {/* Card 3: Tổng chi phí vật tư đã xuất dùng */}
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
              Cấp phát cho chuồng trại & đổi hỏng
            </p>
          </div>
        </Card>

        {/* Card 4: Doanh thu xuất bán & thanh lý */}
        <Card className="p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Doanh thu bán & thanh lý
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DollarSign className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-xl font-bold tracking-tight text-primary">
                {formatVnd(data?.totalSalesRevenue ?? 0)}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Bán phân, vỉ trứng & thanh lý phế liệu
            </p>
          </div>
        </Card>
      </div>

      {/* 2. Category Cost Breakdown Section */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Phân bổ Chi phí Vật tư theo Nhóm Danh Mục
          </CardTitle>
          <CardDescription className="text-xs">
            Tỷ trọng chi phí xuất dùng trong kỳ theo các nhóm mặt hàng
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : categoryBreakdown.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Chưa có phát sinh chi phí vật tư trong khoảng thời gian này.
            </div>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{cat.categoryName}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground font-semibold">
                        {formatVnd(cat.cost)}
                      </span>
                      <span className="w-12 text-right font-mono font-semibold text-primary">
                        {cat.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  {/* Tailwind Progress Bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, cat.percentage))}%` }}
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
        {/* Sự cố, Sửa chữa & Thanh lý */}
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Sự cố Thiết bị & Sửa chữa / Thanh lý
              </CardTitle>
              <Wrench className="size-4 text-amber-500" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Tổng lượt báo hỏng / đổi 1-1:</span>
                  <span className="font-semibold text-foreground">
                    {defectsSummary?.totalDefects ?? 0} lượt
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Thiết bị sửa thành công thu hồi:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {defectsSummary?.repairedCount ?? 0} thiết bị
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Chi phí thuê quấn / sửa chữa:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatVnd(defectsSummary?.repairCost ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-0.5">
                  <span className="text-muted-foreground">Tiền thu thanh lý phế liệu ve chai:</span>
                  <span className="font-mono font-semibold text-primary">
                    {formatVnd(defectsSummary?.liquidationRevenue ?? 0)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tổng quan Kho Dầu Nhiên Liệu */}
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Tổng hợp Kho Dầu Nhiên Liệu
              </CardTitle>
              <Fuel className="size-4 text-blue-500" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Tổng lượng dầu nhập bồn:</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    +{formatNumber(fuelSummary?.totalImportedLiters ?? 0)} Lít
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Tổng lượng dầu đã cấp phát:</span>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                    -{formatNumber(fuelSummary?.totalDispensedLiters ?? 0)} Lít
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Mức tồn bồn dầu hiện tại:</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatNumber(fuelSummary?.currentTankStock ?? 0)} Lít
                  </span>
                </div>
                <div className="flex justify-between pt-0.5">
                  <span className="text-muted-foreground">Ước tính chi phí dầu:</span>
                  <span className="font-mono font-semibold text-primary">
                    {formatVnd(fuelSummary?.estimatedCost ?? 0)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Quick Action Banner to View XNT */}
      {onNavigateToXnt && (
        <Card className="p-4 bg-muted/30 border-dashed shadow-none flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="size-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground">
                Sổ chi tiết Xuất - Nhập - Tồn Kho (XNT)
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Xem toàn bộ biến động đầu kỳ, phát sinh nhập/xuất và số dư cuối kỳ theo từng mã vật tư
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToXnt}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer whitespace-nowrap"
          >
            Chuyển sang Bảng Xuất - Nhập - Tồn →
          </button>
        </Card>
      )}
    </div>
  );
}
