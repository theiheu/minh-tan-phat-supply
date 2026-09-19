"use client";

import { Check, ImagePlus, Loader2, X } from "lucide-react";
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
  pendingInvoiceImages?: string[];
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (url: string) => void;
  onRemovePending?: (url: string) => void;
  onConfirmPending?: () => void;
  onCancelPending?: () => void;
}

export function SlipInvoices({
  detail,
  isManager,
  currentUser,
  pending,
  uploadingInvoices,
  pendingInvoiceImages = [],
  onUpload,
  onRemove,
  onRemovePending,
  onConfirmPending,
  onCancelPending,
}: SlipInvoicesProps) {
  const isOwner = Boolean(currentUser?.id && (currentUser.id === detail.requesterId || currentUser.id === detail.creatorId));
  const canUpload = isManager || isOwner;

  const savedImages = detail.invoiceImages ?? [];
  const totalCount = savedImages.length + pendingInvoiceImages.length;

  if (
    detail.type !== "receipt" &&
    detail.type !== "issue" &&
    detail.type !== "requisition" &&
    totalCount === 0
  ) {
    return null;
  }

  const titleLabel =
    detail.type === "issue"
      ? "Hóa đơn & Chứng từ xuất kho"
      : detail.type === "requisition"
      ? "Hóa đơn & Chứng từ nhận hàng"
      : "Hóa đơn & Chứng từ mua hàng";

  const allPreviewImages = [...savedImages, ...pendingInvoiceImages];

  return (
    <div className="space-y-3 p-3.5 border-2 border-border/80 rounded-xl bg-card">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <span className="text-xs font-semibold text-foreground">
          {titleLabel}
          {totalCount > 0
            ? ` (${savedImages.length} đã lưu${pendingInvoiceImages.length > 0 ? ` + ${pendingInvoiceImages.length} chờ xác nhận` : ""})`
            : ""}:
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-2.5 pt-0.5">
        {savedImages.map((url, idx) => (
          <div key={url} className="relative group">
            <ZoomableImage
              src={url}
              images={allPreviewImages}
              alt={`Ảnh #${idx + 1}`}
              title={`Hóa đơn ${detail.code} (${idx + 1}/${totalCount})`}
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
                  disabled={pending || uploadingInvoices}
                  className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-opacity"
                  aria-label="Xóa ảnh này"
                  title="Xóa ảnh hóa đơn này"
                >
                  <X className="size-3.5" />
                </button>
              )}
          </div>
        ))}

        {pendingInvoiceImages.map((url, idx) => (
          <div key={url} className="relative group">
            <div className="relative rounded-lg border-2 border-dashed border-primary ring-2 ring-primary/20 overflow-hidden">
              <ZoomableImage
                src={url}
                images={allPreviewImages}
                alt={`Ảnh mới #${idx + 1}`}
                title={`Ảnh mới #${idx + 1} (Chờ xác nhận)`}
                className="size-20 sm:size-24 object-cover"
              />
              <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-[10px] font-medium text-white text-center py-0.5 pointer-events-none">
                Chờ lưu
              </span>
            </div>
            {onRemovePending && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemovePending(url);
                }}
                disabled={pending || uploadingInvoices}
                className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-opacity"
                aria-label="Hủy ảnh mới này"
                title="Hủy ảnh mới này"
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
                {uploadingInvoices ? (
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
              disabled={uploadingInvoices || pending}
              onChange={onUpload}
            />
          </Label>
        )}
      </div>

      {pendingInvoiceImages.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <span>Đã chọn {pendingInvoiceImages.length} ảnh mới (chưa lưu vào phiếu).</span>
          </div>
          <div className="flex items-center gap-2">
            {onCancelPending && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancelPending}
                disabled={pending || uploadingInvoices}
                className="h-8 text-xs"
              >
                <X className="size-3.5 mr-1" />
                Hủy
              </Button>
            )}
            {onConfirmPending && (
              <Button
                type="button"
                size="sm"
                onClick={onConfirmPending}
                disabled={pending || uploadingInvoices}
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
                    Xác nhận lưu ({pendingInvoiceImages.length} ảnh)
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
