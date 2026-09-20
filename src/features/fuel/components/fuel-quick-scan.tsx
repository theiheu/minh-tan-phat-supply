"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Fuel,
  Gauge,
  ImagePlus,
  Loader2,
  MapPin,
  Printer,
  QrCode,
  RotateCcw,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ZoneSubZoneSelect } from "@/components/zone-sub-zone-select";
import { ZoomableImage } from "@/components/image-lightbox";
import { cn } from "@/lib/utils";
import { formatZoneLabel } from "@/lib/format-zone";
import { calcConsumptionRate, calcUsageDiff, formatConsumptionRate, formatFuelLiters, formatOdo, parseQrText } from "@/lib/fuel";
import { createFuelDispenseAction, getActiveDriverAccounts, getVehicleByQrAction } from "../actions";
import { uploadFuelImage } from "../upload";
import { QrCameraScanner } from "./qr-camera-scanner";
import type { FuelType } from "../types";
import { DriverAccountSelect, type DriverAccountOption } from "./driver-account-select";

export interface VehicleScanResult {
  id: string;
  code: string;
  name: string;
  type: string;
  zone_id: string | null;
  sub_zone_id?: string | null;
  zone_name: string | null;
  sub_zone_name?: string | null;
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
    dispense_type?: string;
    created_at: string;
  } | null;
}

