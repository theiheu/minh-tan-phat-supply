"use client";

import { Edit3, Gauge, MapPin, Plus, QrCode, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toggleVehicleActiveAction } from "../actions";
import { VEHICLE_TYPE_LABELS, type VehicleInput } from "../schema";
import { VehicleDialog, type EditableVehicle, type VehicleOption } from "./vehicle-dialog";
import { VehicleQrModal, type VehicleQrSummary } from "./vehicle-qr-modal";

export interface VehicleListRow extends EditableVehicle, VehicleQrSummary {
  type: VehicleInput["type"];
  isActive: boolean;
}

export function VehicleList({
  vehicles,
  fuelTypes,
  zones,
  subZones = [],
  page,
  totalPages,
  filters,
}: {
  vehicles: VehicleListRow[];
  fuelTypes: VehicleOption[];
  zones: VehicleOption[];
  subZones?: { id: string; zone_id: string; name: string }[];
  page: number;
  totalPages: number;
  filters: { q: string; type: string; status: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleListRow | null>(null);
  const [qrVehicle, setQrVehicle] = useState<VehicleListRow | null>(null);
  const hasFilters = Boolean(filters.q || filters.type || filters.status);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function toggleActive(vehicle: VehicleListRow) {
    startTransition(async () => {
      try {
        await toggleVehicleActiveAction(vehicle.id, !vehicle.isActive);
        toast.success(vehicle.isActive ? "Đã ngừng sử dụng phương tiện" : "Đã kích hoạt phương tiện");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể thay đổi trạng thái");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Phương tiện / Xe</h1>
          <p className="text-sm text-muted-foreground">Quản lý xe, máy móc, định mức nhiên liệu và tem QR cấp dầu.</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> Thêm phương tiện</Button>
      </div>

      <ListFilters
        basePath="/admin/vehicles"
        title="Lọc phương tiện"
        searchPlaceholder="Tìm biển số, tên xe, tài xế…"
        filters={[
          { param: "type", label: "Loại phương tiện", allLabel: "Tất cả loại", options: Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
          { param: "status", label: "Trạng thái", allLabel: "Tất cả trạng thái", options: [{ value: "active", label: "Đang hoạt động" }, { value: "inactive", label: "Ngừng sử dụng" }] },
        ]}
        initial={filters}
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Danh sách phương tiện</CardTitle></CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
              <Truck className="mb-3 size-10 text-muted-foreground/60" />
              <p className="font-medium">{hasFilters ? "Không tìm thấy phương tiện phù hợp" : "Chưa có phương tiện"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{hasFilters ? "Hãy thử thay đổi từ khóa hoặc bộ lọc." : "Thêm xe hoặc thiết bị đầu tiên để quản lý cấp phát nhiên liệu."}</p>
              {!hasFilters && <Button className="mt-4" size="sm" onClick={openCreate}><Plus className="size-4" /> Thêm phương tiện</Button>}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Phương tiện</TableHead><TableHead>Loại / Khu vực</TableHead><TableHead>Nhiên liệu</TableHead><TableHead>Chỉ số / Định mức</TableHead><TableHead>Trạng thái</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {vehicles.map((vehicle) => (
                      <TableRow key={vehicle.id} className={!vehicle.isActive ? "opacity-60" : undefined}>
                        <TableCell><div className="font-semibold">{vehicle.code}</div><div className="max-w-56 truncate text-sm text-muted-foreground">{vehicle.name}</div>{vehicle.defaultDriver && <div className="text-xs text-muted-foreground">Tài xế: {vehicle.defaultDriver}</div>}</TableCell>
                        <TableCell><div>{VEHICLE_TYPE_LABELS[vehicle.type]}</div><div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" /> {vehicle.zoneName ?? "Chưa phân khu"}</div></TableCell>
                        <TableCell>{vehicle.fuelTypeName ?? "—"}</TableCell>
                        <TableCell><div>{vehicle.currentOdo.toLocaleString("vi-VN")} {vehicle.odoUnit === "km" ? "km" : "giờ"}</div><div className="text-xs text-muted-foreground">Định mức: {vehicle.fuelNorm == null ? "—" : `${vehicle.fuelNorm.toLocaleString("vi-VN")} ${vehicle.odoUnit === "km" ? "L/100km" : "L/giờ"}`}</div></TableCell>
                        <TableCell><Badge variant={vehicle.isActive ? "success" : "neutral"}>{vehicle.isActive ? "Đang hoạt động" : "Ngừng sử dụng"}</Badge></TableCell>
                        <TableCell><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => { setEditing(vehicle); setDialogOpen(true); }}><Edit3 className="size-4" /> Sửa</Button><Button size="sm" variant="ghost" onClick={() => setQrVehicle(vehicle)}><QrCode className="size-4" /> QR</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => toggleActive(vehicle)}>{vehicle.isActive ? "Ngừng" : "Kích hoạt"}</Button></div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 md:hidden">
                {vehicles.map((vehicle) => (
                  <article key={vehicle.id} className={`rounded-xl border p-4 ${vehicle.isActive ? "bg-card" : "bg-muted/30 opacity-75"}`}>
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-lg font-bold">{vehicle.code}</p><p className="truncate text-sm text-muted-foreground">{vehicle.name}</p></div><Badge variant={vehicle.isActive ? "success" : "neutral"}>{vehicle.isActive ? "Hoạt động" : "Đã ngừng"}</Badge></div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Loại xe</p><p>{VEHICLE_TYPE_LABELS[vehicle.type]}</p></div><div><p className="text-xs text-muted-foreground">Nhiên liệu</p><p>{vehicle.fuelTypeName ?? "Chưa thiết lập"}</p></div><div className="flex gap-1"><MapPin className="mt-0.5 size-4 text-muted-foreground" /><span>{vehicle.zoneName ?? "Chưa phân khu"}</span></div><div className="flex gap-1"><Gauge className="mt-0.5 size-4 text-muted-foreground" /><span>{vehicle.currentOdo.toLocaleString("vi-VN")} {vehicle.odoUnit === "km" ? "km" : "giờ"}</span></div></div>
                    <div className="mt-4 grid grid-cols-3 gap-2"><Button size="sm" variant="outline" onClick={() => { setEditing(vehicle); setDialogOpen(true); }}><Edit3 className="size-4" /> Sửa</Button><Button size="sm" variant="outline" onClick={() => setQrVehicle(vehicle)}><QrCode className="size-4" /> QR</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => toggleActive(vehicle)}>{vehicle.isActive ? "Ngừng" : "Bật"}</Button></div>
                  </article>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Pagination basePath="/admin/vehicles" page={page} totalPages={totalPages} params={filters} />
      <VehicleDialog open={dialogOpen} onOpenChange={setDialogOpen} vehicle={editing} fuelTypes={fuelTypes} zones={zones} subZones={subZones} onSaved={() => router.refresh()} />
      <VehicleQrModal vehicle={qrVehicle} open={Boolean(qrVehicle)} onOpenChange={(open) => !open && setQrVehicle(null)} />
    </div>
  );
}
