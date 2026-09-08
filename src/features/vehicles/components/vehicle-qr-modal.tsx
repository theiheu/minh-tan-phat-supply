"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Image as ImageIcon, Loader2, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getVehicleQrScanUrl } from "@/lib/fuel";

export interface VehicleQrSummary {
  id: string;
  code: string;
  name: string;
  qrToken: string;
  fuelTypeName: string | null;
  zoneName: string | null;
}

export function VehicleQrModal({
  vehicle,
  open,
  onOpenChange,
}: {
  vehicle: VehicleQrSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!vehicle || !open) return;
    setGenerating(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const scanUrl = getVehicleQrScanUrl(vehicle.qrToken, origin);
    QRCode.toDataURL(scanUrl, {
      margin: 1,
      width: 400,
      color: {
        dark: "#0b2015",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating QR:", err))
      .finally(() => setGenerating(false));
  }, [vehicle, open]);

  if (!vehicle) return null;

  const pdfUrl = `/api/vehicles/${vehicle.id}/qr`;

  function downloadQrPng() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR-${vehicle?.code || "xe"}.png`;
    a.click();
  }

  function handlePrintDecal() {
    window.open(pdfUrl, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <QrCode className="size-5 text-emerald-600" />
            Tem QR định danh phương tiện
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tem dán buồng lái xe hoặc thân máy móc. Quét mã này tại trạm bơm để nạp thông tin cấp dầu tự động.
          </DialogDescription>
        </DialogHeader>

        {/* Visual Decal Sticker Preview (Rendered natively in HTML) */}
        <div className="flex flex-col items-center justify-center p-2">
          <div className="w-full max-w-[380px] overflow-hidden rounded-xl border-2 border-emerald-700 bg-white p-3.5 shadow-xl text-emerald-950 dark:bg-white dark:text-emerald-950">
            {/* Decal Header */}
            <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  TRẠI LÊ VĂN DƯƠNG
                </p>
                <p className="text-[8px] font-semibold tracking-wide text-emerald-600">
                  QUẢN LÝ NHIÊN LIỆU & DẦU
                </p>
              </div>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                TEM XE
              </span>
            </div>

            {/* Decal Body: QR Code + Details */}
            <div className="mt-3 grid grid-cols-[105px_1fr] items-center gap-3">
              {/* QR Code Container */}
              <div className="flex size-[105px] items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/50 p-1 shrink-0">
                {generating || !qrDataUrl ? (
                  <Loader2 className="size-8 animate-spin text-emerald-600" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt={`Mã QR ${vehicle.code}`}
                    className="size-full object-contain"
                  />
                )}
              </div>

              {/* Vehicle Metadata */}
              <div className="space-y-1.5 text-left min-w-0">
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-wider text-emerald-700 font-semibold">
                    BIỂN SỐ / MÃ MÁY
                  </p>
                  <p className="text-xl font-black tracking-tight text-emerald-950 truncate">
                    {vehicle.code}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-wider text-emerald-700 font-semibold">
                    TÊN PHƯƠNG TIỆN
                  </p>
                  <p className="text-xs font-bold text-emerald-900 line-clamp-2 break-words leading-tight">
                    {vehicle.name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-emerald-800 pt-0.5">
                  <div className="min-w-0">
                    <span className="text-[8px] text-emerald-600 block">NHIÊN LIỆU</span>
                    <span className="font-semibold truncate block">{vehicle.fuelTypeName || "Dầu DO"}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[8px] text-emerald-600 block">KHU VỰC</span>
                    <span className="font-semibold truncate block">{vehicle.zoneName || "Chung"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Decal Footer */}
            <div className="mt-3 border-t border-dashed border-emerald-200 pt-1.5 text-center">
              <p className="text-[8px] font-medium text-emerald-600">
                📱 Quét mã khi lấy dầu tại vòi bơm để ghi nhận số lít & Odo
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadQrPng} className="gap-1.5 text-xs">
              <ImageIcon className="size-3.5" />
              Tải ảnh PNG
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
              <a href={pdfUrl} download={`${vehicle.code}-tem-qr.pdf`}>
                <Download className="size-3.5" />
                Tải file PDF
              </a>
            </Button>
            <Button type="button" size="sm" onClick={handlePrintDecal} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
              <Printer className="size-3.5" />
              In tem Decal
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
