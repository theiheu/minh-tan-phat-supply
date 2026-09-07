"use client";

import { useState, useTransition } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { uploadReceiptInvoiceImage } from "../upload";
import { updateReceiptInvoiceImages } from "../actions";
import { ZoomableImage } from "@/components/image-lightbox";

export function ReceiptInvoices({
  receiptId,
  receiptCode,
  invoiceImages: initialImages = [],
  status,
  isManager = false,
}: {
  receiptId: string;
  receiptCode: string;
  invoiceImages?: string[];
  status: string;
  isManager?: boolean;
}) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls = await Promise.all(files.map((f) => uploadReceiptInvoiceImage(f)));
      const nextImages = [...images, ...uploadedUrls];
      setImages(nextImages);

      startTransition(async () => {
        try {
          await updateReceiptInvoiceImages(receiptId, nextImages);
          toast.success(`Đã bổ sung ${uploadedUrls.length} ảnh hóa đơn mua hàng thành công`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Cập nhật ảnh hóa đơn thất bại");
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Hóa đơn & Chứng từ mua hàng</CardTitle>
            {images.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {images.length} ảnh
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {status === "posted"
              ? "Ảnh chụp hóa đơn VAT, phiếu xuất kho NCC hoặc biên bản giao nhận được lưu kèm phiếu nhập."
              : "Tải ảnh chụp hóa đơn VAT, phiếu giao hàng từ nhà cung cấp trước khi duyệt nhập kho."}
          </p>
        </div>

        {isManager && (
          <Label className="cursor-pointer">
            <Button variant="outline" size="sm" type="button" asChild disabled={uploading || pending}>
              <span>
                <ImagePlus className="size-4" />
                {uploading || pending ? "Đang tải ảnh…" : images.length === 0 ? "+ Tải ảnh hóa đơn" : "+ Bổ sung ảnh"}
              </span>
            </Button>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="sr-only"
              disabled={uploading || pending}
              onChange={handleUpload}
            />
          </Label>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {images.map((url, idx) => (
              <div key={url} className="relative group">
                <ZoomableImage
                  src={url}
                  images={images}
                  alt={`Hóa đơn ${idx + 1}`}
                  title={`Hóa đơn #${idx + 1} (${receiptCode})`}
                  className="size-20 rounded-lg border-2 object-cover shadow-sm sm:size-24"
                />
                {isManager && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(url);
                    }}
                    disabled={pending}
                    className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-opacity"
                    aria-label="Xóa ảnh này"
                    title="Xóa ảnh hóa đơn này"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isManager && (
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/40 px-4 py-4 text-center transition-colors hover:bg-accent">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              disabled={uploading || pending}
              onChange={handleUpload}
            />
            <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
            <span className="text-xs font-semibold">
              {uploading || pending ? "Đang tải ảnh lên…" : images.length === 0 ? "Bấm để tải ảnh hóa đơn" : "Bấm để bổ sung thêm ảnh"}
            </span>
            <span className="text-[11px] text-muted-foreground">Có thể chọn nhiều ảnh một lúc (PNG, JPEG, WebP)</span>
          </label>
        )}
      </CardContent>
    </Card>
  );
}
