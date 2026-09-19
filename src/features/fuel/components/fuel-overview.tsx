"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Droplet,
  Droplets,
  Edit,
  Fuel,
  Plus,
  QrCode,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVnd } from "@/lib/format";
import { formatFuelQuantity } from "@/lib/fuel";
import type { FuelOverviewData, FuelType } from "../types";
import { FuelDispenseDialog, type VehicleSelection } from "./fuel-dispense-dialog";
import { FuelReceiptDialog } from "./fuel-receipt-dialog";
import { FuelTypeDialog } from "./fuel-type-dialog";

export function FuelOverview({
  overview,
  fuelTypes,
  vehicles,
  zones,
  subZones = [],
  suppliers,
}: {
  overview: FuelOverviewData;
  fuelTypes: FuelType[];
  vehicles: VehicleSelection[];
  zones: { id: string; name: string }[];
  subZones?: { id: string; zone_id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}) {
  const [editingType, setEditingType] = useState<FuelType | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const totalLitersInStock = overview.fuelTypes.reduce((acc, ft) => acc + Number(ft.current_stock), 0);
  const totalLitersDispensedThisMonth = overview.fuelTypes.reduce((acc, ft) => acc + ft.dispensedThisMonth, 0);
  const totalLitersReceivedThisMonth = overview.fuelTypes.reduce((acc, ft) => acc + ft.receivedThisMonth, 0);

  const handleEdit = (ftStat: typeof overview.fuelTypes[0]) => {
    const matched = fuelTypes.find((f) => f.id === ftStat.id) || {
      id: ftStat.id,
      code: ftStat.code,
      name: ftStat.name,
      unit: ftStat.unit,
      current_stock: ftStat.current_stock,
      min_stock: ftStat.min_stock,
      description: ftStat.description,
      is_active: ftStat.is_active,
      created_at: "",
      updated_at: "",
    };
    setEditingType(matched as FuelType);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Tổng quan kho nhiên liệu</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Theo dõi tồn kho dầu thực tế, xuất cấp phát phương tiện và nhập kho.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            variant="outline"
            className="text-xs sm:text-sm h-9 border-emerald-600/40 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1.5"
          >
            <Plus className="size-3.5 sm:size-4 text-emerald-600" />
            Thêm loại dầu / nhớt
          </Button>
          <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow text-xs sm:text-sm h-9">
            <Link href="/fuel/scan">
              <QrCode className="mr-1.5 size-3.5 sm:size-4" />
              Quét mã cấp dầu
            </Link>
          </Button>
          <FuelDispenseDialog fuelTypes={fuelTypes} vehicles={vehicles} zones={zones} subZones={subZones} />
          <FuelReceiptDialog fuelTypes={fuelTypes} suppliers={suppliers} />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Tổng tồn kho</CardTitle>
            <Droplet className="size-3.5 sm:size-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatFuelQuantity(totalLitersInStock, "lít")}
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">
              <Link href="/fuel?tab=types" className="hover:underline text-primary">
                {overview.fuelTypes.length} loại nhiên liệu →
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Cấp tháng này</CardTitle>
            <ArrowUpRight className="size-3.5 sm:size-4 text-amber-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-amber-600">
              {formatFuelQuantity(totalLitersDispensedThisMonth, "lít")}
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">Xuất cho xe & máy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Nhập trong tháng</CardTitle>
            <ArrowDownLeft className="size-3.5 sm:size-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-blue-600">
              {formatFuelQuantity(totalLitersReceivedThisMonth, "lít")}
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground truncate">
              {formatVnd(overview.totalReceiptAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Đội xe / Máy</CardTitle>
            <Fuel className="size-3.5 sm:size-4 text-purple-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-purple-600">{vehicles.length} xe</div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">
              <Link href="/admin/vehicles" className="hover:underline text-primary">
                Xem danh mục xe →
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Cards for Each Fuel Type */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-semibold">Tồn kho theo từng loại nhiên liệu</h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCreateDialogOpen(true)}
              className="text-xs h-8 text-primary hover:text-primary gap-1"
            >
              <Plus className="size-3.5" />
              Thêm loại mới
            </Button>
            <Link
              href="/fuel?tab=types"
              className="text-xs text-muted-foreground hover:text-foreground underline hidden sm:inline"
            >
              Xem danh sách chi tiết
            </Link>
          </div>
        </div>

        {overview.fuelTypes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-6 sm:p-8 text-center space-y-3">
              <div className="rounded-full bg-emerald-500/10 p-3.5">
                <Droplets className="size-7 text-emerald-600" />
              </div>
              <div className="space-y-1 max-w-md">
                <h4 className="text-sm sm:text-base font-semibold">Chưa có loại nhiên liệu / dầu nhớt nào</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Khai báo các loại Dầu Diesel DO, Nhớt động cơ 15W-40, Dầu thủy lực 68, Nước làm mát... để bắt đầu theo dõi tồn kho và xuất nhập.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow"
              >
                <Plus className="size-4" />
                Tạo loại nhiên liệu đầu tiên
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {overview.fuelTypes.map((ft) => {
              const stockPct = ft.min_stock > 0 ? Math.min(100, Math.round((ft.current_stock / (ft.min_stock * 3)) * 100)) : 100;
              return (
                <Card key={ft.id} className={ft.isLowStock ? "border-destructive/40 bg-destructive/5" : undefined}>
                  <CardHeader className="pb-2 p-3 sm:p-5">
                    <div className="flex items-start justify-between gap-1">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <CardTitle className="text-xs sm:text-sm font-semibold truncate" title={ft.name}>
                          {ft.name}
                        </CardTitle>
                        <CardDescription className="text-[11px] font-mono">{ft.code}</CardDescription>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {ft.isLowStock && (
                          <Badge variant="danger" className="text-[9px] sm:text-[10px] gap-1 px-1.5 py-0 shrink-0">
                            <AlertTriangle className="size-2.5 sm:size-3" /> Cảnh báo
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-foreground"
                          title="Chỉnh sửa loại nhiên liệu"
                          onClick={() => handleEdit(ft)}
                        >
                          <Edit className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 p-3 pt-0 sm:p-5 sm:pt-0">
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg sm:text-xl font-bold tracking-tight">
                        {formatFuelQuantity(ft.current_stock, ft.unit)}
                      </span>
                      <span className="text-[11px] sm:text-xs text-muted-foreground">
                        Tối thiểu: {formatFuelQuantity(ft.min_stock, ft.unit)}
                      </span>
                    </div>

                    {/* Stock progress bar */}
                    <div className="h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${
                          ft.isLowStock ? "bg-destructive" : stockPct > 40 ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.max(5, stockPct)}%` }}
                      />
                    </div>

                    {ft.description && (
                      <p className="text-[11px] text-muted-foreground truncate" title={ft.description}>
                        {ft.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 border-t pt-2 text-[11px] sm:text-xs">
                      <div>
                        <p className="text-muted-foreground">Xuất tháng</p>
                        <p className="font-semibold text-amber-600">{formatFuelQuantity(ft.dispensedThisMonth, ft.unit)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Xuất hôm nay</p>
                        <p className="font-semibold">{formatFuelQuantity(ft.dispensedToday, ft.unit)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Controlled Dialogs */}
      <FuelTypeDialog
        mode="create"
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <FuelTypeDialog
        mode="edit"
        fuelType={editingType}
        open={editDialogOpen}
        onOpenChange={(v) => {
          setEditDialogOpen(v);
          if (!v) setEditingType(null);
        }}
      />
    </div>
  );
}