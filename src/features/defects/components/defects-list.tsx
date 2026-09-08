"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Eye, ImagePlus, Pencil, Printer, QrCode, Trash2, Undo2, Wrench, X, Zap } from "lucide-react";
import { ZoomableImage } from "@/components/image-lightbox";
import { formatDate } from "@/lib/format";
import { DEFECT_STATUS, EXCHANGE_STATUS, statusBadgeVariant } from "@/lib/labels";
import {
  deleteDefect,
  requestRepair,
  toggleDefectCollected,
  updateDefectItemImages,
} from "@/features/defects/actions";
import { uploadDefectImage } from "@/features/defects/upload";
import { sendToRepair } from "@/features/repairs/actions";
import {
  approveExchange,
  createExchange,
  issueExchange,
  quickExchange,
  quickFulfillExistingExchange,
  receiveExchange,
  rejectExchange,
} from "@/features/exchanges/actions";
import { DevDocTools } from "@/features/dev-tools/dev-doc-tools";
import { cn } from "@/lib/utils";
import { DefectEditDialog } from "./defect-edit-dialog";

export interface DefectItemRow {
  id: string;
  variantId?: string;
  quantity: number;
  damageDetail: string | null;
  note: string | null;
  images: string[];
  productName: string | null;
  variantLabel: string;
}

export interface DefectLiveExchange {
  id: string;
  code: string;
  status: string;
  rejectionReason: string | null;
}

export interface DefectListRow {
  id: string;
  code: string;
  status: string;
  sourceLocationId?: string | null;
  reportedById: string | null;
  reporterName: string | null;
  sourceName: string | null;
  createdAt: string;
  collectedAt: string | null;
  isCollected: boolean;
  repairRequested: boolean;
  liveExchange: DefectLiveExchange | null;
  items: DefectItemRow[];
}

