"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Milestone, Printer, QrCode, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ZoomableImage } from "@/components/image-lightbox";
import {
  getSlipDetail,
  type SlipDetailPayload,
} from "@/features/dashboard/actions/get-slip-detail";
import {
  approveRequisition,
  cancelRequisition,
  fulfillRequisition,
  receiveRequisition,
  rejectRequisition,
  submitRequisition,
} from "@/features/requisitions/actions";
import { ReturnItems } from "@/features/requisitions/components/return-items";
import {
  approveReceipt,
  cancelReceipt,
  postReceipt,
  updateReceiptInvoiceImages,
} from "@/features/receipts/actions";
import { uploadReceiptInvoiceImage } from "@/features/receipts/upload";
import {
  cancelIssue,
  postIssue,
  updateIssueInvoiceImages,
} from "@/features/issues/actions";
import { uploadIssueInvoiceImage } from "@/features/issues/upload";
import {
  approveExchange,
  cancelExchange,
  createExchange,
  issueExchange,
  receiveExchange,
  rejectExchange,
} from "@/features/exchanges/actions";
import { cancelDefect, requestRepair } from "@/features/defects/actions";
import { formatDate, formatDateTime, formatVnd } from "@/lib/format";
import {
  auditEntityLabel,
  slipStatusLabel,
  statusBadgeVariant,
} from "@/lib/labels";
import { isPrivileged } from "@/lib/types";
import { cn } from "@/lib/utils";

const EVENT_DOT_CLASS: Record<string, string> = {
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-400 dark:bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-gray-400 dark:bg-gray-500",
};

const EVENT_LABEL_CLASS: Record<string, string> = {
  info: "text-sky-700 dark:text-sky-300",
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
  neutral: "text-gray-700 dark:text-gray-300",
};

/** Mốc đặc biệt: Cấp phát vật tư (phiếu yêu cầu) tô cam. */
const EVENT_KEY_DOT_CLASS: Record<string, string> = {
  "requisition.fulfill": "bg-orange-500",
};

const EVENT_KEY_LABEL_CLASS: Record<string, string> = {
  "requisition.fulfill": "text-orange-700 dark:text-orange-300",
};

interface SlipDetailModalProps {
  entityType: string | null;
  entityId: string | null;
  onClose: () => void;
  onActionComplete?: () => void;
}

