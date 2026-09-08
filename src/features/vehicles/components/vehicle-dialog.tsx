"use client";

import { Loader2 } from "lucide-react";
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
import { createVehicleAction, updateVehicleAction } from "../actions";
import { VEHICLE_TYPE_LABELS, type VehicleInput } from "../schema";

export interface VehicleOption {
  id: string;
  name: string;
}

export interface EditableVehicle {
  id: string;
  code: string;
  name: string;
  type: VehicleInput["type"];
  zoneId: string | null;
  defaultDriver: string | null;
  fuelTypeId: string | null;
  currentOdo: number;
  odoUnit: VehicleInput["odoUnit"];
  fuelNorm: number | null;
  notes: string | null;
}

export function VehicleDialog({
  open,
  onOpenChange,
  vehicle,
  fuelTypes,
  zones,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: EditableVehicle | null;
  fuelTypes: VehicleOption[];
  zones: VehicleOption[];
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<VehicleInput["type"]>("truck");
  const [zoneId, setZoneId] = useState<string>("none");
  const [defaultDriver, setDefaultDriver] = useState("");
  const [fuelTypeId, setFuelTypeId] = useState<string>("none");
  const [currentOdo, setCurrentOdo] = useState<string>("0");
  const [odoUnit, setOdoUnit] = useState<VehicleInput["odoUnit"]>("km");
  const [fuelNorm, setFuelNorm] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (vehicle) {
      setCode(vehicle.code);
      setName(vehicle.name);
      setType(vehicle.type);
      setZoneId(vehicle.zoneId || "none");
      setDefaultDriver(vehicle.defaultDriver || "");
      setFuelTypeId(vehicle.fuelTypeId || "none");
      setCurrentOdo(String(vehicle.currentOdo ?? 0));
      setOdoUnit(vehicle.odoUnit);
      setFuelNorm(vehicle.fuelNorm != null ? String(vehicle.fuelNorm) : "");
      setNotes(vehicle.notes || "");
    } else {
      setCode("");
      setName("");
      setType("truck");
      setZoneId("none");
      setDefaultDriver("");
      setFuelTypeId(fuelTypes[0]?.id || "none");
      setCurrentOdo("0");
      setOdoUnit("km");
      setFuelNorm("");
      setNotes("");
    }
  }, [open, vehicle, fuelTypes]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!code.trim()) {
      toast.error("Vui lòng nhập Biển số xe / Mã máy");
      return;
    }
    if (!name.trim()) {
      toast.error("Vui lòng nhập Tên phương tiện");
      return;
    }

    startTransition(async () => {
      try {
        const payload: VehicleInput = {
          code: code.trim(),
          name: name.trim(),
          type,
          zoneId: zoneId === "none" ? null : zoneId,
          defaultDriver: defaultDriver.trim() ? defaultDriver.trim() : undefined,
          fuelTypeId: fuelTypeId === "none" ? null : fuelTypeId,
          currentOdo: Number(currentOdo) || 0,
          odoUnit,
          fuelNorm: fuelNorm.trim() ? Number(fuelNorm) : null,
          notes: notes.trim() ? notes.trim() : undefined,
        };

        if (vehicle?.id) {
          await updateVehicleAction(vehicle.id, payload);
          toast.success("Đã cập nhật thông tin phương tiện");
        } else {
          await createVehicleAction(payload);
          toast.success("Đã thêm phương tiện mới");
        }

        onSaved();
        onOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Đã có lỗi xảy ra");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Chỉnh sửa phương tiện" : "Thêm phương tiện mới"}</DialogTitle>
          <DialogDescription>
            Khai báo xe, máy móc và định mức tiêu hao để quản lý cấp phát nhiên liệu.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-xs font-semibold">
                Biển số xe / Mã máy <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                placeholder="VD: 61C-123.45 hoặc MAY-XUC-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={pending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold">
                Tên phương tiện <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="VD: Xe ben Howo 4 chân"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type" className="text-xs font-semibold">Loại phương tiện</Label>
              <Select value={type} onValueChange={(v) => setType(v as VehicleInput["type"])} disabled={pending}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Chọn loại xe" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VEHICLE_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="zoneId" className="text-xs font-semibold">Khu vực / Đội xe</Label>
              <Select value={zoneId} onValueChange={setZoneId} disabled={pending}>
                <SelectTrigger id="zoneId">
                  <SelectValue placeholder="Chọn khu vực" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Không phân khu vực --</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="defaultDriver" className="text-xs font-semibold">Tài xế / Người lái chính</Label>
              <Input
                id="defaultDriver"
                placeholder="VD: Nguyễn Văn A"
                value={defaultDriver}
                onChange={(e) => setDefaultDriver(e.target.value)}
                disabled={pending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fuelTypeId" className="text-xs font-semibold">Loại dầu mặc định</Label>
              <Select value={fuelTypeId} onValueChange={setFuelTypeId} disabled={pending}>
                <SelectTrigger id="fuelTypeId">
                  <SelectValue placeholder="Chọn loại dầu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Không chọn --</SelectItem>
                  {fuelTypes.map((ft) => (
                    <SelectItem key={ft.id} value={ft.id}>
                      {ft.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="currentOdo" className="text-xs font-semibold">Chỉ số Odo / Giờ máy ban đầu</Label>
              <Input
                id="currentOdo"
                type="number"
                step="0.01"
                min="0"
                value={currentOdo}
                onChange={(e) => setCurrentOdo(e.target.value)}
                disabled={pending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="odoUnit" className="text-xs font-semibold">Đơn vị đo</Label>
              <Select value={odoUnit} onValueChange={(v) => setOdoUnit(v as VehicleInput["odoUnit"])} disabled={pending}>
                <SelectTrigger id="odoUnit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="km">Km (Kilomet - cho xe chạy đường)</SelectItem>
                  <SelectItem value="hours">Giờ (Hours - cho xe xúc, máy phát)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fuelNorm" className="text-xs font-semibold">
                Định mức tiêu hao ({odoUnit === "km" ? "Lít / 100km" : "Lít / giờ"})
              </Label>
              <Input
                id="fuelNorm"
                type="number"
                step="0.01"
                min="0"
                placeholder={odoUnit === "km" ? "VD: 35.00" : "VD: 14.50"}
                value={fuelNorm}
                onChange={(e) => setFuelNorm(e.target.value)}
                disabled={pending}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes" className="text-xs font-semibold">Ghi chú</Label>
              <Textarea
                id="notes"
                placeholder="Thông tin thêm về phương tiện..."
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              {vehicle ? "Lưu thay đổi" : "Thêm phương tiện"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
