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
import { Printer, Trash2, Undo2, Wrench } from "lucide-react";
import { appAssetUrl } from "@/lib/images";
import { formatDate } from "@/lib/format";
import { DEFECT_STATUS, EXCHANGE_STATUS, statusBadgeVariant } from "@/lib/labels";
import {
  cancelDefect,
  cancelRepairRequest,
  requestRepair,
} from "@/features/defects/actions";
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
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Mã</th>
              <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Người báo</th>
              <th className="hidden px-3 py-2.5 font-medium md:table-cell">Kho nguồn</th>
              <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Ngày</th>
              <th className="px-3 py-2.5 font-medium">Trạng thái</th>
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
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className="cursor-pointer hover:bg-accent/40"
              >
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setOpenId(r.id)}
                    className="font-mono font-semibold text-primary hover:underline"
                  >
                    {r.code}
                  </button>
                </td>
                  <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                    {r.reporterName ?? "—"}
                  </td>
                  <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                    {r.sourceName ?? "—"}
                  </td>
                  <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="px-3 py-2">
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
            ))}
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

  const empty = !currentUserId;

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
          <DialogDescription className="space-y-0.5 text-sm">
            <div>
              Người báo: <span className="text-foreground">{row.reporterName ?? "—"}</span> · Kho nguồn:{" "}
              <span className="text-foreground">{row.sourceName ?? "—"}</span>
            </div>
            <div>Ngày lập: {formatDate(row.createdAt)}</div>
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
              {it.images.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {it.images.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={appAssetUrl(url)}
                      alt="Ảnh hỏng"
                      className="size-16 rounded-md border object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Thao tác */}
        {row.status === "staging" && !row.liveExchange && !empty && (
          <div className="space-y-2.5 border-t pt-3">
            {canExchange && (
              <Button
                type="button"
                size="lg"
                onClick={doExchange}
                disabled={pending || row.repairRequested}
                className="w-full"
              >
                {row.repairRequested ? "Phiếu đang chờ xác nhận sửa" : "Tạo phiếu Đổi Mới (cấp mới + thu đồ hỏng)"}
              </Button>
            )}
            <div className="flex flex-wrap gap-2">
              {canRequestRepair && (
                <Button type="button" variant="outline" onClick={doRequestRepair} disabled={pending || row.items.length === 0}>
                  Đề nghị gửi đi sửa
                </Button>
              )}
              {canCancelRepairRequest && (
                <Button type="button" variant="outline" onClick={doCancelRepairRequest} disabled={pending}>
                  Hủy đề nghị sửa
                </Button>
              )}
              {isManager && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowRepairForm((v) => !v)}
                  disabled={row.items.length === 0}
                >
                  <Wrench className="size-4" aria-hidden />
                  {row.repairRequested ? "Xác nhận sửa" : "Đưa đi sửa"}
                </Button>
              )}
              {isManager && (
                <Button type="button" variant="destructive" onClick={doCancel} disabled={pending}>
                  <Trash2 className="size-4" aria-hidden />
                  Hủy phiếu
                </Button>
              )}
              <Button type="button" variant="outline" asChild>
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
