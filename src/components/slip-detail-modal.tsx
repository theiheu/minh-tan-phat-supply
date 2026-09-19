"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileCheck, Printer, QrCode, Truck } from "lucide-react";
import { BrandLoading } from "@/components/brand-loading";
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
import {
  Table,
  TableBody,
  TableCell,
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
  completeRequisitionDirect,
  fulfillRequisition,
  receiveRequisition,
  rejectRequisition,
  submitRequisition,
  updateRequisitionInvoiceImages,
} from "@/features/requisitions/actions";
import { uploadRequisitionInvoiceImage } from "@/features/requisitions/upload";
import { ReturnItems } from "@/features/requisitions/components/return-items";
import {
  approveReceipt,
  postReceipt,
  updateReceiptInvoiceImages,
} from "@/features/receipts/actions";
import { uploadReceiptInvoiceImage } from "@/features/receipts/upload";
import {
  postIssue,
  updateIssueInvoiceImages,
} from "@/features/issues/actions";
import { uploadIssueInvoiceImage } from "@/features/issues/upload";
import {
  approveExchange,
  createExchange,
  issueExchange,
  receiveExchange,
  rejectExchange,
} from "@/features/exchanges/actions";
import { requestRepair } from "@/features/defects/actions";
import { formatDateTime } from "@/lib/format";
import {
  auditEntityLabel,
  slipStatusLabel,
  statusBadgeVariant,
} from "@/lib/labels";
import { isPrivileged } from "@/lib/types";

