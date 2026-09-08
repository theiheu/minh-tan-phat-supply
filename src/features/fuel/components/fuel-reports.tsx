"use client";

import { useMemo } from "react";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import * as XLSX from "xlsx";
import { ListFilters } from "@/components/list-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { formatConsumptionRate, formatFuelLiters, formatOdo } from "@/lib/fuel";
import type { FuelReportRow, FuelType } from "../types";
import type { VehicleSelection } from "./fuel-dispense-dialog";

export function FuelReports({
  reportData,
  vehicles,
  zones,
  fuelTypes,
  filters,
}: {
  reportData: FuelReportRow[];
  vehicles: VehicleSelection[];
  zones: { id: string; name: string }[];
  fuelTypes: FuelType[];
  filters: { from: string; to: string; vehicleId: string; zoneId: string; fuelTypeId: string };
}) {
  // Aggregate consumption by vehicle
  const vehicleStats = useMemo(() => {
    const map = new Map<
      string,
      {
        vehicleId: string;
        code: string;
        name: string;
        odoUnit: "km" | "hours";
        fuelNorm: number | null;
        totalLiters: number;
        dispenseCount: number;
        totalUsageDiff: number;
      }
    >();

    for (const r of reportData) {
      if (!r.vehicle) continue;
      const key = r.vehicle.id;
      const existing = map.get(key) ?? {
        vehicleId: r.vehicle.id,
        code: r.vehicle.code,
        name: r.vehicle.name,
        odoUnit: r.vehicle.odo_unit,
        fuelNorm: r.vehicle.fuel_norm,
        totalLiters: 0,
        dispenseCount: 0,
        totalUsageDiff: 0,
      };

      existing.totalLiters += Number(r.quantity);
      existing.dispenseCount += 1;
      if (r.usage_diff != null && Number(r.usage_diff) > 0) {
        existing.totalUsageDiff += Number(r.usage_diff);
      }

      map.set(key, existing);
    }

    return Array.from(map.values()).map((v) => {
      let avgRate: number | null = null;
      if (v.totalUsageDiff > 0) {
        if (v.odoUnit === "km") {
          avgRate = Math.round((v.totalLiters / v.totalUsageDiff) * 100 * 100) / 100;
        } else {
          avgRate = Math.round((v.totalLiters / v.totalUsageDiff) * 100) / 100;
        }
      }

      const normDiff = avgRate != null && v.fuelNorm != null ? Math.round((avgRate - v.fuelNorm) * 100) / 100 : null;
      const isOverNorm = normDiff != null && normDiff > 0;

      return {
        ...v,
        avgRate,
        normDiff,
        isOverNorm,
      };
    });
  }, [reportData]);

  // Aggregate by zone
  const zoneStats = useMemo(() => {
    const map = new Map<string, { zoneName: string; totalLiters: number; dispenseCount: number }>();
    let grandTotal = 0;

    for (const r of reportData) {
      const zoneName = r.zone?.name ?? "Khác / Chưa phân khu";
      const existing = map.get(zoneName) ?? { zoneName, totalLiters: 0, dispenseCount: 0 };
      existing.totalLiters += Number(r.quantity);
      existing.dispenseCount += 1;
      grandTotal += Number(r.quantity);
      map.set(zoneName, existing);
    }

    return Array.from(map.values()).map((z) => ({
      ...z,
      percentage: grandTotal > 0 ? Math.round((z.totalLiters / grandTotal) * 1000) / 10 : 0,
    }));
  }, [reportData]);

  const totalPeriodLiters = reportData.reduce((acc, r) => acc + Number(r.quantity), 0);

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Chi tiết từng lần cấp dầu
    const detailRows = reportData.map((r) => ({
      "Mã phiếu": r.code,
      "Thời gian": formatDateTime(r.created_at),
      "Phương tiện": r.vehicle ? `${r.vehicle.code} - ${r.vehicle.name}` : "Khác / Không gán xe",
      "Khu vực": r.zone?.name ?? "Chưa phân khu",
      "Loại nhiên liệu": r.fuel_type?.name ?? "—",
      "Số lít": Number(r.quantity),
      "Đoạn đường / Giờ chạy": r.usage_diff ? Number(r.usage_diff) : "—",
      "Mức tiêu hao": r.consumption_rate ? Number(r.consumption_rate) : "—",
      "Đơn vị đo": r.vehicle?.odo_unit ?? "—",
      "Tài xế": r.driver_name ?? "—",
    }));
    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, wsDetail, "Chi tiết cấp dầu");

    // Sheet 2: Tổng hợp theo xe
    const vehicleRows = vehicleStats.map((v) => ({
      "Biển số / Mã xe": v.code,
      "Tên phương tiện": v.name,
      "Số lần cấp": v.dispenseCount,
      "Tổng số lít": v.totalLiters,
      "Tổng quãng đường / Giờ": v.totalUsageDiff,
      "Tiêu hao trung bình": v.avgRate ?? "—",
      "Định mức quy định": v.fuelNorm ?? "—",
      "Chênh lệch định mức": v.normDiff ? (v.normDiff > 0 ? `+${v.normDiff}` : `${v.normDiff}`) : "—",
    }));
    const wsVehicle = XLSX.utils.json_to_sheet(vehicleRows);
    XLSX.utils.book_append_sheet(wb, wsVehicle, "Tổng hợp theo xe");

    // Sheet 3: Tổng hợp theo khu vực
    const zoneRows = zoneStats.map((z) => ({
      "Khu vực / Công trình": z.zoneName,
      "Số lần cấp": z.dispenseCount,
      "Tổng lít": z.totalLiters,
      "Tỷ trọng (%)": `${z.percentage}%`,
    }));
    const wsZone = XLSX.utils.json_to_sheet(zoneRows);
    XLSX.utils.book_append_sheet(wb, wsZone, "Tổng hợp theo khu vực");

    XLSX.writeFile(wb, `Bao-cao-tieu-thu-dau-${filters.from}-den-${filters.to}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Báo cáo & Phân tích tiêu hao</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            So sánh định mức tiêu thụ nhiên liệu của từng phương tiện và phân bổ theo khu vực.
          </p>
        </div>
        <Button onClick={exportExcel} variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm h-9">
          <Download className="size-3.5 sm:size-4" />
          Xuất Excel (.xlsx)
        </Button>
      </div>

      <ListFilters
        basePath="/fuel"
        title="Chọn khoảng thời gian báo cáo"
        showDateRange
        showSearch={false}
        filters={[
          {
            param: "fuelTypeId",
            label: "Loại dầu",
            allLabel: "Tất cả loại dầu",
            options: fuelTypes.map((ft) => ({ value: ft.id, label: ft.name })),
          },
          {
            param: "vehicleId",
            label: "Phương tiện",
            allLabel: "Tất cả phương tiện",
            options: vehicles.map((v) => ({ value: v.id, label: `${v.code} - ${v.name}` })),
          },
          {
            param: "zoneId",
            label: "Khu vực",
            allLabel: "Tất cả khu vực",
            options: zones.map((z) => ({ value: z.id, label: z.name })),
          },
        ]}
        initial={{
          tab: "reports",
          from: filters.from,
          to: filters.to,
          fuelTypeId: filters.fuelTypeId,
          vehicleId: filters.vehicleId,
          zoneId: filters.zoneId,
        }}
      />

      {/* Summary KPI */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tổng nhiên liệu tiêu thụ trong kỳ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatFuelLiters(totalPeriodLiters)}</div>
            <p className="text-xs text-muted-foreground">{reportData.length} lượt cấp phát</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Số xe / Thiết bị hoạt động</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicleStats.length} phương tiện</div>
            <p className="text-xs text-muted-foreground">Có phát sinh lấy dầu trong kỳ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Khu vực phân bổ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{zoneStats.length} khu vực</div>
            <p className="text-xs text-muted-foreground">Phân xưởng & công trình nhận dầu</p>
          </CardContent>
        </Card>
      </div>

      {/* Table 1: Consumption by Vehicle */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Hiệu suất tiêu hao theo Phương tiện / Xe</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phương tiện</TableHead>
                  <TableHead className="text-right">Số lần cấp</TableHead>
                  <TableHead className="text-right">Tổng lít cấp</TableHead>
                  <TableHead className="text-right">Quãng đường / Giờ</TableHead>
                  <TableHead>Tiêu hao thực tế</TableHead>
                  <TableHead>Định mức quy định</TableHead>
                  <TableHead>Đánh giá</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicleStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Không có dữ liệu cấp dầu cho phương tiện nào trong kỳ.
                    </TableCell>
                  </TableRow>
                ) : (
                  vehicleStats.map((v) => (
                    <TableRow key={v.vehicleId}>
                      <TableCell>
                        <span className="font-semibold text-xs">{v.code}</span>
                        <p className="text-[11px] text-muted-foreground">{v.name}</p>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">{v.dispenseCount}</TableCell>
                      <TableCell className="text-right font-bold text-xs text-primary">
                        {formatFuelLiters(v.totalLiters)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {v.totalUsageDiff > 0 ? formatOdo(v.totalUsageDiff, v.odoUnit) : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-semibold">
                        {formatConsumptionRate(v.avgRate, v.odoUnit)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatConsumptionRate(v.fuelNorm, v.odoUnit)}
                      </TableCell>
                      <TableCell>
                        {v.isOverNorm ? (
                          <Badge variant="danger" className="text-[10px] gap-1">
                            <TrendingUp className="size-3" /> Vượt định mức (+{v.normDiff})
                          </Badge>
                        ) : v.avgRate != null && v.fuelNorm != null ? (
                          <Badge variant="success" className="text-[10px] gap-1">
                            <TrendingDown className="size-3" /> Đạt định mức ({v.normDiff})
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Chưa đủ dữ liệu</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Table 2: Allocation by Zone */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Phân bổ nhiên liệu theo Khu vực / Công trình</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Khu vực / Công trình</TableHead>
                  <TableHead className="text-right">Số lượt cấp</TableHead>
                  <TableHead className="text-right">Tổng số lít</TableHead>
                  <TableHead className="text-right">Tỷ trọng (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zoneStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Chưa có dữ liệu phân bổ.
                    </TableCell>
                  </TableRow>
                ) : (
                  zoneStats.map((z) => (
                    <TableRow key={z.zoneName}>
                      <TableCell className="font-medium text-xs">{z.zoneName}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{z.dispenseCount}</TableCell>
                      <TableCell className="text-right font-bold text-xs text-primary">
                        {formatFuelLiters(z.totalLiters)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-primary" style={{ width: `${z.percentage}%` }} />
                          </div>
                          <span>{z.percentage}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
