"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ImagePlus, Loader2, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { uploadRequisitionInvoiceImage } from "../upload";
import { updateRequisitionInvoiceImages } from "../actions";
import { ZoomableImage } from "@/components/image-lightbox";
import { canDeleteInvoiceImage } from "@/lib/images";

export function RequisitionInvoices({
  requisitionId,
  requisitionCode,
  invoiceImages: initialImages = [],
  status,
  isManager = false,
  currentUser,
  requesterId,
}: {
  requisitionId: string;
  requisitionCode: string;
  invoiceImages?: string[];
  status: string;
  isManager?: boolean;
  currentUser?: { id: string; role: string; name?: string | null } | null;
  requesterId?: string | null;
}) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);

  const isOwner = currentUser?.id === requesterId;
  const canUpload = isOwner || isManager;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls = await Promise.all(files.map((f) => uploadRequisitionInvoiceImage(f)));
      setPendingImages((prev) => [...prev, ...uploadedUrls]);
      toast.info(`Đã chọn ${uploadedUrls.length} ảnh. Vui lòng bấm "Xác nhận lưu" để hoàn tất.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải ảnh lên thất bại");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function handleRemovePending(urlToRemove: string) {
    setPendingImages((prev) => prev.filter((u) => u !== urlToRemove));
  }

  function handleCancelPending() {
    setPendingImages([]);
    toast.info("Đã hủy các ảnh chưa lưu");
  }

  function handleConfirmPending() {
    if (pendingImages.length === 0) return;
    const nextImages = [...images, ...pendingImages];

    startTransition(async () => {
      try {
        await updateRequisitionInvoiceImages(requisitionId, nextImages);
        setImages(nextImages);
        const count = pendingImages.length;
        setPendingImages([]);
        toast.success(`Đã tải lên ${count} ảnh hóa đơn nhận hàng thành công`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cập nhật ảnh hóa đơn thất bại");
      }
    });
  }

  function handleRemove(urlToRemove: string) {
    if (!window.confirm("Bạn có chắc muốn xóa ảnh hóa đơn này không?")) return;
    const nextImages = images.filter((u) => u !== urlToRemove);
    setImages(nextImages);

    startTransition(async () => {
      try {
        await updateRequisitionInvoiceImages(requisitionId, nextImages);
        toast.success("Đã xóa ảnh hóa đơn");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa ảnh thất bại");
      }
    });
  }

  const allPreviewImages = [...images, ...pendingImages];
  const totalCount = images.length + pendingImages.length;

  return (
    <Card className="border-2 border-border shadow-xs rounded-xl">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              <FileText className="size-4" aria-hidden />
            </span>
            <CardTitle className="text-base font-semibold">Hóa đơn & Chứng từ nhận hàng</CardTitle>
            {totalCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {images.length} đã lưu{pendingImages.length > 0 ? ` + ${pendingImages.length} chờ xác nhận` : " ảnh"}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {status === "received"
            ? "Ảnh chụp hóa đơn VAT, phiếu xuất kho NCC hoặc biên bản giao nhận được lưu kèm phiếu chứng minh đã nhận vật tư."
            : "Nếu bạn đến lấy hàng trực tiếp tại nhà cung cấp, hãy chụp lại hóa đơn VAT / phiếu giao nhận và tải lên đây để quản kho kiểm tra và duyệt hoàn tất phiếu."}
        </p>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-start gap-2.5">
          {images.map((url, idx) => (
            <div key={url} className="relative group">
              <ZoomableImage
                src={url}
                images={allPreviewImages}
                alt={`Hóa đơn ${idx + 1}`}
                title={`Hóa đơn #${idx + 1} (${requisitionCode})`}
                className="size-20 rounded-lg border-2 object-cover shadow-sm sm:size-24"
              />
              {canDeleteInvoiceImage({
                imageUrl: url,
                currentUserId: currentUser?.id,
                userRole: currentUser?.role,
                creatorId: requesterId,
              }) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(url);
                  }}
                  disabled={pending || uploading}
                  className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-opacity"
                  aria-label="Xóa ảnh này"
                  title="Xóa ảnh hóa đơn này"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}

          {pendingImages.map((url, idx) => (
            <div key={url} className="relative group">
              <div className="relative rounded-lg border-2 border-dashed border-primary ring-2 ring-primary/20 overflow-hidden">
                <ZoomableImage
                  src={url}
                  images={allPreviewImages}
                  alt={`Ảnh mới ${idx + 1}`}
                  title={`Ảnh mới #${idx + 1} (Chờ xác nhận)`}
                  className="size-20 object-cover sm:size-24"
                />
                <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-[10px] font-medium text-white text-center py-0.5 pointer-events-none">
                  Chờ lưu
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemovePending(url);
                }}
                disabled={pending || uploading}
                className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-opacity"
                aria-label="Hủy ảnh mới này"
                title="Hủy ảnh mới này"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}

          {canUpload && (
            <Label className="cursor-pointer">
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
                disabled={uploading || pending}
                className="flex size-20 flex-col items-center justify-center gap-1 border-dashed p-0 text-[10px] sm:size-24"
              >
                <span>
                  {uploading ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Đang tải…
                    </>
                  ) : (
                    <>
                      <ImagePlus className="size-5" aria-hidden />
                      + Thêm ảnh
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
          )}
        </div>

        {pendingImages.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span>Đã chọn {pendingImages.length} ảnh mới (chưa lưu vào phiếu).</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelPending}
                disabled={pending || uploading}
                className="h-8 text-xs"
              >
                <X className="size-3.5 mr-1" />
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmPending}
                disabled={pending || uploading}
                className="h-8 text-xs font-medium"
              >
                {pending ? (
                  <>
                    <Loader2 className="size-3.5 mr-1 animate-spin" />
                    Đang lưu…
                  </>
                ) : (
                  <>
                    <Check className="size-3.5 mr-1" />
                    Xác nhận lưu ({pendingImages.length} ảnh)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