export function DefectsList({
  rows,
  currentUserId,
  isManager,
  isDev,
  variants = [],
  sourceLocationId = "",
}: {
  rows: DefectListRow[];
  currentUserId: string | null;
  isManager: boolean;
  isDev: boolean;
  variants?: { id: string; name: string; detail: string }[];
  sourceLocationId?: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<DefectListRow | null>(null);
  const [deletingRow, setDeletingRow] = useState<DefectListRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingQuick, startTransition] = useTransition();

  const selected = rows.find((r) => r.id === openId) ?? null;

  function handleQuickExchange(defectId: string) {
    startTransition(async () => {
      try {
        const { code } = await quickExchange(defectId);
        toast.success(`Đã xuất đổi mới và hoàn tất phiếu ${code}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Xuất đổi mới thất bại");
      }
    });
  }

  function handleQuickFulfill(exchangeId: string) {
    startTransition(async () => {
      try {
        await quickFulfillExistingExchange(exchangeId);
        toast.success("Đã xuất cấp đổi mới và hoàn tất phiếu");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Cấp đổi thất bại");
      }
    });
  }

  function handleToggleCollected(defectId: string, collected: boolean) {
    startTransition(async () => {
      try {
        await toggleDefectCollected(defectId, collected);
        toast.success(collected ? "Đã xác nhận vật tư hỏng đã về kho" : "Đã chuyển về Chưa gửi về kho");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  async function handleDelete(row: DefectListRow) {
    setIsDeleting(true);
    try {
      await deleteDefect(row.id);
      toast.success(`Đã xóa phiếu hỏng ${row.code}`);
      setDeletingRow(null);
      if (openId === row.id) setOpenId(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xóa phiếu thất bại");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="border-b border-border bg-table-header">
            <tr className="text-left text-foreground">
              <th className="w-28 whitespace-nowrap px-3 py-2.5 font-bold border-b border-border">Mã phiếu</th>
              <th className="w-16 whitespace-nowrap px-3 py-2.5 text-center font-bold border-b border-border">Hình ảnh</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-bold border-b border-border">Người lập phiếu</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-bold border-b border-border">Ngày lập</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-bold border-b border-border">Trạng thái</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold border-b border-border">Tác vụ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Chưa có phiếu hỏng nào.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const allImages = (r.items ?? []).flatMap((i) => i.images ?? []);
              const canEdit = isManager || (r.reportedById === currentUserId && r.status === "staging" && !r.liveExchange);
              const canDel = isManager || (r.reportedById === currentUserId && r.status === "staging" && !r.liveExchange);

              return (
                <tr
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  className="cursor-pointer hover:bg-accent/40"
                >
                  <td className="w-28 whitespace-nowrap px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setOpenId(r.id)}
                      className="font-mono font-semibold text-primary hover:underline"
                    >
                      {r.code}
                    </button>
                  </td>
                  <td className="w-16 px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                    {allImages.length > 0 ? (
                      <div className="flex items-center justify-center">
                        <div className="relative inline-flex">
                          <ZoomableImage
                            src={allImages[0]}
                            images={allImages}
                            alt={`Ảnh hàng hỏng ${r.code}`}
                            title={`Ảnh vật tư hỏng — ${r.code}`}
                            className="size-10 rounded-md border object-cover shadow-sm transition-transform hover:scale-105"
                          />
                          {allImages.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-black/80 text-[9px] font-bold text-white shadow pointer-events-none">
                              +{allImages.length - 1}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2.5 text-muted-foreground">
                    {r.reporterName ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={statusBadgeVariant(r.status)}>
                        {DEFECT_STATUS[r.status] ?? r.status}
                      </Badge>
                      {r.isCollected ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300">
                          Đã về kho
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-300">
                          Chưa về kho
                        </Badge>
                      )}
                      {r.repairRequested ? <Badge variant="warning">Chờ xác nhận sửa</Badge> : null}
                      {r.liveExchange ? (
                        <Badge variant={statusBadgeVariant(r.liveExchange.status)}>
                          Đổi mới: {EXCHANGE_STATUS[r.liveExchange.status] ?? r.liveExchange.status}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Quản lý kho / Người tạo: Nút xác nhận đã về kho nhanh nếu chưa về */}
                      {(isManager || r.reportedById === currentUserId) && r.status === "staging" && !r.isCollected && (
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => handleToggleCollected(r.id, true)}
                          disabled={pendingQuick}
                          className="h-8 px-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 gap-1"
                          title="Xác nhận vật tư hỏng đã gửi/chuyển về kho"
                        >
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                          <span className="hidden xl:inline">Về kho</span>
                        </Button>
                      )}

                      {/* Quản lý kho: Xuất đổi mới nhanh 1 chạm */}
                      {isManager && r.status === "staging" && (!r.liveExchange || r.liveExchange.status === "rejected" || r.liveExchange.status === "cancelled") && (
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => handleQuickExchange(r.id)}
                          disabled={pendingQuick || r.repairRequested}
                          className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm gap-1"
                          title="Xuất đổi mới ngay (1 chạm)"
                        >
                          <Zap className="size-3.5" />
                          <span className="hidden sm:inline">Đổi mới</span>
                        </Button>
                      )}

                      {/* Quản lý kho: Hoàn tất cấp đổi nhanh */}
                      {isManager && r.liveExchange && (r.liveExchange.status === "pending" || r.liveExchange.status === "approved") && (
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => handleQuickFulfill(r.liveExchange!.id)}
                          disabled={pendingQuick}
                          className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm gap-1"
                          title="Xuất cấp & hoàn tất đổi mới ngay"
                        >
                          <Zap className="size-3.5" />
                          <span className="hidden sm:inline">Cấp đổi</span>
                        </Button>
                      )}

                      {/* Nút Xem chi tiết */}
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => setOpenId(r.id)}
                        className="h-8 px-2.5 text-xs gap-1"
                        title="Xem chi tiết phiếu"
                      >
                        <Eye className="size-3.5" />
                        <span className="hidden sm:inline">Xem</span>
                      </Button>

                      {/* Nút Sửa */}
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => setEditingRow(r)}
                          className="h-8 px-2 text-xs gap-1 hover:bg-accent"
                          title="Chỉnh sửa phiếu hỏng"
                        >
                          <Pencil className="size-3.5" />
                          <span className="hidden md:inline">Sửa</span>
                        </Button>
                      )}

                      {/* Nút Xóa */}
                      {canDel && (
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() => setDeletingRow(r)}
                          className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title="Xóa phiếu hỏng"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Dialog */}
      {selected ? (
        <DefectDetailDialog
          row={selected}
          currentUserId={currentUserId}
          isManager={isManager}
          isDev={isDev}
          isOwner={currentUserId === selected.reportedById}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            setOpenId(null);
            router.refresh();
          }}
          onEdit={() => {
            const r = selected;
            setOpenId(null);
            setEditingRow(r);
          }}
          onDelete={() => {
            const r = selected;
            setOpenId(null);
            setDeletingRow(r);
          }}
        />
      ) : null}

      {/* Edit Dialog */}
      {editingRow && (
        <DefectEditDialog
          row={editingRow}
          sourceLocationId={sourceLocationId}
          variants={variants}
          open={!!editingRow}
          onOpenChange={(o) => (!o ? setEditingRow(null) : undefined)}
          onSuccess={() => {
            setEditingRow(null);
            router.refresh();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingRow && (
        <Dialog open onOpenChange={(o) => (!o ? setDeletingRow(null) : undefined)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-destructive flex items-center gap-2">
                <Trash2 className="size-5" />
                Xác nhận xóa phiếu hỏng
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 pt-2 text-sm">
                  <p>
                    Bạn có chắc chắn muốn xóa phiếu hỏng <strong className="font-mono text-foreground">{deletingRow.code}</strong>?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Hành động này sẽ xóa vĩnh viễn phiếu hỏng và tất cả yêu cầu đổi mới/sửa chữa liên quan.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeletingRow(null)}
                disabled={isDeleting}
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(deletingRow)}
                disabled={isDeleting}
              >
                {isDeleting ? "Đang xóa…" : "Xóa vĩnh viễn"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function DefectDetailDialog({
  row,
  currentUserId,
  isManager,
  isDev,
  isOwner,
  onClose,
  onChanged,
  onEdit,
  onDelete,
}: {
  row: DefectListRow;
  currentUserId: string | null;
  isManager: boolean;
  isDev: boolean;
  isOwner: boolean;
  onClose: () => void;
  onChanged: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  // Các hành động xử lý
  const canRequestRepair = (isOwner || isManager) && !row.repairRequested;
  const canExchange = isManager || isOwner;
  // Mở form đưa đi sửa
  const [showRepairForm, setShowRepairForm] = useState(false);
  const [vendor, setVendor] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");

  // Thao tác đổi mới
  const [rejectingExchange, setRejectingExchange] = useState(false);
  const [exchangeRejectReason, setExchangeRejectReason] = useState("");

  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const empty = !currentUserId;

  const hasActiveExchange = Boolean(
    row.liveExchange && ["pending", "approved", "issued"].includes(row.liveExchange.status),
  );

  async function handleAddImage(itemId: string, currentImages: string[], e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadingItemId(itemId);
    try {
      const urls = await Promise.all(files.map((f) => uploadDefectImage(f)));
      const nextImages = [...currentImages, ...urls];
      await updateDefectItemImages(itemId, nextImages);
      toast.success(`Đã bổ sung ${urls.length} ảnh minh chứng`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải ảnh thất bại");
    } finally {
      setUploadingItemId(null);
      e.target.value = "";
    }
  }

  async function handleRemoveImage(itemId: string, currentImages: string[], urlToRemove: string) {
    if (currentImages.length <= 1) {
      return toast.error("Mỗi dòng hỏng cần giữ lại ít nhất 1 ảnh minh chứng");
    }
    const nextImages = currentImages.filter((u) => u !== urlToRemove);
    try {
      await updateDefectItemImages(itemId, nextImages);
      toast.success("Đã xóa ảnh");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xóa ảnh thất bại");
    }
  }

  function run(action: () => Promise<unknown>, success: string, then?: () => void) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        then?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  function doRequestRepair() {
    run(() => requestRepair(row.id), "Đã đề nghị gửi đi sửa", onChanged);
  }
  function doSendToRepair() {
    run(
      () =>
        sendToRepair({
          defectItemIds: row.items.map((i) => i.id),
          vendor: vendor.trim(),
          sentAt: sentAt || null,
          expectedReturnAt: expectedReturnAt || null,
        }),
      "Đã tạo phiếu sửa",
      onChanged,
    );
  }
  function doExchange() {
    startTransition(async () => {
      try {
        const { code } = await createExchange(row.id);
        toast.success(`Đã tạo phiếu Đổi Mới ${code}`);
        setShowRepairForm(false);
        onChanged();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Tạo phiếu Đổi Mới thất bại");
      }
    });
  }

  function doQuickExchange() {
    startTransition(async () => {
      try {
        const { code } = await quickExchange(row.id);
        toast.success(`Đã xuất đổi mới và hoàn tất phiếu ${code}`);
        setShowRepairForm(false);
        onChanged();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Xuất đổi mới thất bại");
      }
    });
  }

  function doQuickFulfillExistingExchange(exchangeId: string) {
    run(
      () => quickFulfillExistingExchange(exchangeId),
      "Đã xuất cấp đổi mới và hoàn tất phiếu",
      onChanged,
    );
  }

  function doApproveExchange(exchangeId: string) {
    run(() => approveExchange(exchangeId), "Đã duyệt phiếu Đổi Mới", onChanged);
  }

  function doRejectExchange(exchangeId: string) {
    if (!exchangeRejectReason.trim()) {
      toast.error("Vui lòng nhập lý do từ chối");
      return;
    }
    run(() => rejectExchange(exchangeId, exchangeRejectReason.trim()), "Đã từ chối phiếu Đổi Mới", () => {
      setRejectingExchange(false);
      setExchangeRejectReason("");
      onChanged();
    });
  }

  function doIssueExchange(exchangeId: string) {
    run(() => issueExchange(exchangeId), "Đã cấp phát đổi mới (thu đồ hỏng về kho)", onChanged);
  }

  function doReceiveExchange(exchangeId: string) {
    run(() => receiveExchange(exchangeId), "Đã xác nhận nhận đổi mới", onChanged);
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-mono text-lg">
            {row.code}
            <Badge variant={statusBadgeVariant(row.status)}>
              {DEFECT_STATUS[row.status] ?? row.status}
            </Badge>
            {row.repairRequested ? <Badge variant="warning">Chờ xác nhận sửa</Badge> : null}
            {row.liveExchange ? (
              <Badge variant={statusBadgeVariant(row.liveExchange.status)}>
                Đổi mới: {EXCHANGE_STATUS[row.liveExchange.status] ?? row.liveExchange.status}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-0.5 text-sm">
              <div>
                Người báo: <span className="text-foreground">{row.reporterName ?? "—"}</span> · Kho nguồn:{" "}
                <span className="text-foreground">{row.sourceName ?? "—"}</span>
              </div>
              <div>Ngày lập: {formatDate(row.createdAt)}</div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Tình trạng tiếp nhận đồ hỏng tại kho */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Tiếp nhận đồ hỏng:</span>
            {row.isCollected ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300">
                Đã về kho {row.collectedAt ? `(${formatDate(row.collectedAt)})` : ""}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-300">
                Chưa gửi về kho
              </Badge>
            )}
          </div>
          {(isManager || isOwner) && row.status === "staging" && (
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() =>
                run(
                  () => toggleDefectCollected(row.id, !row.isCollected),
                  row.isCollected ? "Đã chuyển về Chưa gửi về kho" : "Đã xác nhận vật tư hỏng đã về kho",
                  onChanged,
                )
              }
              disabled={pending}
              className="h-7 text-xs"
            >
              {row.isCollected ? "Đánh dấu chưa về kho" : "Xác nhận đã về kho"}
            </Button>
          )}
        </div>

        {/* Thông tin phiếu Đổi Mới nếu có */}
        {row.liveExchange && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Phiếu đổi mới:</span>
                <span className="font-mono font-medium text-primary">{row.liveExchange.code}</span>
              </div>
              <Badge variant={statusBadgeVariant(row.liveExchange.status)}>
                {EXCHANGE_STATUS[row.liveExchange.status] ?? row.liveExchange.status}
              </Badge>
            </div>
            {row.liveExchange.rejectionReason && (
              <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                <span className="font-semibold">Lý do từ chối: </span>
                {row.liveExchange.rejectionReason}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {row.liveExchange.status === "pending" && "Phiếu đang chờ quản lý duyệt cấp đổi mới."}
              {row.liveExchange.status === "approved" &&
                "Phiếu đã duyệt. Quản lý sẽ cấp phát vật tư mới và thu hồi vật tư hỏng về kho."}
              {row.liveExchange.status === "issued" &&
                "Vật tư mới đã được cấp phát. Đang chờ người nhận xác nhận đã nhận hàng."}
              {row.liveExchange.status === "received" && "Đã hoàn tất quy trình đổi mới vật tư."}
              {row.liveExchange.status === "rejected" &&
                "Yêu cầu đổi mới đã bị từ chối. Bạn có thể tạo lại yêu cầu hoặc chuyển đi sửa chữa."}
              {row.liveExchange.status === "cancelled" &&
                "Phiếu đổi mới đã bị hủy. Bạn có thể tạo lại yêu cầu hoặc chọn phương án khác."}
            </p>
          </div>
        )}

        {/* Vật tư hỏng */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Vật tư hỏng ({row.items.length})</h3>
          {row.items.length === 0 && (
            <p className="text-sm text-muted-foreground">Không có vật tư.</p>
          )}
          {row.items.map((it, idx) => (
            <div key={it.id} className="space-y-1.5 rounded-lg border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">
                  {idx + 1}. {it.productName ?? "Vật tư"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {it.variantLabel} · SL {it.quantity}
                </span>
              </div>
              {it.damageDetail ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Mô tả:</span> {it.damageDetail}
                </p>
              ) : null}
              {it.note ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Ghi chú:</span> {it.note}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {it.images.map((url) => (
                  <div key={url} className="relative group">
                    <ZoomableImage
                      src={url}
                      images={it.images}
                      alt={`${it.productName ?? "Vật tư"} — ảnh hỏng`}
                      title={it.productName ?? "Ảnh vật tư hỏng"}
                      className="size-16 rounded-md border object-cover shadow-sm transition-transform hover:scale-105"
                    />
                    {(isOwner || isManager) && it.images.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(it.id, it.images, url);
                        }}
                        className="absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-red-600 text-white shadow-sm hover:bg-red-700"
                        title="Xóa ảnh này"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                ))}
                {(isOwner || isManager) && (
                  <Label className="cursor-pointer inline-flex items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      asChild
                      disabled={uploadingItemId === it.id}
                      className="flex h-16 w-16 flex-col items-center justify-center gap-1 border-dashed p-0 text-[10px]"
                    >
                      <span>
                        <ImagePlus className="size-4 text-muted-foreground" />
                        {uploadingItemId === it.id ? "Đang tải…" : "+ Thêm ảnh"}
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
                      multiple
                      className="sr-only"
                      disabled={uploadingItemId === it.id}
                      onChange={(e) => handleAddImage(it.id, it.images, e)}
                    />
                  </Label>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Thao tác */}
        {!empty && (
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-semibold">Xử lý phiếu</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {/* Trường hợp 1: Đang có phiếu Đổi Mới hoạt động (pending, approved, issued) */}
              {hasActiveExchange && row.liveExchange ? (
                <>
                  {/* Quản lý có nút 1-chạm để hoàn tất ngay nếu ở pending / approved */}
                  {isManager && (row.liveExchange.status === "pending" || row.liveExchange.status === "approved") && (
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => doQuickFulfillExistingExchange(row.liveExchange!.id)}
                      disabled={pending}
                      className="w-full sm:col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                    >
                      <Zap className="mr-1.5 size-4" />
                      Xuất & hoàn tất đổi mới ngay (1 chạm)
                    </Button>
                  )}

                  {/* Trạng thái pending */}
                  {row.liveExchange.status === "pending" && (
                    <>
                      {isManager && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => doApproveExchange(row.liveExchange!.id)}
                          disabled={pending}
                          className="w-full"
                        >
                          Duyệt đổi mới
                        </Button>
                      )}
                      {isManager &&
                        (rejectingExchange ? (
                          <div className="flex w-full items-center gap-2 sm:col-span-2">
                            <Input
                              value={exchangeRejectReason}
                              onChange={(e) => setExchangeRejectReason(e.target.value)}
                              placeholder="Nhập lý do từ chối…"
                              className="h-9 text-sm"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => doRejectExchange(row.liveExchange!.id)}
                              disabled={pending || !exchangeRejectReason.trim()}
                            >
                              Xác nhận
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRejectingExchange(false);
                                setExchangeRejectReason("");
                              }}
                            >
                              Hủy
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setRejectingExchange(true)}
                            disabled={pending}
                            className="w-full"
                          >
                            Từ chối đổi mới
                          </Button>
                        ))}
                    </>
                  )}

                  {/* Trạng thái approved */}
                  {row.liveExchange.status === "approved" && (
                    <>
                      {isManager && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => doIssueExchange(row.liveExchange!.id)}
                          disabled={pending}
                          className="w-full"
                        >
                          Cấp phát (thu đồ hỏng về kho)
                        </Button>
                      )}
                    </>
                  )}

                  {/* Trạng thái issued */}
                  {row.liveExchange.status === "issued" && (
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => doReceiveExchange(row.liveExchange!.id)}
                      disabled={pending}
                      className="w-full sm:col-span-2"
                    >
                      Xác nhận đã nhận đổi mới
                    </Button>
                  )}
                </>
              ) : (
                /* Trường hợp 2: Chưa có phiếu đổi mới hoặc phiếu đổi mới đã hủy/từ chối */
                row.status === "staging" && (
                  <>
                    {/* Quản lý: Xuất đổi mới ngay 1 chạm */}
                    {isManager && (
                      <Button
                        type="button"
                        size="lg"
                        onClick={doQuickExchange}
                        disabled={pending || row.repairRequested}
                        className="w-full sm:col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                      >
                        <Zap className="mr-1.5 size-4" />
                        Xuất đổi mới ngay (1 chạm)
                      </Button>
                    )}
                    {/* Tạo theo quy trình từng bước / Đề nghị đổi mới */}
                    {canExchange && (
                      <Button
                        type="button"
                        variant={isManager ? "outline" : "default"}
                        size={isManager ? "default" : "lg"}
                        onClick={doExchange}
                        disabled={pending || row.repairRequested}
                        className={cn("w-full", !isManager && "sm:col-span-2")}
                      >
                        {row.repairRequested
                          ? "Phiếu đang chờ xác nhận sửa"
                          : row.liveExchange?.status === "rejected" || row.liveExchange?.status === "cancelled"
                            ? "Tạo lại phiếu Đổi Mới"
                            : isManager
                              ? "Tạo phiếu Đổi Mới (duyệt/cấp sau)"
                              : "Đề nghị đổi mới vật tư"}
                      </Button>
                    )}
                    {canRequestRepair && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={doRequestRepair}
                        disabled={pending || row.items.length === 0}
                        className="w-full"
                      >
                        Đề nghị gửi đi sửa
                      </Button>
                    )}
                    {isManager && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowRepairForm((v) => !v)}
                        disabled={row.items.length === 0}
                        className="w-full"
                      >
                        <Wrench className="size-4" aria-hidden />
                        {row.repairRequested ? "Xác nhận sửa" : "Đưa đi sửa"}
                      </Button>
                    )}
                  </>
                )
              )}

              {/* Chỉnh sửa / Xóa phiếu */}
              {onEdit && (isManager || (isOwner && row.status === "staging" && !row.liveExchange)) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onEdit}
                  className="w-full"
                >
                  <Pencil className="size-4" aria-hidden />
                  Chỉnh sửa phiếu
                </Button>
              )}
              {onDelete && (isManager || (isOwner && row.status === "staging" && !row.liveExchange)) && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onDelete}
                  className="w-full"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Xóa phiếu
                </Button>
              )}

              <Button type="button" variant="outline" asChild className="w-full">
                <Link href={`/qr/defect/${row.id}`} target="_blank">
                  <QrCode className="size-4" aria-hidden />
                  In mã QR
                </Link>
              </Button>
              <Button type="button" variant="outline" asChild className="w-full">
                <Link href={`/api/defects/${row.id}/pdf`} target="_blank">
                  <Printer className="size-4" aria-hidden />
                  In PDF
                </Link>
              </Button>
            </div>

            {showRepairForm && isManager && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="space-y-2.5">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Đơn vị sửa chữa</Label>
                    <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Công ty sửa chữa…" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Ngày gửi</Label>
                      <Input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Dự kiến về</Label>
                      <Input type="date" value={expectedReturnAt} onChange={(e) => setExpectedReturnAt(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setShowRepairForm(false)}>
                      Hủy
                    </Button>
                    <Button type="button" onClick={doSendToRepair} disabled={pending || !vendor.trim()}>
                      {pending ? "Đang xử lý…" : "Xác nhận đưa đi sửa"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dev tools */}
        <div className="flex justify-end border-t pt-2">
          {isDev ? (
            <DevDocTools kind="defect" id={row.id} code={row.code} docName="phiếu hỏng" canReopen={false} isDev compact />
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Undo2 className="size-3" aria-hidden /> Chọn cách xử lý phía trên
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
