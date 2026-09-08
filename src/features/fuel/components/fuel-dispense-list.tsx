"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
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
import { ZoomableImage } from "@/components/image-lightbox";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatConsumptionRate, formatFuelLiters, formatOdo } from "@/lib/fuel";
import { cancelFuelDispenseAction } from "../actions";
import type { FuelDispense, FuelType } from "../types";
import { FuelDispenseDialog, type VehicleSelection } from "./fuel-dispense-dialog";

export interface FuelDispenseRow extends FuelDispense {
  fuel_type?: { name: string; code: string; unit: string } | null;
  vehicle?: { code: string; name: string; odo_unit: "km" | "hours" } | null;
  zone?: { name: string } | null;
  dispenser?: { name: string } | null;
}

export function FuelDispenseList({
  dispenses,
  total,
  page,
  pageSize,
  fuelTypes,
  vehicles,
  zones,
  filters,
}: {
  dispenses: FuelDispenseRow[];
  total: number;
  page: number;
  pageSize: number;
  fuelTypes: FuelType[];
  vehicles: VehicleSelection[];
  zones: { id: string; name: string }[];
  filters: { from: string; to: string; vehicleId: string; zoneId: string; fuelTypeId: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function handleCancel(id: string, code: string) {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy phiếu cấp dầu ${code}? Tồn kho sẽ được cộng hoàn trả lại.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await cancelFuelDispenseAction(id);
        toast.success(`Đã hủy phiếu cấp dầu ${code} và hoàn trả tồn kho`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Lỗi khi hủy phiếu");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Cấp phát dầu (Xuất kho)</h2>
          <p className="text-sm text-muted-foreground">
            Lịch sử cấp phát nhiên liệu cho từng phương tiện, máy móc và công trình.
          </p>
        </div>
        <FuelDispenseDialog
          fuelTypes={fuelTypes}
          vehicles={vehicles}
          zones={zones}
          onSaved={() => router.refresh()}
        />
      </div>

      <ListFilters
        basePath="/fuel"
        title="Lọc phiếu cấp phát"
        showDateRange
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
          tab: "dispenses",
          from: filters.from,
          to: filters.to,
          fuelTypeId: filters.fuelTypeId,
          vehicleId: filters.vehicleId,
          zoneId: filters.zoneId,
        }}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Danh sách phiếu cấp phát ({total} phiếu)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Mã phiếu</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Phương tiện / Xe</TableHead>
                  <TableHead>Khu vực</TableHead>
                  <TableHead>Nhiên liệu</TableHead>
                  <TableHead className="text-right">Số lít</TableHead>
                  <TableHead>Chỉ số Odo</TableHead>
                  <TableHead>Mức tiêu hao</TableHead>
                  <TableHead>Tài xế</TableHead>
                  <TableHead className="text-center">Ảnh</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                      Không có phiếu cấp phát nào trong khoảng thời gian này.
                    </TableCell>
                  </TableRow>
                ) : (
                  dispenses.map((d) => {
                    const pdfUrl = `/api/fuel/dispenses/${d.id}/pdf`;
                    const odoUnit = d.vehicle?.odo_unit ?? "km";
                    const meterImages = d.meter_images ?? [];

                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono font-medium text-xs">
                          {d.code}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(d.created_at)}
                        </TableCell>
                        <TableCell>
                          {d.vehicle ? (
                            <div>
                              <span className="font-semibold text-xs">{d.vehicle.code}</span>
                              <p className="text-[11px] text-muted-foreground">{d.vehicle.name}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.zone?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {d.fuel_type?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm text-primary">
                          {formatFuelLiters(Number(d.quantity))}
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.current_odo != null ? (
                            <div>
                              <span>{formatOdo(Number(d.current_odo), odoUnit)}</span>
                              {d.usage_diff != null && Number(d.usage_diff) > 0 && (
                                <p className="text-[10px] text-emerald-600 font-medium">
                                  +{formatOdo(Number(d.usage_diff), odoUnit)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.consumption_rate != null ? (
                            <Badge variant="info" className="text-[10px]">
                              {formatConsumptionRate(Number(d.consumption_rate), odoUnit)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.driver_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {meterImages.length > 0 ? (
                            <ZoomableImage
                              src={meterImages[0]}
                              images={meterImages}
                              alt="Ảnh đồng hồ"
                              className="size-8 mx-auto rounded object-cover border"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button asChild size="icon" variant="ghost" className="size-8" title="In phiếu">
                              <a href={pdfUrl} target="_blank" rel="noreferrer">
                                <Printer className="size-4" />
                              </a>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive hover:bg-destructive/10"
                              title="Hủy phiếu"
                              onClick={() => handleCancel(d.id, d.code)}
                              disabled={pending}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Pagination
        basePath="/fuel"
        page={page}
        totalPages={totalPages}
        params={{
          tab: "dispenses",
          from: filters.from || null,
          to: filters.to || null,
          fuelTypeId: filters.fuelTypeId || null,
          vehicleId: filters.vehicleId || null,
          zoneId: filters.zoneId || null,
        }}
      />
    </div>
  );
}
