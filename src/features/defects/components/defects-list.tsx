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
import { ImagePlus, Printer, QrCode, Trash2, Undo2, Wrench, X } from "lucide-react";
import { ZoomableImage } from "@/components/image-lightbox";
import { formatDate } from "@/lib/format";
import { DEFECT_STATUS, EXCHANGE_STATUS, statusBadgeVariant } from "@/lib/labels";
import {
  cancelDefect,
  cancelRepairRequest,
  requestRepair,
  updateDefectItemImages,
} from "@/features/defects/actions";
import { uploadDefectImage } from "@/features/defects/upload";
import { sendToRepair } from "@/features/repairs/actions";
import { createExchange } from "@/features/exchanges/actions";
import { DevDocTools } from "@/features/dev-tools/dev-doc-tools";

export interface DefectItemRow {
  id: string;
  quantity: number;
  damageDetail: string | null;
  note: string | null;
  images: string[];
  productName: string | null;
  variantLabel: string;
}

export interface DefectListRow {
  id: string;
  code: string;
  status: string;
  reportedById: string | null;
  reporterName: string | null;
  sourceName: string | null;
  createdAt: string;
  repairRequested: boolean;
  liveExchange: { code: string; status: string } | null;
  items: DefectItemRow[];
}

export function DefectsList({
  rows,
  currentUserId,
  isManager,
  isDev,
}: {
  rows: DefectListRow[];
  currentUserId: string | null;
  isManager: boolean;
  isDev: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-muted-foreground">
              <th className="w-28 whitespace-nowrap px-3 py-2.5 font-medium">Mã phiếu</th>
              <th className="w-16 whitespace-nowrap px-3 py-2.5 text-center font-medium">Hình ảnh</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Người lập phiếu</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Ngày lập</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Chưa có phiếu hỏng nào.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const allImages = (r.items ?? []).flatMap((i) => i.images ?? []);
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
                      {r.repairRequested ? <Badge variant="warning">Chờ xác nhận sửa</Badge> : null}
                      {r.liveExchange ? (
                        <Badge variant={statusBadgeVariant(r.liveExchange.status)}>
                          Đổi mới: {EXCHANGE_STATUS[r.liveExchange.status] ?? r.liveExchange.status}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
        />
      ) : null}
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
}: {
  row: DefectListRow;
  currentUserId: string | null;
  isManager: boolean;
  isDev: boolean;
  isOwner: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  // Các hành động xử lý
  const canRequestRepair = (isOwner || isManager) && !row.repairRequested;
  const canCancelRepairRequest = (isOwner || isManager) && row.repairRequested;
  const canExchange = isManager || isOwner;
  // Mở form đưa đi sửa
  const [showRepairForm, setShowRepairForm] = useState(false);
  const [vendor, setVendor] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");

  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const empty = !currentUserId;

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
  function doCancelRepairRequest() {
    run(() => cancelRepairRequest(row.id), "Đã hủy đề nghị sửa", onChanged);
  }
  function doCancel() {
    run(() => cancelDefect(row.id), "Đã hủy phiếu", onChanged);
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
        const { id, code } = await createExchange(row.id);
        toast.success(`Đã tạo phiếu Đổi Mới ${code}`);
        setShowRepairForm(false);
        onChanged();
        if (isManager) {
          window.location.href = `/defects/exchange/${id}`;
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Tạo phiếu Đổi Mới thất bại");
      }
    });
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
                      accept="image/png,image/jpeg,image/webp"
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
        {row.status === "staging" && !row.liveExchange && !empty && (
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-semibold">Xử lý phiếu</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {canExchange && (
                <Button
                  type="button"
                  size="lg"
                  onClick={doExchange}
                  disabled={pending || row.repairRequested}
                  className="w-full sm:col-span-2"
                >
                  {row.repairRequested
                    ? "Phiếu đang chờ xác nhận sửa"
                    : "Tạo phiếu Đổi Mới (cấp mới + thu đồ hỏng)"}
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
              {canCancelRepairRequest && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={doCancelRepairRequest}
                  disabled={pending}
                  className="w-full"
                >
                  Hủy đề nghị sửa
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
              {isManager && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={doCancel}
                  disabled={pending}
                  className="w-full"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Hủy phiếu
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
