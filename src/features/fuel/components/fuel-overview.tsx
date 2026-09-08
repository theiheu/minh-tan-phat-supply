"use client";

import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Droplet, Fuel, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVnd } from "@/lib/format";
import { formatFuelLiters } from "@/lib/fuel";
import type { FuelOverviewData, FuelType } from "../types";
import { FuelDispenseDialog, type VehicleSelection } from "./fuel-dispense-dialog";
import { FuelReceiptDialog } from "./fuel-receipt-dialog";

export function FuelOverview({
  overview,
  fuelTypes,
  vehicles,
  zones,
  suppliers,
}: {
  overview: FuelOverviewData;
  fuelTypes: FuelType[];
  vehicles: VehicleSelection[];
  zones: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}) {
  const totalLitersInStock = overview.fuelTypes.reduce((acc, ft) => acc + Number(ft.current_stock), 0);
  const totalLitersDispensedThisMonth = overview.fuelTypes.reduce((acc, ft) => acc + ft.dispensedThisMonth, 0);
  const totalLitersReceivedThisMonth = overview.fuelTypes.reduce((acc, ft) => acc + ft.receivedThisMonth, 0);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Tổng quan kho nhiên liệu</h2>
          <p className="text-sm text-muted-foreground">
            Theo dõi tồn kho dầu thực tế, xuất cấp phát phương tiện và nhập kho trong kỳ.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white shadow">
            <Link href="/fuel/scan">
              <QrCode className="mr-1.5 size-4" />
              Quét mã cấp dầu
            </Link>
          </Button>
          <FuelDispenseDialog fuelTypes={fuelTypes} vehicles={vehicles} zones={zones} />
          <FuelReceiptDialog fuelTypes={fuelTypes} suppliers={suppliers} />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tổng tồn kho nhiên liệu</CardTitle>
            <Droplet className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatFuelLiters(totalLitersInStock)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {overview.fuelTypes.length} loại nhiên liệu & nhớt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Đã cấp phát tháng này</CardTitle>
            <ArrowUpRight className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatFuelLiters(totalLitersDispensedThisMonth)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Xuất cho xe & máy móc</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Đã nhập trong tháng</CardTitle>
            <ArrowDownLeft className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatFuelLiters(totalLitersReceivedThisMonth)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Tổng tiền: {formatVnd(overview.totalReceiptAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Đội xe / Thiết bị</CardTitle>
            <Fuel className="size-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{vehicles.length} xe</div>
            <p className="mt-1 text-xs text-muted-foreground">
              <Link href="/admin/vehicles" className="hover:underline text-primary">
                Quản lý & in tem QR →
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Cards for Each Fuel Type */}
      <div>
        <h3 className="mb-3 text-base font-semibold">Tồn kho theo từng loại nhiên liệu</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {overview.fuelTypes.map((ft) => {
            const stockPct = ft.min_stock > 0 ? Math.min(100, Math.round((ft.current_stock / (ft.min_stock * 3)) * 100)) : 100;
            return (
              <Card key={ft.id} className={ft.isLowStock ? "border-destructive/40 bg-destructive/5" : undefined}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{ft.name}</CardTitle>
                    {ft.isLowStock && (
                      <Badge variant="danger" className="text-[10px] gap-1">
                        <AlertTriangle className="size-3" /> Cảnh báo tồn
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs font-mono">{ft.code}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold tracking-tight">
                      {formatFuelLiters(ft.current_stock)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Tối thiểu: {formatFuelLiters(ft.min_stock)}
                    </span>
                  </div>

                  {/* Stock progress bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all ${
                        ft.isLowStock ? "bg-destructive" : stockPct > 40 ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.max(5, stockPct)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t pt-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Xuất tháng này</p>
                      <p className="font-semibold text-amber-600">{formatFuelLiters(ft.dispensedThisMonth)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Xuất hôm nay</p>
                      <p className="font-semibold">{formatFuelLiters(ft.dispensedToday)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
