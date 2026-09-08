"use client";

import { Download, ExternalLink, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  if (!vehicle) return null;

  const pdfUrl = `/api/vehicles/${vehicle.id}/qr`;
  const previewUrl = `${pdfUrl}#toolbar=0&navpanes=0`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><QrCode className="size-5" /> Tem QR phương tiện</DialogTitle>
          <DialogDescription>
            Mã QR chứa đúng mã nhận diện của {vehicle.code}. In trên decal 60 × 40 mm để dán tại vị trí dễ quét.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <div className="overflow-hidden rounded-lg border bg-muted/20">
            <iframe title={`Xem trước tem QR ${vehicle.code}`} src={previewUrl} className="h-[300px] w-full bg-white sm:h-[360px]" />
          </div>
          <div className="space-y-3 rounded-lg border p-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Biển số / Mã máy</p><p className="text-lg font-bold">{vehicle.code}</p></div>
            <div><p className="text-xs text-muted-foreground">Tên phương tiện</p><p className="font-medium">{vehicle.name}</p></div>
            <div><p className="text-xs text-muted-foreground">Nhiên liệu</p><p>{vehicle.fuelTypeName ?? "Chưa thiết lập"}</p></div>
            <div><p className="text-xs text-muted-foreground">Khu vực</p><p>{vehicle.zoneName ?? "Chưa phân khu"}</p></div>
            <div><p className="text-xs text-muted-foreground">Mã QR</p><code className="block break-all rounded bg-muted px-2 py-1 text-xs">{vehicle.qrToken}</code></div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <a href={pdfUrl} download={`${vehicle.code}-tem-qr.pdf`}><Download className="size-4" /> Tải PDF</a>
            </Button>
            <Button asChild variant="outline">
              <a href={pdfUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Xem PDF</a>
            </Button>
            <Button asChild>
              <a href={pdfUrl} target="_blank" rel="noreferrer"><Printer className="size-4" /> In tem QR</a>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
