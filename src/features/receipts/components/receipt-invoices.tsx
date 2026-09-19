"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { uploadReceiptInvoiceImage } from "../upload";
import { updateReceiptInvoiceImages } from "../actions";
import { ZoomableImage } from "@/components/image-lightbox";
import { canDeleteInvoiceImage } from "@/lib/images";

export function ReceiptInvoices({
  receiptId,
  receiptCode,
  invoiceImages: initialImages = [],
  status,
  isManager = false,
  currentUser,
  creatorId,
}: {
  receiptId: string;
  receiptCode: string;
  invoiceImages?: string[];
  status: string;
  isManager?: boolean;
  currentUser?: { id: string; role: string; name?: string | null } | null;
  creatorId?: string | null;
}) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls = await Promise.all(files.map((f) => uploadReceiptInvoiceImage(f)));
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
        await updateReceiptInvoiceImages(receiptId, nextImages);
        setImages(nextImages);
        const count = pendingImages.length;
        setPendingImages([]);
        toast.success(`Đã bổ sung ${count} ảnh hóa đơn mua hàng thành công`);
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
        await updateReceiptInvoiceImages(receiptId, nextImages);
        toast.success("Đã xóa ảnh hóa đơn");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa ảnh thất bại");
      }
    });
  }

  const allPreviewImages = [...images, ...pendingImages];
  const totalCount = images.length + pendingImages.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Hóa đơn & Chứng từ mua hàng</CardTitle>
          {totalCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {images.length} đã lưu{pendingImages.length > 0 ? ` + ${pendingImages.length} chờ xác nhận` : " ảnh"}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {status === "posted"
            ? "Ảnh chụp hóa đơn VAT, phiếu xuất kho NCC hoặc biên bản giao nhận được lưu kèm phiếu nhập."
            : "Tải ảnh chụp hóa đơn VAT, phiếu giao hàng từ nhà cung cấp trước khi duyệt nhập kho."}
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start gap-2.5">
          {images.map((url, idx) => (
            <div key={url} className="relative group">
              <ZoomableImage
                src={url}
                images={allPreviewImages}
                alt={`Hóa đơn ${idx + 1}`}
                title={`Hóa đơn #${idx + 1} (${receiptCode})`}
                className="size-20 rounded-lg border-2 object-cover shadow-sm sm:size-24"
              />
              {isManager &&
                canDeleteInvoiceImage({
                  imageUrl: url,
                  currentUserId: currentUser?.id,
                  userRole: currentUser?.role,
                  creatorId,
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

          {isManager && (
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
