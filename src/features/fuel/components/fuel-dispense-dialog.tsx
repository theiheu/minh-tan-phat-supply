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
import { ZoomableImage } from "@/components/image-lightbox";
import { calcConsumptionRate, calcUsageDiff, formatConsumptionRate, formatFuelLiters, formatOdo } from "@/lib/fuel";
import { createFuelDispenseAction } from "../actions";
import { uploadFuelImage } from "../upload";
import type { FuelType } from "../types";

export interface VehicleSelection {
  id: string;
  code: string;
  name: string;
  current_odo: number;
  odo_unit: "km" | "hours";
  default_driver: string | null;
  fuel_type_id: string | null;
  zone_id: string | null;
}

export function FuelDispenseDialog({
  fuelTypes,
  vehicles,
  zones,
  onSaved,
}: {
  fuelTypes: FuelType[];
  vehicles: VehicleSelection[];
  zones: { id: string; name: string }[];
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [vehicleId, setVehicleId] = useState("none");
  const [zoneId, setZoneId] = useState("none");
  const [fuelTypeId, setFuelTypeId] = useState(fuelTypes[0]?.id || "");
  const [quantity, setQuantity] = useState("");
  const [currentOdo, setCurrentOdo] = useState("");
  const [driverName, setDriverName] = useState("");
  const [meterImages, setMeterImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [notes, setNotes] = useState("");

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  // Auto-fill when vehicle changes
  useEffect(() => {
    if (selectedVehicle) {
      if (selectedVehicle.fuel_type_id) {
        setFuelTypeId(selectedVehicle.fuel_type_id);
      }
      if (selectedVehicle.zone_id) {
        setZoneId(selectedVehicle.zone_id);
      }
      if (selectedVehicle.default_driver) {
        setDriverName(selectedVehicle.default_driver);
      }
      setCurrentOdo(String(selectedVehicle.current_odo ?? 0));
    }
  }, [selectedVehicle]);

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

    startTransition(async () => {
      try {
        await createFuelDispenseAction({
          vehicleId: vehicleId === "none" ? null : vehicleId,
          zoneId: zoneId === "none" ? null : zoneId,
          fuelTypeId,
          quantity: numQty,
          currentOdo: selectedVehicle ? numOdo : null,
          driverName: driverName.trim() ? driverName.trim() : undefined,
          meterImages,
          notes: notes.trim() ? notes.trim() : undefined,
        });

        toast.success("Đã hoàn tất cấp phát dầu");
        setOpen(false);
        // Reset form
        setVehicleId("none");
        setZoneId("none");
        setQuantity("");
        setCurrentOdo("");
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cấp phát dầu cho Phương tiện / Khu vực</DialogTitle>
          <DialogDescription>
            Ghi nhận xuất dầu chạy xe hoặc máy móc công trình. Tồn kho sẽ tự động giảm.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2 min-w-0">
              <Label htmlFor="vehicleId" className="text-xs font-semibold">
                Phương tiện / Xe nhận dầu
              </Label>
              <Select value={vehicleId} onValueChange={setVehicleId} disabled={pending}>
                <SelectTrigger id="vehicleId" className="w-full">
                  <SelectValue placeholder="Chọn xe / máy móc" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Không chọn xe (Cấp cho khu vực/máy khác) --</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.code} - {v.name} (Odo: {formatOdo(v.current_odo, v.odo_unit)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="fuelTypeId" className="text-xs font-semibold">
                Loại dầu cấp <span className="text-destructive">*</span>
              </Label>
              <Select value={fuelTypeId} onValueChange={setFuelTypeId} disabled={pending}>
                <SelectTrigger id="fuelTypeId" className="w-full">
                  <SelectValue placeholder="Chọn loại dầu" />
                </SelectTrigger>
                <SelectContent>
                  {fuelTypes.map((ft) => (
                    <SelectItem key={ft.id} value={ft.id}>
                      {ft.name} (Tồn: {formatFuelLiters(ft.current_stock)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="zoneId" className="text-xs font-semibold">Khu vực / Công trình</Label>
              <Select value={zoneId} onValueChange={setZoneId} disabled={pending}>
                <SelectTrigger id="zoneId" className="w-full">
                  <SelectValue placeholder="Chọn khu vực" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Không chọn --</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="driverName" className="text-xs font-semibold">Tài xế / Người nhận</Label>
              <Input
                id="driverName"
                placeholder="VD: Nguyễn Văn A"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
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

          <DialogFooter>
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
