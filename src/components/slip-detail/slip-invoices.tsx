"use client";

import { X, ImagePlus } from "lucide-react";
import { ZoomableImage } from "@/components/image-lightbox";
import { canDeleteInvoiceImage } from "@/lib/images";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { SlipDetailPayload } from "@/features/dashboard/actions/get-slip-detail";

interface SlipInvoicesProps {
  detail: SlipDetailPayload;
  isManager: boolean;
  currentUser?: { id: string; role: string; name: string | null } | null;
  pending: boolean;
  uploadingInvoices: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (url: string) => void;
}

export function SlipInvoices({
  detail,
  isManager,
  currentUser,
  pending,
  uploadingInvoices,
  onUpload,
  onRemove,
}: SlipInvoicesProps) {
  const isOwner = Boolean(currentUser?.id && (currentUser.id === detail.requesterId || currentUser.id === detail.creatorId));
  const canUpload = isManager || isOwner;

  if (
    detail.type !== "receipt" &&
    detail.type !== "issue" &&
    detail.type !== "requisition" &&
    !(detail.invoiceImages && detail.invoiceImages.length > 0)
  ) {
    return null;
  }

  const titleLabel =
    detail.type === "issue"
      ? "Hóa đơn & Chứng từ xuất kho"
      : detail.type === "requisition"
      ? "Hóa đơn & Chứng từ nhận hàng"
      : "Hóa đơn & Chứng từ mua hàng";

  return (
    <div className="space-y-2.5 p-3.5 border-2 border-border/80 rounded-xl bg-card">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <span className="text-xs font-semibold text-foreground">
          {titleLabel}
          {detail.invoiceImages && detail.invoiceImages.length > 0
            ? ` (${detail.invoiceImages.length} ảnh)`
            : ""}:
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-2.5 pt-0.5">
        {detail.invoiceImages &&
          detail.invoiceImages.length > 0 &&
          detail.invoiceImages.map((url, idx) => (
            <div key={url} className="relative group">
              <ZoomableImage
                src={url}
                images={detail.invoiceImages}
                alt={`Ảnh #${idx + 1}`}
                title={`Hóa đơn ${detail.code} (${idx + 1}/${detail.invoiceImages?.length})`}
                className="size-20 sm:size-24 rounded-lg border-2 object-cover"
              />
              {currentUser &&
                canDeleteInvoiceImage({
                  imageUrl: url,
                  currentUserId: currentUser.id,
                  userRole: currentUser.role,
                  creatorId: detail.type === "requisition" ? detail.requesterId : detail.creatorId,
                }) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(url);
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

        {canUpload && (
          <Label className="cursor-pointer">
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              disabled={uploadingInvoices || pending}
              className="flex size-20 flex-col items-center justify-center gap-1 border-dashed p-0 text-[10px] sm:size-24"
            >
              <span>
                <ImagePlus className="size-5" aria-hidden />
                {uploadingInvoices ? "Đang tải…" : "+ Thêm ảnh"}
              </span>
            </Button>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
              multiple
              className="sr-only"
              disabled={uploadingInvoices || pending}
              onChange={onUpload}
            />
          </Label>
        )}
      </div>
    </div>
  );
}
