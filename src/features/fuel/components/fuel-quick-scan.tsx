"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, Fuel, Gauge, ImagePlus, Loader2, MapPin, Printer, QrCode, RotateCcw, Trash2, Truck, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ZoomableImage } from "@/components/image-lightbox";
import { calcConsumptionRate, calcUsageDiff, formatConsumptionRate, formatFuelLiters, formatOdo, parseQrText } from "@/lib/fuel";
import { createFuelDispenseAction, getVehicleByQrAction } from "../actions";
import { uploadFuelImage } from "../upload";
import { QrCameraScanner } from "./qr-camera-scanner";
import type { FuelType } from "../types";

export interface VehicleScanResult {
  id: string;
  code: string;
  name: string;
  type: string;
  zone_id: string | null;
  zone_name: string | null;
  default_driver: string | null;
  fuel_type_id: string;
  fuel_type_name: string;
  fuel_type_code: string;
  fuel_unit: string;
  current_odo: number;
  odo_unit: "km" | "hours";
  fuel_norm: number | null;
  qr_token: string;
  is_active: boolean;
  last_dispense?: {
    code: string;
    quantity: number;
    current_odo: number;
    consumption_rate: number | null;
    created_at: string;
  } | null;
}

export function FuelQuickScan({
  fuelTypes,
}: {
  fuelTypes: FuelType[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // State: 'scanning' | 'dispensing' | 'completed'
  const [step, setStep] = useState<"scanning" | "dispensing" | "completed">("scanning");
  const [vehicle, setVehicle] = useState<VehicleScanResult | null>(null);
  const [searching, setSearching] = useState(false);

  // Form values
  const [quantity, setQuantity] = useState("");
  const [currentOdo, setCurrentOdo] = useState("");
  const [driverName, setDriverName] = useState("");
  const [meterImages, setMeterImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [notes, setNotes] = useState("");

  // Completed result
  const [createdSlip, setCreatedSlip] = useState<{ id: string; code: string; liters: number } | null>(null);

  async function handleScan(qrText: string) {
    if (searching || step !== "scanning") return;
    setSearching(true);

    try {
      const parsed = parseQrText(qrText);
      const res = await getVehicleByQrAction(parsed.value);

      if (!res) {
        toast.error(`Không tìm thấy phương tiện với mã "${qrText}"`);
        setSearching(false);
        return;
      }

      const veh = res as unknown as VehicleScanResult;
      setVehicle(veh);
      setCurrentOdo(String(veh.current_odo ?? 0));
      setDriverName(veh.default_driver ?? "");
      setQuantity("");
      setMeterImages([]);
      setNotes("");
      setStep("dispensing");
      toast.success(`Đã nhận diện: ${veh.code} - ${veh.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi khi tra cứu mã QR");
    } finally {
      setSearching(false);
    }
  }

  const numQty = Math.max(0, Number(quantity) || 0);
  const numOdo = Number(currentOdo) || 0;
  const prevOdo = vehicle ? Number(vehicle.current_odo) : 0;
  const odoUnit = vehicle?.odo_unit ?? "km";
  const usageDiff = vehicle ? calcUsageDiff(numOdo, prevOdo) : 0;
  const consumptionRate = vehicle ? calcConsumptionRate(numQty, usageDiff, odoUnit) : null;

  function addQuickLiters(amount: number) {
    const cur = Number(quantity) || 0;
    setQuantity(String(cur + amount));
  }

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
      toast.success(`Đã đính kèm ${urls.length} ảnh`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lỗi tải ảnh");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicle) return;

    if (numQty <= 0) {
      toast.error("Vui lòng nhập số lít dầu lấy");
      return;
    }

    startTransition(async () => {
      try {
        const id = await createFuelDispenseAction({
          vehicleId: vehicle.id,
          zoneId: vehicle.zone_id,
          fuelTypeId: vehicle.fuel_type_id,
          quantity: numQty,
          currentOdo: numOdo,
          driverName: driverName.trim() ? driverName.trim() : undefined,
          meterImages,
          notes: notes.trim() ? notes.trim() : undefined,
        });

        setCreatedSlip({ id, code: "Đã tạo phiếu", liters: numQty });
        setStep("completed");
        toast.success(`Cấp phát thành công ${numQty} Lít cho xe ${vehicle.code}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lỗi khi xác nhận cấp dầu");
      }
    });
  }

  function resetToScan() {
    setVehicle(null);
    setCreatedSlip(null);
    setQuantity("");
    setCurrentOdo("");
    setDriverName("");
    setMeterImages([]);
    setNotes("");
    setStep("scanning");
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 px-2 py-3">
      {/* Header back button */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/fuel">
            <ChevronLeft className="mr-1 size-4" />
            Quay lại Kho Dầu
          </Link>
        </Button>
        <span className="text-xs font-semibold text-primary">TRẠM CẤP NHIÊN LIỆU</span>
      </div>

      {/* STEP 1: SCANNING */}
      {step === "scanning" && (
        <Card className="border-2 shadow-lg">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-bold flex items-center justify-center gap-2">
              <QrCode className="size-6 text-emerald-600" />
              Quét mã QR Xe / Thiết bị
            </CardTitle>
            <CardDescription>
              Đưa camera vào tem mã QR dán trên xe để tự động nhận diện và nạp thông tin
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {searching ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
                <Loader2 className="size-10 animate-spin text-primary" />
                <p className="text-sm font-medium">Đang nhận diện phương tiện...</p>
              </div>
            ) : (
              <QrCameraScanner onScan={handleScan} />
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 2: DISPENSING FORM */}
      {step === "dispensing" && vehicle && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vehicle Info Badge Card */}
          <Card className="border-emerald-500/50 bg-emerald-500/5 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black tracking-tight text-foreground">
                      {vehicle.code}
                    </span>
                    <Badge variant="success" className="text-xs">
                      {vehicle.fuel_type_name}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{vehicle.name}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetToScan}
                  className="text-xs gap-1"
                >
                  <RotateCcw className="size-3.5" /> Quét lại
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-emerald-500/20 pt-2.5 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="size-3.5" />
                  <span>Khu vực: <b>{vehicle.zone_name ?? "Chung"}</b></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Gauge className="size-3.5" />
                  <span>Odo cũ: <b>{formatOdo(prevOdo, odoUnit)}</b></span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 1-Step Form Inputs */}
          <Card className="border-2 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Fuel className="size-5 text-primary" />
                Nhập số lượng dầu vừa bơm
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Liters Input & Quick Chips */}
              <div className="space-y-2">
                <Label htmlFor="liters" className="text-xs font-bold uppercase tracking-wider text-primary">
                  Số lít dầu đã lấy (Lít) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="liters"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-14 text-2xl font-black pr-14 text-center text-primary"
                    autoFocus
                    required
                    disabled={pending}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                    LÍT
                  </span>
                </div>

                {/* Quick Add Chips */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {[20, 50, 100, 150, 200].map((amt) => (
                    <Button
                      key={amt}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => addQuickLiters(amt)}
                      className="h-8 text-xs font-semibold"
                    >
                      +{amt}L
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity("")}
                    className="h-8 text-xs text-muted-foreground ml-auto"
                  >
                    Xóa số
                  </Button>
                </div>
              </div>

              {/* Odo Input & Difference Calculation */}
              <div className="space-y-1.5 border-t pt-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="currentOdo" className="text-xs font-bold">
                    Số Odo / Giờ máy mới ({odoUnit})
                  </Label>
                  <span className="text-xs text-muted-foreground font-mono">
                    Lần trước: {formatOdo(prevOdo, odoUnit)}
                  </span>
                </div>
                <Input
                  id="currentOdo"
                  type="number"
                  step="0.01"
                  min={prevOdo}
                  placeholder={`VD: ${prevOdo + 100}`}
                  value={currentOdo}
                  onChange={(e) => setCurrentOdo(e.target.value)}
                  className="h-11 font-mono font-medium"
                  disabled={pending}
                />
                {usageDiff > 0 && (
                  <div className="rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <p className="font-semibold">
                      🚀 Chạy thêm: +{formatOdo(usageDiff, odoUnit)}
                    </p>
                    <p className="text-[11px] mt-0.5">
                      Tiêu hao đo được: <b>{formatConsumptionRate(consumptionRate, odoUnit)}</b>
                      {vehicle.fuel_norm != null && (
                        <span className="text-muted-foreground ml-1.5">
                          (Định mức: {formatConsumptionRate(vehicle.fuel_norm, odoUnit)})
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Driver Name */}
              <div className="space-y-1.5">
                <Label htmlFor="driver" className="text-xs font-semibold">Tài xế / Người lái</Label>
                <Input
                  id="driver"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Tên người nhận dầu"
                  className="h-10"
                  disabled={pending}
                />
              </div>

              {/* Photo Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ảnh đồng hồ bơm / Odo xe (Tùy chọn)</Label>
                <div className="flex flex-wrap gap-2">
                  {meterImages.map((img, idx) => (
                    <div key={idx} className="relative size-14 overflow-hidden rounded-lg border">
                      <ZoomableImage src={img} images={meterImages} alt="Ảnh" className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setMeterImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-0.5 right-0.5 rounded-full bg-destructive p-0.5 text-white"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex size-14 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed hover:bg-muted">
                    <ImagePlus className="size-4 text-muted-foreground" />
                    <span className="mt-0.5 text-[9px] text-muted-foreground">Chụp/Chọn</span>
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

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-semibold">Ghi chú</Label>
                <Textarea
                  id="notes"
                  placeholder="Ghi chú thêm nếu có..."
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={pending}
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-2 pt-2">
              <Button
                type="submit"
                size="lg"
                className="w-full h-13 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
                disabled={pending || uploadingImage}
              >
                {pending ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" />
                    Đang lưu cấp dầu...
                  </>
                ) : (
                  `✅ XÁC NHẬN CẤP ${numQty > 0 ? `${numQty}L ` : ""}DẦU`
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetToScan}
                className="w-full text-xs text-muted-foreground"
                disabled={pending}
              >
                Hủy và quét xe khác
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}

      {/* STEP 3: SUCCESS CONFIRMATION */}
      {step === "completed" && vehicle && createdSlip && (
        <Card className="border-2 border-emerald-500 text-center shadow-xl">
          <CardHeader className="pb-3 pt-6">
            <div className="mx-auto mb-2 flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-10" />
            </div>
            <CardTitle className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              CẤP DẦU THÀNH CÔNG!
            </CardTitle>
            <CardDescription className="text-sm">
              Đã ghi nhận cấp phát <b>{formatFuelLiters(createdSlip.liters)}</b> cho xe <b>{vehicle.code}</b>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-6 text-sm">
            <div className="rounded-xl border bg-muted/40 p-4 text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phương tiện:</span>
                <span className="font-bold">{vehicle.code} - {vehicle.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số lượng cấp:</span>
                <span className="font-bold text-primary">{formatFuelLiters(createdSlip.liters)}</span>
              </div>
              {numOdo > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chỉ số Odo mới:</span>
                  <span className="font-mono font-medium">{formatOdo(numOdo, odoUnit)}</span>
                </div>
              )}
              {driverName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Người nhận:</span>
                  <span>{driverName}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                size="lg"
                onClick={resetToScan}
                className="h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-2"
              >
                <QrCode className="size-5" />
                Quét xe tiếp theo
              </Button>
              <div className="flex gap-2">
                <Button asChild variant="outline" className="flex-1 h-10 gap-1.5">
                  <a href={`/api/fuel/dispenses/${createdSlip.id}/pdf`} target="_blank" rel="noreferrer">
                    <Printer className="size-4" />
                    In phiếu cấp
                  </a>
                </Button>
                <Button asChild variant="secondary" className="flex-1 h-10">
                  <Link href="/fuel?tab=dispenses">
                    Xem danh sách
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
