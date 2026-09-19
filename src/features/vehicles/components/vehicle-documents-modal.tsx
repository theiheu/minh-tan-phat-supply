"use client";

import { useEffect, useState, useTransition } from "react";
import { FileText, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ZoomableImage } from "@/components/image-lightbox";
import { uploadVehicleDocumentImage } from "../upload";
import { updateVehicleDocumentsAction } from "../actions";

export interface VehicleDocumentsSummary {
  id: string;
  code: string;
  name: string;
  documentImages?: string[];
}

export function VehicleDocumentsModal({
  vehicle,
  open,
  onOpenChange,
  onImagesUpdated,
}: {
  vehicle: VehicleDocumentsSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImagesUpdated?: (newImages: string[]) => void;
}) {
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open && vehicle) {
      setImages(vehicle.documentImages ?? []);
    }
  }, [open, vehicle]);

  if (!vehicle) return null;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!vehicle) return;
    const vehicleId = vehicle.id;
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls = await Promise.all(
        files.map((f) => uploadVehicleDocumentImage(f))
      );
      const nextImages = [...images, ...uploadedUrls];
      setImages(nextImages);

      startTransition(async () => {
        try {
          await updateVehicleDocumentsAction(vehicleId, nextImages);
          toast.success(`Đã tải lên ${uploadedUrls.length} ảnh giấy tờ xe thành công`);
          onImagesUpdated?.(nextImages);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Cập nhật ảnh giấy tờ thất bại");
        }
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải ảnh lên thất bại");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function handleRemove(urlToRemove: string) {
    if (!vehicle) return;
    const vehicleId = vehicle.id;
    if (!window.confirm("Bạn có chắc muốn xóa ảnh giấy tờ này của xe không?")) return;
    const nextImages = images.filter((u) => u !== urlToRemove);
    setImages(nextImages);

    startTransition(async () => {
      try {
        await updateVehicleDocumentsAction(vehicleId, nextImages);
        toast.success("Đã xóa ảnh giấy tờ");
        onImagesUpdated?.(nextImages);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa ảnh thất bại");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="size-5 text-primary" />
              Ảnh giấy tờ & Hồ sơ xe: {vehicle.code}
            </DialogTitle>
            {images.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {images.length} ảnh
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs">
            Lưu trữ hình ảnh đăng ký xe (cà vẹt), sổ đăng kiểm, bảo hiểm, hợp đồng hoặc ảnh thực tế của xe {vehicle.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-3 overscroll-contain">
          {images.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center">
              <FileText className="size-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                Chưa có ảnh giấy tờ hoặc hồ sơ nào cho xe này
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                Hãy tải ảnh cà vẹt, sổ đăng kiểm hoặc ảnh xe để dễ dàng đối chiếu khi cần.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {images.map((url, idx) => (
                <div key={url} className="relative group flex flex-col items-center">
                  <ZoomableImage
                    src={url}
                    images={images}
                    alt={`Giấy tờ xe ${vehicle.code} - ${idx + 1}`}
                    title={`Giấy tờ #${idx + 1} (${vehicle.code} - ${vehicle.name})`}
                    className="size-24 sm:size-28 rounded-lg border-2 object-cover shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(url);
                    }}
                    disabled={pending || uploading}
                    className="absolute -right-1.5 -top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-colors"
                    aria-label="Xóa ảnh này"
                    title="Xóa ảnh giấy tờ này"
                  >
                    <X className="size-3.5" />
                  </button>
                  <span className="mt-1 text-[11px] text-muted-foreground truncate max-w-full">
                    Ảnh #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2">
            <Label className="cursor-pointer block">
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
                disabled={uploading || pending}
                className="w-full h-11 border-dashed gap-2 text-xs font-medium"
              >
                <span>
                  {uploading || pending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Đang xử lý tải ảnh lên…
                    </>
                  ) : (
                    <>
                      <ImagePlus className="size-4 text-primary" />
                      + Tải thêm ảnh giấy tờ / cà vẹt / đăng kiểm
                    </>
                  )}
                </span>
              </Button>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
                multiple
                className="sr-only"
                disabled={uploading || pending}
                onChange={handleUpload}
              />
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