// Extracted Subcomponents
import { SlipInvoices } from "@/components/slip-detail/slip-invoices";
import { SlipItemsTable } from "@/components/slip-detail/slip-items-table";
import { SlipTimeline } from "@/components/slip-detail/slip-timeline";

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

  const isInvoiceCapable = detail?.type === "receipt" || detail?.type === "issue" || detail?.type === "requisition";

  async function handleInvoiceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!detail || !isInvoiceCapable) return;
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploadingInvoices(true);
    try {
      const uploadedUrls = await Promise.all(
        files.map((f) => {
          if (detail.type === "issue") return uploadIssueInvoiceImage(f);
          if (detail.type === "requisition") return uploadRequisitionInvoiceImage(f);
          return uploadReceiptInvoiceImage(f);
        }),
      );
      const currentImages = detail.invoiceImages ?? [];
      const nextImages = [...currentImages, ...uploadedUrls];
      setDetail({ ...detail, invoiceImages: nextImages });

      startTransition(async () => {
        try {
          if (detail.type === "issue") {
            await updateIssueInvoiceImages(detail.id, nextImages);
          } else if (detail.type === "requisition") {
            await updateRequisitionInvoiceImages(detail.id, nextImages);
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
        } else if (detail.type === "requisition") {
          await updateRequisitionInvoiceImages(detail.id, nextImages);
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
              ? `${successMessage} (tự động cấp phát ${res.length} phiếu yêu cầu đã duyệt)`
              : `${successMessage} (không có phiếu yêu cầu nào cần cấp phát)`,
          );
        } else {
          toast.success(successMessage);
        }
        setRejecting(false);
        setRejectionReason("");
        reloadDetail();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Thao tác thất bại";
        if (msg.includes("tạo phiếu đặt hàng") || msg.includes("Không đủ tồn kho")) {
          toast.error(msg, {
            action: {
              label: "Đặt hàng ngay",
              onClick: () => {
                onClose();
                if (detail?.id) router.push(`/receipts/new?requisition_id=${detail.id}`);
              },
            },
            duration: 8000,
          });
        } else {
          toast.error(msg);
        }
      }
    });
  }

  if (!isOpen) return null;

  const isManager = isPrivileged(currentUser?.role);
  const isOwner = detail?.requesterId === currentUser?.id;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:w-full sm:max-w-4xl lg:max-w-5xl h-[90svh] max-h-[90svh] sm:h-auto sm:max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden border-2 border-border shadow-2xl rounded-2xl min-w-0">
        {loading || !detail ? (
          <BrandLoading
            variant="inline"
            size="md"
            message="Đang tải thông tin phiếu…"
            className="py-16"
          />
        ) : (
          <>
            {/* Header */}
            <DialogHeader className="shrink-0 pb-3 border-b pr-10 sm:pr-8 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="font-mono text-base sm:text-lg font-bold text-primary">
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
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Button variant="outline" size="sm" asChild className="h-7 sm:h-8 gap-1 text-xs px-2 sm:px-3">
                      <a
                        href={`/qr/${detail.type}/${detail.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <QrCode className="size-3.5" />
                        In mã QR
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="h-7 sm:h-8 gap-1 text-xs px-2 sm:px-3">
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
                {(detail.type === "receipt" || detail.supplierName) && (
                  <div>
                    <span className="text-muted-foreground">Nhà cung cấp: </span>
                    <span className="font-medium text-foreground">{detail.supplierName || "Không có nhà cung cấp"}</span>
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

              <SlipInvoices
                detail={detail}
                isManager={isManager}
                currentUser={currentUser}
                pending={pending}
                uploadingInvoices={uploadingInvoices}
                onUpload={handleInvoiceUpload}
                onRemove={handleInvoiceRemove}
              />

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
                                images={it.images ?? []}
                                alt={`Ảnh hỏng #${imgIdx + 1}`}
                                title={`Ảnh hỏng ${detail.defectEvidence?.code} (${imgIdx + 1}/${it.images?.length})`}
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

              {/* Thông tin tiến độ đặt hàng từ nhà cung cấp */}
              {detail.type === "requisition" && detail.linkedReceipt && (
                <div className="space-y-2.5 p-3.5 border-2 border-violet-300 dark:border-violet-900/80 bg-violet-50/70 dark:bg-violet-950/25 rounded-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-200/80 dark:border-violet-900/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-violet-200 text-violet-800 dark:bg-violet-800/40 dark:text-violet-200">
                        <Truck className="size-3.5" aria-hidden />
                      </span>
                      <span className="text-xs font-semibold text-violet-950 dark:text-violet-100">
                        Tiến độ đặt hàng vật tư:
                      </span>
                      <Badge variant={statusBadgeVariant(detail.linkedReceipt.status)} className="text-[10px]">
                        {slipStatusLabel("receipt", detail.linkedReceipt.status)}
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm" asChild className="h-6 text-[11px] px-2 border-violet-300 dark:border-violet-800">
                      <Link href={`/receipts/${detail.linkedReceipt.id}`} target="_blank" onClick={onClose}>
                        Xem phiếu {detail.linkedReceipt.code}
                      </Link>
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-violet-900 dark:text-violet-200">
                    <div>Mã phiếu đặt hàng: <span className="font-mono font-semibold text-foreground">{detail.linkedReceipt.code}</span></div>
                    <div>Nhà cung cấp: <span className="font-semibold text-foreground">{detail.linkedReceipt.supplierName ?? "—"}</span></div>
                    {detail.linkedReceipt.creatorName && <div>Người đặt: <span className="text-foreground">{detail.linkedReceipt.creatorName}</span></div>}
                    {detail.linkedReceipt.createdAt && <div>Thời gian đặt: <span className="text-foreground">{formatDateTime(detail.linkedReceipt.createdAt)}</span></div>}
                  </div>
                  {detail.status !== "received" && (
                    <div className="rounded-md bg-white/80 dark:bg-black/40 p-2.5 border border-violet-200 dark:border-violet-900/60 text-xs text-muted-foreground leading-relaxed">
                      💡 Người yêu cầu có thể theo phiếu tới trực tiếp nơi cung cấp lấy hàng. Sau khi nhận hàng, vui lòng chụp và tải hóa đơn lên để quản kho duyệt hoàn tất ngay.
                    </div>
                  )}
                </div>
              )}

              {/* Cảnh báo tồn kho không đủ cấp phát (cho phiếu yêu cầu) */}
              {isManager &&
                detail.type === "requisition" &&
                (detail.status === "pending" || detail.status === "approved") &&
                detail.items.some((m) => (m.stock ?? 0) < m.quantity) &&
                !detail.linkedReceipt && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-2 border-amber-300 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl text-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                    <p className="text-amber-800 dark:text-amber-200">
                      <span className="font-semibold">Tồn kho không đủ cấp phát:</span> Có vật tư trong phiếu đang hết hoặc thiếu tồn kho. Quản kho có thể lập phiếu đặt hàng để nhập bổ sung.
                    </p>
                  </div>
                  <Button size="sm" asChild className="h-8 text-xs shrink-0">
                    <Link href={`/receipts/new?requisition_id=${detail.id}`} onClick={onClose}>
                      Tạo phiếu đặt hàng nhập kho
                    </Link>
                  </Button>
                </div>
              )}

              <SlipItemsTable detail={detail} />

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
                      skuId: i.variantId ?? "",
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
                      Phiếu yêu cầu đã duyệt được cấp phát tự động ({detail.linkedRequisitions.length} phiếu):
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

              <SlipTimeline timeline={detail.timeline} />

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
                    {isManager && (detail.invoiceImages && detail.invoiceImages.length > 0) && (detail.status === "pending" || detail.status === "approved" || detail.status === "issued") && (
                      <Button
                        size="sm"
                        className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-xs"
                        onClick={() =>
                          handleAction(
                            () => completeRequisitionDirect(detail.id, "Duyệt nhận hàng trực tiếp qua hóa đơn NCC"),
                            "Đã duyệt và hoàn tất nhận hàng trực tiếp theo hóa đơn",
                          )
                        }
                        disabled={pending}
                      >
                        <FileCheck className="size-3.5" aria-hidden />
                        Duyệt & Hoàn tất (Qua hóa đơn)
                      </Button>
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
                      </>
                    )}
                  </>
                )}

                {/* Issue Actions */}
                {detail.type === "issue" && isManager && (
                  <>
                    {detail.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(() => postIssue(detail.id), "Đã xác nhận xuất kho")}
                        disabled={pending}
                        className="h-9 text-xs"
                      >
                        Xác nhận xuất kho
                      </Button>
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