export function FuelQuickScan({
  fuelTypes = [],
  zones = [],
  subZones = [],
  initialVehicle = null,
  initialQueryParam,
}: {
  fuelTypes?: FuelType[];
  zones?: { id: string; name: string }[];
  subZones?: { id: string; zone_id: string; name: string }[];
  initialVehicle?: VehicleScanResult | null;
  initialQueryParam?: string;
}) {
  const [pending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const litersInputRef = useRef<HTMLInputElement>(null);

  // State: 'scanning' | 'dispensing' | 'completed'
  const [step, setStep] = useState<"scanning" | "dispensing" | "completed">(
    initialVehicle ? "dispensing" : "scanning"
  );
  const [vehicle, setVehicle] = useState<VehicleScanResult | null>(initialVehicle ?? null);
  const [searching, setSearching] = useState(false);

  // Form values
  const [dispenseType, setDispenseType] = useState<"vehicle" | "zone">("vehicle");
  const [zoneId, setZoneId] = useState<string>(initialVehicle?.zone_id || "");
  const [subZoneId, setSubZoneId] = useState<string>(initialVehicle?.sub_zone_id || "");
  const [quantity, setQuantity] = useState("");
  const [currentOdo, setCurrentOdo] = useState(initialVehicle ? String(initialVehicle.current_odo ?? 0) : "");
  const [driverId, setDriverId] = useState("");
  const [driverName, setDriverName] = useState(initialVehicle?.default_driver ?? "");
  const [drivers, setDrivers] = useState<DriverAccountOption[]>([]);
  const [meterImages, setMeterImages] = useState<string[]>([]);

  useEffect(() => {
    getActiveDriverAccounts()
      .then(setDrivers)
      .catch((err) => console.warn("[FuelQuickScan] Không thể nạp danh sách tài xế:", err));
  }, []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [notes, setNotes] = useState("");

  // Completed result
  const [createdSlip, setCreatedSlip] = useState<{
    id: string;
    code: string;
    liters: number;
    dispenseType: "vehicle" | "zone";
    targetZoneLabel: string;
  } | null>(null);

  const handleScan = useCallback(async (qrText: string) => {
    if (searching) return;
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
      setDispenseType("vehicle");
      setZoneId(veh.zone_id || "");
      setSubZoneId(veh.sub_zone_id || "");
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
  }, [searching]);

  // If initialQueryParam was provided but vehicle was not found on server
  useEffect(() => {
    if (initialQueryParam && !initialVehicle) {
      toast.error(`Không tìm thấy phương tiện với mã "${initialQueryParam}"`);
    }
  }, [initialQueryParam, initialVehicle]);

  // Client-side query param handling if navigated without server prefetch
  useEffect(() => {
    if (initialVehicle || vehicle) return;
    const clientParam =
      searchParams?.get("vehicle") ||
      searchParams?.get("token") ||
      searchParams?.get("code") ||
      searchParams?.get("vehicleId") ||
      searchParams?.get("v");
    if (clientParam) {
      handleScan(clientParam);
    }
  }, [searchParams, initialVehicle, vehicle, handleScan]);

  // Auto-focus the liters input when in dispensing step
  useEffect(() => {
    if (step === "dispensing") {
      const timer = setTimeout(() => {
        litersInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const numQty = Math.max(0, Number(quantity) || 0);
  const numOdo = Number(currentOdo) || 0;
  const prevOdo = vehicle ? Number(vehicle.current_odo) : 0;
  const odoUnit = vehicle?.odo_unit ?? "km";
  const usageDiff = vehicle ? calcUsageDiff(numOdo, prevOdo) : 0;
  const consumptionRate = vehicle ? calcConsumptionRate(numQty, usageDiff, odoUnit) : null;

  // Selected Zone & SubZone labels for display
  const currentZone = useMemo(() => zones.find((z) => z.id === zoneId), [zones, zoneId]);
  const currentSubZone = useMemo(() => subZones.find((s) => s.id === subZoneId), [subZones, subZoneId]);
  const currentZoneDisplay = formatZoneLabel(currentZone?.name || vehicle?.zone_name, currentSubZone?.name || vehicle?.sub_zone_name);

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

    if (dispenseType === "zone" && !zoneId && !vehicle.zone_id) {
      toast.error("Vui lòng chọn khu vực nhận dầu");
      return;
    }

    startTransition(async () => {
      try {
        const targetZoneId = dispenseType === "zone" ? (zoneId || vehicle.zone_id) : vehicle.zone_id;
        const targetSubZoneId = dispenseType === "zone" ? (subZoneId || vehicle.sub_zone_id || null) : (vehicle.sub_zone_id ?? null);

        const id = await createFuelDispenseAction({
          vehicleId: vehicle.id,
          zoneId: targetZoneId,
          subZoneId: targetSubZoneId,
          dispenseType,
          fuelTypeId: vehicle.fuel_type_id,
          quantity: numQty,
          currentOdo: dispenseType === "vehicle" ? numOdo : null,
          driverId: driverId === "custom" || !driverId ? null : driverId,
          driverName: driverName.trim() ? driverName.trim() : undefined,
          meterImages,
          notes: notes.trim() ? notes.trim() : undefined,
        });

        setCreatedSlip({
          id,
          code: "Đã tạo phiếu",
          liters: numQty,
          dispenseType,
          targetZoneLabel: currentZoneDisplay,
        });
        setStep("completed");

        if (dispenseType === "zone") {
          toast.success(`Đã cấp ${numQty} Lít dầu cho khu ${currentZoneDisplay} (Xe: ${vehicle.code})`);
        } else {
          toast.success(`Cấp phát thành công ${numQty} Lít cho xe ${vehicle.code}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lỗi khi xác nhận cấp dầu");
      }
    });
  }

  function resetToScan() {
    setVehicle(null);
    setCreatedSlip(null);
    setDispenseType("vehicle");
    setZoneId("");
    setSubZoneId("");
    setQuantity("");
    setCurrentOdo("");
    setDriverName("");
    setMeterImages([]);
    setNotes("");
    setStep("scanning");
    if (typeof window !== "undefined" && window.location.search) {
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState({}, "", url.pathname);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 px-2 py-3">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          href="/fuel"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Kho Dầu
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="text-foreground font-medium">Trạm cấp nhiên liệu</span>
      </nav>

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
                      {vehicle.fuel_type_name || fuelTypes[0]?.name || "Dầu Diesel"}
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
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate">
                    Khu trực thuộc: <b>{formatZoneLabel(vehicle.zone_name, vehicle.sub_zone_name)}</b>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Gauge className="size-3.5 shrink-0" />
                  <span>
                    Odo cũ: <b>{formatOdo(prevOdo, odoUnit)}</b>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dispense Purpose Selector */}
          <Card className="border-2 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Fuel className="size-5 text-primary" />
                Mục đích & Số lượng cấp dầu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Option Mode: Cấp cho xe vs Cấp cho khu */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Hình thức cấp phát <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDispenseType("vehicle")}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all cursor-pointer",
                      dispenseType === "vehicle"
                        ? "border-emerald-600 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 font-bold shadow-xs"
                        : "border-border bg-card text-muted-foreground hover:bg-accent/50"
                    )}
                  >
                    <Truck className={cn("size-5 mb-1.5", dispenseType === "vehicle" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
                    <span className="text-xs font-bold">Cấp cho xe</span>
                    <span className="text-[10px] font-normal text-muted-foreground mt-0.5">
                      Đổ bình xe (Tính ODO & tiêu hao)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDispenseType("zone");
                      if (!zoneId && vehicle.zone_id) setZoneId(vehicle.zone_id);
                      if (!subZoneId && vehicle.sub_zone_id) setSubZoneId(vehicle.sub_zone_id);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all cursor-pointer",
                      dispenseType === "zone"
                        ? "border-amber-600 bg-amber-500/10 text-amber-950 dark:text-amber-100 font-bold shadow-xs"
                        : "border-border bg-card text-muted-foreground hover:bg-accent/50"
                    )}
                  >
                    <Building2 className={cn("size-5 mb-1.5", dispenseType === "zone" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                    <span className="text-xs font-bold">Cấp cho toàn khu</span>
                    <span className="text-[10px] font-normal text-muted-foreground mt-0.5">
                      Tính cho khu (Xe chỉ nhận chở)
                    </span>
                  </button>
                </div>
              </div>

              {/* If "Cấp cho toàn khu" selected: show Zone selector & callout note */}
              {dispenseType === "zone" && (
                <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs">
                  <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                    <Building2 className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Cấp phát nhiên liệu cho toàn bộ một khu vực</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Dầu sẽ được tính chi phí phân bổ cho khu vực được chọn. Phương tiện <b>{vehicle.code}</b> ({driverName || "Tài xế"}) được ghi nhận là phương tiện nhận/chở dầu.
                      </p>
                    </div>
                  </div>

                  <div className="pt-1">
                    <ZoneSubZoneSelect
                      zones={zones}
                      subZones={subZones}
                      zoneId={zoneId}
                      subZoneId={subZoneId}
                      onZoneChange={(newZoneId) => {
                        setZoneId(newZoneId);
                        setSubZoneId("");
                      }}
                      onSubZoneChange={setSubZoneId}
                      zoneLabel="Khu vực nhận dầu (Mặc định là khu của xe)"
                      subZoneLabel="Trại / Phân xưởng nhận dầu"
                      required={true}
                      disabled={pending}
                    />
                  </div>
                </div>
              )}

              {/* Liters Input & Quick Chips */}
              <div className="space-y-2 border-t pt-3">
                <Label htmlFor="liters" className="text-xs font-bold uppercase tracking-wider text-primary">
                  Số lít dầu đã lấy (Lít) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    ref={litersInputRef}
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

              {/* Odo Input & Difference Calculation (Only shown when Cấp cho xe) */}
              {dispenseType === "vehicle" && (
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
              )}

              {/* Driver Account / Name */}
              <div className="border-t pt-3">
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

              {/* Photo Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ảnh đồng hồ bơm / Phiếu giao nhận (Tùy chọn)</Label>
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
                className={cn(
                  "w-full h-13 text-base font-bold text-white shadow-lg",
                  dispenseType === "zone"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
                disabled={pending || uploadingImage}
              >
                {pending ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" />
                    Đang lưu cấp dầu...
                  </>
                ) : (
                  dispenseType === "zone"
                    ? `🏭 XÁC NHẬN CẤP ${numQty > 0 ? `${numQty}L ` : ""}CHO KHU`
                    : `✅ XÁC NHẬN CẤP ${numQty > 0 ? `${numQty}L ` : ""}CHO XE`
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
              {createdSlip.dispenseType === "zone" ? (
                <>
                  Đã ghi nhận cấp <b>{formatFuelLiters(createdSlip.liters)}</b> cho khu vực <b>{createdSlip.targetZoneLabel}</b>
                </>
              ) : (
                <>
                  Đã ghi nhận cấp phát <b>{formatFuelLiters(createdSlip.liters)}</b> cho xe <b>{vehicle.code}</b>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-6 text-sm">
            <div className="rounded-xl border bg-muted/40 p-4 text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hình thức:</span>
                <Badge variant={createdSlip.dispenseType === "zone" ? "warning" : "success"} className="text-xs">
                  {createdSlip.dispenseType === "zone" ? "Cấp cho toàn khu" : "Cấp riêng cho xe"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {createdSlip.dispenseType === "zone" ? "Khu vực nhận:" : "Khu vực xe:"}
                </span>
                <span className="font-bold">{createdSlip.targetZoneLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {createdSlip.dispenseType === "zone" ? "Xe đến lấy dầu:" : "Phương tiện nhận:"}
                </span>
                <span className="font-bold">{vehicle.code} - {vehicle.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số lượng cấp:</span>
                <span className="font-bold text-primary">{formatFuelLiters(createdSlip.liters)}</span>
              </div>
              {createdSlip.dispenseType === "vehicle" && numOdo > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chỉ số Odo mới:</span>
                  <span className="font-mono font-medium">{formatOdo(numOdo, odoUnit)}</span>
                </div>
              )}
              {driverName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tài xế / Người lấy:</span>
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
