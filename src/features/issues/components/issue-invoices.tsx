"use client";

import { useState, useTransition } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { uploadIssueInvoiceImage } from "../upload";
import { updateIssueInvoiceImages } from "../actions";
import { ZoomableImage } from "@/components/image-lightbox";

export function IssueInvoices({
  issueId,
  issueCode,
  invoiceImages: initialImages = [],
  status,
}: {
  issueId: string;
  issueCode: string;
  invoiceImages?: string[];
  status: string;
}) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls = await Promise.all(files.map((f) => uploadIssueInvoiceImage(f)));
      const nextImages = [...images, ...uploadedUrls];
      setImages(nextImages);

      startTransition(async () => {
        try {
          await updateIssueInvoiceImages(issueId, nextImages);
          toast.success(`Đã bổ sung ${uploadedUrls.length} ảnh hóa đơn / chứng từ xuất kho thành công`);
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
    if (!window.confirm("Bạn có chắc muốn xóa ảnh hóa đơn này không?")) return;
    const nextImages = images.filter((u) => u !== urlToRemove);
    setImages(nextImages);

    startTransition(async () => {
      try {
        await updateIssueInvoiceImages(issueId, nextImages);
        toast.success("Đã xóa ảnh hóa đơn");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa ảnh thất bại");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Hóa đơn & Chứng từ xuất kho</CardTitle>
          {images.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {images.length} ảnh
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {status === "posted"
            ? "Ảnh hóa đơn / phiếu xuất / biên bản giao hàng được lưu kèm phiếu xuất kho."
            : "Tải ảnh hóa đơn hoặc chứng từ kèm theo phiếu xuất kho."}
        </p>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap items-start gap-2.5">
          {images.map((url, idx) => (
            <div key={url} className="relative group">
              <ZoomableImage
                src={url}
                images={images}
                alt={`Hóa đơn ${idx + 1}`}
                title={`Hóa đơn #${idx + 1} (${issueCode})`}
                className="size-20 rounded-lg border-2 object-cover shadow-sm sm:size-24"
              />
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
            </div>
          ))}

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
                <ImagePlus className="size-5" aria-hidden />
                {uploading || pending ? "Đang tải…" : "+ Thêm ảnh"}
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
        </div>
      </CardContent>
    </Card>
  );
}