export function SlipDetailModal({
  entityType,
  entityId,
  onClose,
  onActionComplete,
}: SlipDetailModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<SlipDetailPayload | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    role: string;
    name: string | null;
  } | null>(null);

  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [uploadingInvoices, setUploadingInvoices] = useState(false);

  const isOpen = Boolean(entityType && entityId);

  useEffect(() => {
    if (!entityType || !entityId) {
      setDetail(null);
      setRejecting(false);
      setRejectionReason("");
      setUploadingInvoices(false);
      return;
    }

    let active = true;
    setLoading(true);
    setRejecting(false);
    setRejectionReason("");
    setUploadingInvoices(false);

    getSlipDetail(entityType, entityId).then((res) => {
      if (!active) return;
      setLoading(false);
      if (res.error) {
        toast.error(res.error);
        onClose();
        return;
      }
      setDetail(res.detail);
      setCurrentUser(res.currentUser);
    });

    return () => {
      active = false;
    };
  }, [entityType, entityId, onClose]);

  function reloadDetail() {
    if (!entityType || !entityId) return;
    getSlipDetail(entityType, entityId).then((res) => {
      if (res.detail) setDetail(res.detail);
      if (res.currentUser) setCurrentUser(res.currentUser);
    });
    router.refresh();
    onActionComplete?.();
  }

  const isInvoiceCapable = detail?.type === "receipt" || detail?.type === "issue";

  async function handleInvoiceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!detail || !isInvoiceCapable) return;
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploadingInvoices(true);
    try {
      const uploadedUrls = await Promise.all(
        files.map((f) =>
          detail.type === "issue" ? uploadIssueInvoiceImage(f) : uploadReceiptInvoiceImage(f),
        ),
      );
      const currentImages = detail.invoiceImages ?? [];
      const nextImages = [...currentImages, ...uploadedUrls];
      setDetail({ ...detail, invoiceImages: nextImages });

      startTransition(async () => {
        try {
          if (detail.type === "issue") {
            await updateIssueInvoiceImages(detail.id, nextImages);
          } else {
            await updateReceiptInvoiceImages(detail.id, nextImages);
          }
          toast.success(`Đã bổ sung ${uploadedUrls.length} ảnh hóa đơn thành công`);
          reloadDetail();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Cập nhật ảnh hóa đơn thất bại");
        }
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải ảnh hóa đơn thất bại");
    } finally {
      setUploadingInvoices(false);
      e.target.value = "";
    }
  }

  function handleInvoiceRemove(urlToRemove: string) {
    if (!detail || !isInvoiceCapable) return;
    if (!window.confirm("Bạn có chắc muốn xóa ảnh hóa đơn này không?")) return;
    const currentImages = detail.invoiceImages ?? [];
    const nextImages = currentImages.filter((u) => u !== urlToRemove);
    setDetail({ ...detail, invoiceImages: nextImages });

    startTransition(async () => {
      try {
        if (detail.type === "issue") {
          await updateIssueInvoiceImages(detail.id, nextImages);
        } else {
          await updateReceiptInvoiceImages(detail.id, nextImages);
        }
        toast.success("Đã xóa ảnh hóa đơn");
        reloadDetail();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa ảnh thất bại");
      }
    });
  }

  function handleAction(actionFn: () => Promise<unknown>, successMessage: string) {
    startTransition(async () => {
      try {
        const res = await actionFn();
        if (Array.isArray(res)) {
          toast.success(
            res.length > 0
              ? `${successMessage} (tự động cấp phát ${res.length} phiếu yêu cầu)`
              : `${successMessage} (không có phiếu yêu cầu nào cần cấp phát)`,
          );
        } else {
          toast.success(successMessage);
        }
        setRejecting(false);
        setRejectionReason("");
        reloadDetail();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
      }
    });
  }

  if (!isOpen) return null;

  const isManager = isPrivileged(currentUser?.role);
  const isOwner = detail?.requesterId === currentUser?.id;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] sm:max-w-4xl lg:max-w-5xl h-[92svh] max-h-[92svh] sm:h-auto sm:max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden border-2 border-border shadow-2xl rounded-2xl">
        {loading || !detail ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Đang tải thông tin phiếu…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <DialogHeader className="shrink-0 pb-3 border-b">
              <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                <div className="flex items-center gap-2.5">
                  <DialogTitle className="font-mono text-lg font-bold text-primary">
                    {detail.code}
                  </DialogTitle>
                  <Badge variant="neutral" className="text-xs">
                    {auditEntityLabel(detail.type)}
                  </Badge>
                  <Badge variant={statusBadgeVariant(detail.status)} className="text-xs">
                    {slipStatusLabel(detail.type, detail.status)}
                  </Badge>
                </div>
                {detail.pdfUrl && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs">
                      <a
                        href={`/qr/${detail.type}/${detail.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <QrCode className="size-3.5" />
                        In mã QR
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs">
                      <a href={detail.pdfUrl} target="_blank" rel="noreferrer">
                        <Printer className="size-3.5" />
                        In phiếu PDF
                      </a>
                    </Button>
                  </div>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Tạo lúc: {formatDateTime(detail.createdAt)}
                {detail.creatorName && ` · Bởi: ${detail.creatorName}`}
              </DialogDescription>
            </DialogHeader>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 py-3 pr-1">
              {/* Info Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3.5 bg-muted/20 border-2 border-border/80 rounded-xl text-xs">
                {detail.zoneName && (
                  <div>
                    <span className="text-muted-foreground">Khu vực: </span>
                    <span className="font-medium text-foreground">{detail.zoneName}</span>
                  </div>
                )}
                {detail.supplierName && (
                  <div>
                    <span className="text-muted-foreground">Nhà cung cấp: </span>
                    <span className="font-medium text-foreground">{detail.supplierName}</span>
                  </div>
                )}
                {detail.customerName && (
                  <div>
                    <span className="text-muted-foreground">Khách hàng: </span>
                    <span className="font-medium text-foreground">{detail.customerName}</span>
                  </div>
                )}
                {detail.customerPhone && (
                  <div>
                    <span className="text-muted-foreground">Điện thoại: </span>
                    <span className="font-medium text-foreground">{detail.customerPhone}</span>
                  </div>
                )}
                {detail.customerAddress && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Địa chỉ: </span>
                    <span className="font-medium text-foreground">{detail.customerAddress}</span>
                  </div>
                )}
                {detail.vehiclePlate && (
                  <div>
                    <span className="text-muted-foreground">Biển số xe: </span>
                    <span className="font-mono font-medium text-foreground">{detail.vehiclePlate}</span>
                  </div>
                )}
                {detail.driverName && (
                  <div>
                    <span className="text-muted-foreground">Người giao / Tài xế: </span>
                    <span className="font-medium text-foreground">{detail.driverName}</span>
                  </div>
                )}
                {detail.purposeOrNotes && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <span className="text-muted-foreground">Mục đích / Ghi chú: </span>
                    <span className="font-medium text-foreground">{detail.purposeOrNotes}</span>
                  </div>
                )}
                {detail.rejectionReason && (
                  <div className="sm:col-span-2 lg:col-span-3 text-red-600 dark:text-red-400 font-medium">
                    <span>Lý do từ chối: </span>
                    <span>{detail.rejectionReason}</span>
                  </div>
                )}
              </div>

              {/* Invoice / Evidence Images */}
              {(detail.type === "receipt" || detail.type === "issue" || (detail.invoiceImages && detail.invoiceImages.length > 0)) && (
                <div className="space-y-2.5 p-3.5 border-2 border-border/80 rounded-xl bg-card">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <span className="text-xs font-semibold text-foreground">
                      {detail.type === "issue" ? "Hóa đơn & Chứng từ xuất kho" : "Hóa đơn & Chứng từ mua hàng"}
                      {detail.invoiceImages && detail.invoiceImages.length > 0 ? ` (${detail.invoiceImages.length} ảnh)` : ""}:
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
                          {isManager && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInvoiceRemove(url);
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

                    {isManager && (
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
                          accept="image/png,image/jpeg,image/webp"
                          multiple
                          className="sr-only"
                          disabled={uploadingInvoices || pending}
                          onChange={handleInvoiceUpload}
                        />
                      </Label>
                    )}
                  </div>
                </div>
              )}

              {/* Defect Evidence if replacement requisition */}
              {detail.defectEvidence && (
                <div className="space-y-2.5 p-3.5 border-2 border-amber-300 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 rounded-xl">
                  <div className="flex items-center gap-2 pb-2 border-b border-amber-300/60 dark:border-amber-900/60">
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      Bằng chứng vật tư hỏng kèm theo (Phiếu báo hỏng {detail.defectEvidence.code}):
                    </span>
                  </div>
                  <div className="space-y-2">
                    {detail.defectEvidence.items.map((it, idx) => (
                      <div key={it.id || idx} className="text-xs space-y-1">
                        <div className="font-medium text-foreground">
                          {it.productName ?? "Vật tư"} {it.unit ? `(${it.unit})` : ""} · SL: {it.quantity}
                          {it.damageDetail ? ` — ${it.damageDetail}` : ""}
                        </div>
                        {it.images && it.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {it.images.map((img, imgIdx) => (
                              <ZoomableImage
                                key={img}
                                src={img}
                                images={it.images}
                                alt={`Ảnh hỏng #${imgIdx + 1}`}
                                title={`Ảnh hỏng ${detail.defectEvidence?.code} (${imgIdx + 1}/${it.images.length})`}
                                className="size-16 rounded-md border object-cover"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
                  <span className="text-xs font-semibold text-foreground">
                    Danh sách vật tư ({detail.items.length} món):
                  </span>
                </div>
                <div className="rounded-xl border-2 border-border/80 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-12 text-center text-xs">STT</TableHead>
                        <TableHead className="text-xs">Tên vật tư</TableHead>
                        <TableHead className="text-xs">Quy cách / ĐVT</TableHead>
                        <TableHead className="w-20 text-center text-xs">SL</TableHead>
                        {detail.items.some((i) => i.unitPrice != null) && (
                          <TableHead className="w-28 text-right text-xs">Đơn giá</TableHead>
                        )}
                        {detail.items.some((i) => i.batchNo || i.expiryDate) && (
                          <TableHead className="w-32 text-xs">Lô / HSD</TableHead>
                        )}
                        {detail.items.some((i) => i.damageDetail || (i.images && i.images.length > 0)) && (
                          <TableHead className="text-xs">Mô tả hỏng & Ảnh</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((it, idx) => (
                        <TableRow key={it.id || idx} className="hover:bg-muted/30">
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-medium text-xs text-foreground">
                            {it.productName}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {it.variantLabel} {it.unit ? `(${it.unit})` : ""}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs font-semibold">
                            {it.quantity}
                          </TableCell>
                          {detail.items.some((i) => i.unitPrice != null) && (
                            <TableCell className="text-right font-mono text-xs">
                              {it.unitPrice != null ? formatVnd(it.unitPrice) : "—"}
                            </TableCell>
                          )}
                          {detail.items.some((i) => i.batchNo || i.expiryDate) && (
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {it.batchNo && <div>Lô: {it.batchNo}</div>}
                              {it.expiryDate && <div>HSD: {formatDate(it.expiryDate)}</div>}
                            </TableCell>
                          )}
                          {detail.items.some((i) => i.damageDetail || (i.images && i.images.length > 0)) && (
                            <TableCell className="text-xs">
                              {it.damageDetail && <div>{it.damageDetail}</div>}
                              {it.images && it.images.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {it.images.map((img) => (
                                    <ZoomableImage
                                      key={img}
                                      src={img}
                                      images={it.images}
                                      alt="Ảnh hỏng"
                                      className="size-10 rounded border object-cover"
                                    />
                                  ))}
                                </div>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter className="bg-muted/30 font-semibold text-xs">
                      <TableRow>
                        <TableCell colSpan={3} className="text-right">Tổng cộng:</TableCell>
                        <TableCell className="text-center font-mono">{detail.items.reduce((s, i) => s + i.quantity, 0)}</TableCell>
                        {detail.items.some((i) => i.unitPrice != null) && (
                          <TableCell className="text-right font-mono">
                            {formatVnd(detail.items.reduce((s, i) => s + i.quantity * (i.unitPrice ?? 0), 0))}
                          </TableCell>
                        )}
                        {detail.items.some((i) => i.batchNo || i.expiryDate) && <TableCell />}
                        {detail.items.some((i) => i.damageDetail || (i.images && i.images.length > 0)) && <TableCell />}
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </div>

              {/* Trả lại vật tư cho phiếu yêu cầu đã cấp/nhận */}
              {detail.type === "requisition" &&
                (detail.status === "issued" || detail.status === "received") &&
                (isManager || isOwner) &&
                detail.items.some((i) => i.quantity - (i.returned ?? 0) > 0) && (
                <div className="space-y-2.5 p-3.5 border-2 border-amber-300 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 rounded-xl">
                  <div className="flex items-center gap-2 pb-2 border-b border-amber-300/60 dark:border-amber-900/60">
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      Trả lại vật tư không dùng hết
                    </span>
                  </div>
                  <ReturnItems
                    requisitionId={detail.id}
                    onSuccess={reloadDetail}
                    items={detail.items.map((i) => ({
                      id: i.id,
                      variantId: i.variantId ?? "",
                      label: `${i.productName} — ${i.variantLabel}`,
                      quantity: i.quantity,
                      returned: i.returned ?? 0,
                    }))}
                  />
                </div>
              )}

              {/* Linked Requisitions for receipt */}
              {detail.linkedRequisitions && detail.linkedRequisitions.length > 0 && (
                <div className="space-y-2.5 p-3.5 border-2 border-border/80 rounded-xl bg-card">
                  <div className="pb-2 border-b border-border/60">
                    <span className="text-xs font-semibold text-foreground">
                      Phiếu yêu cầu được cấp phát tự động ({detail.linkedRequisitions.length} phiếu):
                    </span>
                  </div>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="text-xs">Mã phiếu</TableHead>
                          <TableHead className="text-xs">Người yêu cầu</TableHead>
                          <TableHead className="text-xs">Mục đích</TableHead>
                          <TableHead className="text-xs">Trạng thái</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.linkedRequisitions.map((rq) => (
                          <TableRow key={rq.id}>
                            <TableCell className="font-mono text-xs font-semibold text-primary">
                              {rq.code}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{rq.requesterName ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{rq.purpose ?? "—"}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant={statusBadgeVariant(rq.status)} className="text-[10px]">
                                {slipStatusLabel("requisition", rq.status)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Timeline / Tiến trình hoạt động */}
              {detail.timeline && detail.timeline.length > 0 && (
                <div className="space-y-3 p-3.5 border-2 border-border/80 rounded-xl bg-card">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                      <Milestone className="size-3.5" aria-hidden />
                    </span>
                    <span className="text-xs font-semibold text-foreground">Tiến trình</span>
                  </div>
                  <ol className="pl-1 pt-1">
                    {detail.timeline.map((t, i) => {
                      const isLast = i === detail.timeline!.length - 1;
                      const tone = t.tone ?? "neutral";
                      const isFulfill =
                        t.key === "requisition.fulfill" ||
                        t.key === "fulfill" ||
                        t.key === "exchange.issue" ||
                        t.label?.toLowerCase().includes("cấp phát");
                      const dotClass = isFulfill
                        ? "bg-orange-500"
                        : (EVENT_KEY_DOT_CLASS[t.key] ?? EVENT_DOT_CLASS[tone] ?? "bg-gray-400 dark:bg-gray-500");
                      const labelClass = isFulfill
                        ? "text-orange-700 dark:text-orange-300"
                        : (EVENT_KEY_LABEL_CLASS[t.key] ?? EVENT_LABEL_CLASS[tone] ?? "text-foreground");
                      return (
                        <li key={i} className="flex gap-3">
                          {/* Cột mốc: chấm màu + đường nối dọc */}
                          <div aria-hidden className="flex flex-col items-center self-stretch">
                            <span
                              className={cn(
                                "mt-[5px] size-2.5 shrink-0 rounded-full",
                                dotClass,
                              )}
                              style={isFulfill ? { backgroundColor: "#f97316" } : undefined}
                            />
                            {!isLast ? <span className="w-px flex-1 rounded-full bg-border" /> : null}
                          </div>
                          <div className={cn("min-w-0 flex-1", isLast ? "pb-0.5" : "pb-4")}>
                            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-xs">
                              <span
                                className={cn(
                                  "font-semibold",
                                  labelClass,
                                )}
                              >
                                {t.label}
                              </span>
                              <span className="tabular-nums text-muted-foreground">
                                {t.at ? formatDateTime(t.at) : "—"}
                              </span>
                              {t.by ? <span className="text-muted-foreground">· {t.by}</span> : null}
                            </div>
                            {t.note && (
                              <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
                                Lý do: {t.note}
                              </p>
                            )}
                            {t.detail && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t.detail}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {/* Rejection input prompt if opened */}
              {rejecting && (
                <div className="space-y-2.5 p-3.5 border-2 border-red-300 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 rounded-xl">
                  <div className="pb-1.5 border-b border-red-300/60 dark:border-red-900/60">
                    <label className="text-xs font-semibold text-red-700 dark:text-red-300">
                      Nhập lý do từ chối:
                    </label>
                  </div>
                  <div className="flex gap-2 pt-0.5">
                    <Input
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Lý do từ chối phiếu này…"
                      className="h-9 text-xs"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (!rejectionReason.trim()) return toast.error("Vui lòng nhập lý do từ chối");
                        if (detail.type === "requisition") {
                          handleAction(() => rejectRequisition(detail.id, rejectionReason.trim()), "Đã từ chối phiếu yêu cầu");
                        } else if (detail.type === "exchange") {
                          handleAction(() => rejectExchange(detail.id, rejectionReason.trim()), "Đã từ chối phiếu đổi mới");
                        }
                      }}
                      disabled={pending}
                      className="h-9 text-xs shrink-0"
                    >
                      Xác nhận từ chối
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRejecting(false)}
                      disabled={pending}
                      className="h-9 text-xs"
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Action Bar */}
            <DialogFooter className="shrink-0 pt-3 border-t flex flex-row flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose} className="h-9 text-xs">
                  Đóng
                </Button>
              </div>

              <div className="flex flex-row flex-wrap items-center justify-end gap-2">
                {/* Requisition Actions */}
                {detail.type === "requisition" && (
                  <>
                    {isOwner && detail.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(() => submitRequisition(detail.id), "Đã gửi phiếu yêu cầu")}
                        disabled={pending}
                        className="h-9 text-xs"
                      >
                        Gửi yêu cầu
                      </Button>
                    )}
                    {isManager && detail.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleAction(() => approveRequisition(detail.id), "Đã duyệt phiếu yêu cầu")}
                          disabled={pending}
                          className="h-9 text-xs"
                        >
                          Duyệt phiếu
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setRejecting(true)}
                          disabled={pending || rejecting}
                          className="h-9 text-xs"
                        >
                          Từ chối
                        </Button>
                      </>
                    )}
                    {isManager && detail.status === "approved" && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(() => fulfillRequisition(detail.id), "Đã cấp phát vật tư")}
                        disabled={pending}
                        className="h-9 text-xs"
                      >
                        Cấp phát vật tư
                      </Button>
                    )}
                    {isOwner && detail.status === "issued" && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(() => receiveRequisition(detail.id), "Đã xác nhận nhận hàng")}
                        disabled={pending}
                        className="h-9 text-xs"
                      >
                        Xác nhận đã nhận
                      </Button>
                    )}
                    {(isOwner || isManager) && (detail.status === "draft" || detail.status === "pending") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAction(() => cancelRequisition(detail.id), "Đã hủy phiếu yêu cầu")}
                        disabled={pending}
                        className="h-9 text-xs text-muted-foreground hover:text-destructive"
                      >
                        Hủy phiếu
                      </Button>
                    )}
                  </>
                )}

                {/* Receipt Actions */}
                {detail.type === "receipt" && isManager && (
                  <>
                    {detail.status === "draft" && (
                      <>
                        <Button asChild size="sm" variant="outline" className="h-9 text-xs">
                          <Link href={`/receipts/${detail.id}/edit`} onClick={onClose}>
                            Sửa thông tin
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAction(() => approveReceipt(detail.id), "Đã duyệt phiếu đặt hàng")}
                          disabled={pending}
                          className="h-9 text-xs"
                        >
                          Duyệt đặt hàng
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(() => cancelReceipt(detail.id), "Đã hủy phiếu đặt hàng")}
                          disabled={pending}
                          className="h-9 text-xs"
                        >
                          Hủy phiếu
                        </Button>
                      </>
                    )}
                    {detail.status === "approved" && (
                      <>
                        <Button asChild size="sm" variant="outline" className="h-9 text-xs">
                          <Link href={`/receipts/${detail.id}/edit`} onClick={onClose}>
                            Kiểm đếm hàng về
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAction(() => postReceipt(detail.id), "Đã duyệt nhập kho")}
                          disabled={pending}
                          className="h-9 text-xs"
                        >
                          Duyệt nhập kho
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(() => cancelReceipt(detail.id), "Đã hủy phiếu nhập kho")}
                          disabled={pending}
                          className="h-9 text-xs"
                        >
                          Hủy phiếu
                        </Button>
                      </>
                    )}
                  </>
                )}

                {/* Issue Actions */}
                {detail.type === "issue" && isManager && (
                  <>
                    {detail.status === "draft" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleAction(() => postIssue(detail.id), "Đã xác nhận xuất kho")}
                          disabled={pending}
                          className="h-9 text-xs"
                        >
                          Xác nhận xuất kho
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(() => cancelIssue(detail.id), "Đã hủy phiếu xuất")}
                          disabled={pending}
                          className="h-9 text-xs"
                        >
                          Hủy phiếu
                        </Button>
                      </>
                    )}
                  </>
                )}

                {/* Exchange Actions */}
                {detail.type === "exchange" && (
                  <>
                    {isManager && detail.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleAction(() => approveExchange(detail.id), "Đã duyệt phiếu đổi mới")}
                          disabled={pending}
                          className="h-9 text-xs"
                        >
                          Duyệt đổi mới
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setRejecting(true)}
                          disabled={pending || rejecting}
                          className="h-9 text-xs"
                        >
                          Từ chối
                        </Button>
                      </>
                    )}
                    {isManager && detail.status === "approved" && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(() => issueExchange(detail.id), "Đã cấp phát đổi mới")}
                        disabled={pending}
                        className="h-9 text-xs"
                      >
                        Cấp phát đổi mới
                      </Button>
                    )}
                    {detail.status === "issued" && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(() => receiveExchange(detail.id), "Đã xác nhận nhận đổi mới")}
                        disabled={pending}
                        className="h-9 text-xs"
                      >
                        Xác nhận đã nhận
                      </Button>
                    )}
                    {isManager && (detail.status === "pending" || detail.status === "approved") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAction(() => cancelExchange(detail.id), "Đã hủy phiếu đổi mới")}
                        disabled={pending}
                        className="h-9 text-xs text-muted-foreground hover:text-destructive"
                      >
                        Hủy phiếu
                      </Button>
                    )}
                  </>
                )}

                {/* Defect Actions */}
                {detail.type === "defect" && (
                  <>
                    {isManager && detail.status === "staging" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleAction(() => createExchange(detail.id), "Đã tạo phiếu đổi mới")}
                          disabled={pending}
                          className="h-9 text-xs"
                        >
                          Đổi mới ngay
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(() => requestRepair(detail.id), "Đã gửi yêu cầu sửa chữa")}
                          disabled={pending}
                          className="h-9 text-xs"
                        >
                          Gửi đi sửa
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(() => cancelDefect(detail.id), "Đã hủy báo hỏng")}
                          disabled={pending}
                          className="h-9 text-xs"
                        >
                          Hủy báo hỏng
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
