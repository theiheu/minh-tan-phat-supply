"use client";

import Link from "next/link";
import {
  Gauge,
  History,
  QrCode,
  Truck,
} from "lucide-react";
import type { Profile } from "@/lib/types";
import type { DriverDashboardData } from "@/features/dashboard/server/get-role-dashboard-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

interface DriverDashboardViewProps {
  profile: Profile;
  data: DriverDashboardData;
}

export function DriverDashboardView({
  profile,
  data,
}: DriverDashboardViewProps) {
  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto">
      {/* Top Banner */}
      <div className="bg-linear-to-br from-amber-500/15 via-amber-500/5 to-background p-4 sm:p-5 rounded-2xl border border-amber-500/20 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
          <Truck className="size-3.5" />
          Tài Xế Vận Hành Xe Cơ Giới
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          Xin chào, {profile.name}
        </h1>
        <p className="text-xs text-muted-foreground">
          Quét mã QR dán trên xe tại trạm bồn để ghi nhận lượt bơm dầu và chỉ số công tơ mét / giờ máy.
        </p>
      </div>

      {/* HERO QR SCAN BUTTON - Extra Large for Driver */}
      <Card className="border-2 border-primary bg-primary/5 rounded-3xl p-4 sm:p-6 text-center shadow-lg hover:shadow-xl transition-shadow">
        <CardContent className="flex flex-col items-center justify-center p-0 space-y-3">
          <div className="size-16 sm:size-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md animate-pulse">
            <QrCode className="size-8 sm:size-10" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-black text-foreground">
              TIẾP NHIÊN LIỆU XE CƠ GIỚI
            </h2>
            <p className="text-xs text-muted-foreground max-w-sm">
              Mở camera quét mã QR dán trên đầu xe để nhập số lít & số ODO trong 10 giây.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto h-12 sm:h-14 px-8 text-sm sm:text-base font-black rounded-2xl shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Link href="/fuel/scan">
              <QrCode className="size-5 mr-2" />
              QUÉT MÃ QR BƠM DẦU NGAY
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Assigned Vehicle & Last Dispense Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Vehicle Info */}
        <Card className="rounded-2xl border border-border shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Phương tiện phụ trách</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0 text-xs">
            {data.assignedVehicle ? (
              <>
                <div className="text-base font-bold text-foreground">
                  {data.assignedVehicle.name}
                </div>
                <div className="font-mono text-muted-foreground">
                  Biển số: <span className="font-semibold text-foreground">{data.assignedVehicle.licensePlate || data.assignedVehicle.code}</span>
                </div>
                {data.assignedVehicle.standardRate && (
                  <div className="text-muted-foreground">
                    Định mức: <span className="font-semibold text-foreground">{data.assignedVehicle.standardRate} L/{data.assignedVehicle.calcUnit}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground py-2">
                Chưa gán xe cố định (Quét QR trực tiếp theo xe đang lái).
              </div>
            )}
          </CardContent>
        </Card>

        {/* Month Stats */}
        <Card className="rounded-2xl border border-border shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-amber-600" />
              <CardTitle className="text-sm font-semibold">Nhiên liệu tháng này</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0 text-xs">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {data.monthStats.totalLiters.toLocaleString("vi-VN")} Lít
            </div>
            <div className="text-muted-foreground">
              Tổng số lượt bơm dầu: <span className="font-semibold text-foreground">{data.monthStats.dispenseCount} lần</span>
            </div>
            {data.lastDispense && (
              <div className="text-[11px] text-muted-foreground/80 truncate">
                Lần gần nhất: {data.lastDispense.liters} L ({formatDateTime(data.lastDispense.createdAt)})
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Driver's Dispense History */}
      <Card className="rounded-2xl border border-border shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            <CardTitle className="text-sm sm:text-base font-semibold">
              Lịch sử đổ dầu gần đây ({data.recentDispenses.length})
            </CardTitle>
          </div>
          <Link
            href="/fuel"
            className="text-xs font-medium text-primary hover:underline"
          >
            Sổ kho dầu
          </Link>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pt-0">
          {data.recentDispenses.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Chưa có lượt bơm dầu nào được ghi nhận.
            </div>
          ) : (
            <div className="divide-y">
              {data.recentDispenses.map((dispense) => (
                <div key={dispense.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-semibold text-foreground truncate">
                      {dispense.vehicleName}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span className="font-mono">{dispense.code}</span>
                      <span>·</span>
                      <span>{formatDateTime(dispense.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                      {dispense.liters} Lít
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      Số ĐH: {dispense.meter.toLocaleString("vi-VN")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
