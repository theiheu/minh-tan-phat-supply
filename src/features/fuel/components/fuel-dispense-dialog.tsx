"use client";

import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ZoneSubZoneSelect } from "@/components/zone-sub-zone-select";
import { ZoomableImage } from "@/components/image-lightbox";
import { calcConsumptionRate, calcUsageDiff, formatConsumptionRate, formatFuelQuantity, formatOdo } from "@/lib/fuel";
import { createFuelDispenseAction, getActiveDriverAccounts } from "../actions";
import { uploadFuelImage } from "../upload";
import type { FuelType } from "../types";
import { DriverAccountSelect, type DriverAccountOption } from "./driver-account-select";
import { FuelTypeDialog } from "./fuel-type-dialog";

export interface VehicleSelection {
  id: string;
  code: string;
  name: string;
  current_odo: number;
  odo_unit: "km" | "hours";
  default_driver: string | null;
  fuel_type_id: string | null;
  zone_id: string | null;
  sub_zone_id?: string | null;
}

export function FuelDispenseDialog({
  fuelTypes,
  vehicles,
  zones,
  subZones = [],
  onSaved,
}: {
  fuelTypes: FuelType[];
  vehicles: VehicleSelection[];
  zones: { id: string; name: string }[];
  subZones?: { id: string; zone_id: string; name: string }[];
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [dispenseType, setDispenseType] = useState<"vehicle" | "zone">("vehicle");
  const [vehicleId, setVehicleId] = useState("none");
  const [zoneId, setZoneId] = useState("none");
  const [subZoneId, setSubZoneId] = useState("");
  const [fuelTypeId, setFuelTypeId] = useState(fuelTypes[0]?.id || "");
  const [quantity, setQuantity] = useState("");
  const [currentOdo, setCurrentOdo] = useState("");
  const [driverId, setDriverId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [drivers, setDrivers] = useState<DriverAccountOption[]>([]);
  const [meterImages, setMeterImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [notes, setNotes] = useState("");

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  useEffect(() => {
    if (open) {
      getActiveDriverAccounts()
        .then(setDrivers)
        .catch((err) => console.warn("[FuelDispenseDialog] Không thể nạp danh sách tài xế:", err));
    }
  }, [open]);

  // Auto-fill when vehicle changes
  useEffect(() => {
    if (selectedVehicle) {
      if (selectedVehicle.fuel_type_id) {
        setFuelTypeId(selectedVehicle.fuel_type_id);
      }
      if (selectedVehicle.zone_id) {
        setZoneId(selectedVehicle.zone_id);
      }
      if (selectedVehicle.sub_zone_id) {
        setSubZoneId(selectedVehicle.sub_zone_id);
      }
      if (selectedVehicle.default_driver) {
        setDriverName(selectedVehicle.default_driver);
        const matched = drivers.find((d) => d.name === selectedVehicle.default_driver);
        if (matched) setDriverId(matched.id);
      }
      setCurrentOdo(String(selectedVehicle.current_odo ?? 0));
    }
  }, [selectedVehicle, drivers]);

  const numQty = Math.max(0, Number(quantity) || 0);
  const numOdo = Number(currentOdo) || 0;
  const prevOdo = selectedVehicle ? Number(selectedVehicle.current_odo) : 0;
  const odoUnit = selectedVehicle?.odo_unit ?? "km";
  const usageDiff = selectedVehicle ? calcUsageDiff(numOdo, prevOdo) : 0;
  const consumptionRate = selectedVehicle ? calcConsumptionRate(numQty, usageDiff, odoUnit) : null;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImage(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadFuelImage(file);
        urls.push(url);
      }
      setMeterImages((prev) => [...prev, ...urls]);
      toast.success(`Đã tải lên ${urls.length} ảnh`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lỗi khi tải ảnh lên");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  function removeImage(index: number) {
    setMeterImages((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!fuelTypeId) {
      toast.error("Vui lòng chọn loại dầu cấp phát");
      return;
    }
    if (numQty <= 0) {
      toast.error("Số lượng cấp phát phải lớn hơn 0");
      return;
    }

    if (dispenseType === "zone" && (zoneId === "none" || !zoneId)) {
      toast.error("Vui lòng chọn khu vực nhận dầu");
      return;
    }

    if (dispenseType === "vehicle" && (vehicleId === "none" || !vehicleId)) {
      toast.error("Vui lòng chọn phương tiện nhận dầu");
      return;
    }

    startTransition(async () => {
      try {
        await createFuelDispenseAction({
          vehicleId: vehicleId === "none" ? null : vehicleId,
          zoneId: zoneId === "none" ? null : zoneId,
          subZoneId: zoneId === "none" ? null : (subZoneId || null),
          dispenseType,
          fuelTypeId,
          quantity: numQty,
          currentOdo: dispenseType === "vehicle" && selectedVehicle ? numOdo : null,
          driverId: driverId === "custom" || !driverId ? null : driverId,
          driverName: driverName.trim() ? driverName.trim() : undefined,
          meterImages,
          notes: notes.trim() ? notes.trim() : undefined,
        });

        toast.success("Đã hoàn tất cấp phát dầu");
        setOpen(false);
        // Reset form
        setVehicleId("none");
        setZoneId("none");
        setSubZoneId("");
        setQuantity("");
        setCurrentOdo("");
        setDriverId("");
        setDriverName("");
        setMeterImages([]);
        setNotes("");
        onSaved?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Lỗi khi cấp phát dầu");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="text-xs sm:text-sm h-9">
          <Plus className="mr-1.5 size-3.5 sm:size-4" />
          Cấp dầu
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Cấp phát dầu cho Phương tiện / Khu vực</DialogTitle>
            <DialogDescription>
              Ghi nhận xuất dầu chạy xe hoặc máy móc công trình. Tồn kho sẽ tự động giảm.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto py-3 overscroll-contain">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Dispense Type Segmented Toggle */}
            <div className="space-y-1.5 sm:col-span-2 min-w-0">
              <Label className="text-xs font-semibold">
                Hình thức cấp phát <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDispenseType("vehicle")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    dispenseType === "vehicle"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  🚗 Cấp cho xe
                </button>
                <button
                  type="button"
                  onClick={() => setDispenseType("zone")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    dispenseType === "zone"
                      ? "border-amber-600 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  🏭 Cấp cho toàn khu
                </button>
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2 min-w-0">
              <Label htmlFor="vehicleId" className="text-xs font-semibold">
                {dispenseType === "zone" ? "Phương tiện đến lấy / chở dầu (Tùy chọn)" : "Phương tiện / Xe nhận dầu"} {dispenseType === "vehicle" && <span className="text-destructive">*</span>}
              </Label>
              <Select value={vehicleId} onValueChange={setVehicleId} disabled={pending}>
                <SelectTrigger id="vehicleId" className="w-full">
                  <SelectValue placeholder={dispenseType === "zone" ? "-- Không chọn xe (Nhận trực tiếp tại kho) --" : "Chọn xe / máy móc"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{dispenseType === "zone" ? "-- Không gán xe --" : "-- Chọn xe --"}</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.code} - {v.name} (Odo: {formatOdo(v.current_odo, v.odo_unit)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between">
                <Label htmlFor="fuelTypeId" className="text-xs font-semibold">
                  Loại nhiên liệu / Dầu cấp <span className="text-destructive">*</span>
                </Label>
                <FuelTypeDialog
                  mode="create"
                  trigger={
                    <button
                      type="button"
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 font-medium"
                    >
                      <Plus className="size-3" /> Thêm loại mới
                    </button>
                  }
                  onSaved={(newType) => setFuelTypeId(newType.id)}
                />
              </div>
              <Select value={fuelTypeId} onValueChange={setFuelTypeId} disabled={pending}>
                <SelectTrigger id="fuelTypeId" className="w-full">
                  <SelectValue placeholder={fuelTypes.length === 0 ? "Chưa có loại dầu nào — Bấm Thêm mới" : "Chọn loại dầu"} />
                </SelectTrigger>
                <SelectContent>
                  {fuelTypes.map((ft) => (
                    <SelectItem key={ft.id} value={ft.id}>
                      {ft.name} (Tồn: {formatFuelQuantity(Number(ft.current_stock), ft.unit)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fuelTypes.length === 0 && (
                <p className="text-[11px] text-destructive">
                  Chưa có loại nhiên liệu nào. Vui lòng bấm &quot;+ Thêm loại mới&quot; ở trên để tạo.
                </p>
              )}
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="quantity" className="text-xs font-semibold">
                Số lượng cấp (Lít) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="VD: 150.5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={pending}
                required
              />
            </div>

            <div className="sm:col-span-2 min-w-0">
              <DriverAccountSelect
                drivers={drivers}
                driverId={driverId}
                driverName={driverName}
                onDriverChange={(id, name) => {
                  setDriverId(id);
                  setDriverName(name);
                }}
                disabled={pending}
              />
            </div>

            <div className="sm:col-span-2 min-w-0">
              <ZoneSubZoneSelect
                zones={zones}
                subZones={subZones}
                zoneId={zoneId === "none" ? "" : zoneId}
                subZoneId={subZoneId}
                onZoneChange={(zid) => {
                  setZoneId(zid || "none");
                  setSubZoneId("");
                }}
                onSubZoneChange={setSubZoneId}
                zoneLabel="Khu vực / Công trình"
                subZoneLabel="Trại / Phân xưởng"
                zonePlaceholder="-- Không chọn --"
                subZonePlaceholder="Chọn trại/xưởng (tùy chọn)"
                required={false}
                disabled={pending}
              />
            </div>

            {selectedVehicle && (
              <div className="space-y-1.5 sm:col-span-2 min-w-0">
                <div className="flex items-center justify-between">
                  <Label htmlFor="currentOdo" className="text-xs font-semibold">
                    Chỉ số Odo / Giờ máy mới ({odoUnit})
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Lần trước: {formatOdo(prevOdo, odoUnit)}
                  </span>
                </div>
                <Input
                  id="currentOdo"
                  type="number"
                  step="0.01"
                  min={prevOdo}
                  value={currentOdo}
                  onChange={(e) => setCurrentOdo(e.target.value)}
                  disabled={pending}
                />
                {usageDiff > 0 && (
                  <p className="text-xs text-primary font-medium">
                    ⚡ Hoạt động: +{formatOdo(usageDiff, odoUnit)} · Mức tiêu hao:{" "}
                    {formatConsumptionRate(consumptionRate, odoUnit)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2 min-w-0">
              <Label className="text-xs font-semibold">Ảnh đồng hồ bơm / Odo xe</Label>
              <div className="flex flex-wrap gap-2">
                {meterImages.map((img, idx) => (
                  <div key={idx} className="relative size-16 overflow-hidden rounded-lg border">
                    <ZoomableImage
                      src={img}
                      images={meterImages}
                      alt="Đồng hồ"
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 rounded-full bg-destructive p-0.5 text-white"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
                <label className="flex size-16 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed hover:bg-muted">
                  <ImagePlus className="size-5 text-muted-foreground" />
                  <span className="mt-1 text-[10px] text-muted-foreground">Thêm ảnh</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploadingImage || pending}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2 min-w-0">
              <Label htmlFor="notes" className="text-xs font-semibold">Ghi chú</Label>
              <Textarea
                id="notes"
                placeholder="Ghi chú thêm về lần cấp dầu..."
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending || uploadingImage}>
              {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Xác nhận cấp dầu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
