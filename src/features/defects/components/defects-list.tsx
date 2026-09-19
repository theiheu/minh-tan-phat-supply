"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { CheckCircle2, Eye, Pencil, Trash2, Zap } from "lucide-react";
import { ZoomableImage } from "@/components/image-lightbox";
import { formatDate } from "@/lib/format";
import { DEFECT_STATUS, EXCHANGE_STATUS, statusBadgeVariant } from "@/lib/labels";
import {
  deleteDefect,
  toggleDefectCollected,
} from "@/features/defects/actions";
import {
  quickExchange,
  quickFulfillExistingExchange,
} from "@/features/exchanges/actions";
import { DefectDetailDialog } from "./defect-detail-dialog";
import { DefectEditDialog } from "./defect-edit-dialog";

export interface DefectItemRow {
  id: string;
  skuId?: string;
  variantId?: string;
  quantity: number;
  enteredQuantity?: number | null;
  transactionUnitId?: string | null;
  uomName?: string | null;
  skuCode?: string | null;
  productName: string | null;
  variantLabel: string;
  damageDetail: string | null;
  note: string | null;
  images: string[];
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
  suppliers = [],
}: {
  rows: DefectListRow[];
  currentUserId: string | null;
  isManager: boolean;
  isDev: boolean;
  variants?: { id: string; name: string; detail: string }[];
  sourceLocationId?: string;
  suppliers?: { id: string; name: string; phone?: string | null }[];
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
          suppliers={suppliers}
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
          skus={variants}
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
          <DialogContent className="sm:max-w-md">
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
            <DialogFooter className="gap-2 sm:gap-0">
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
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}