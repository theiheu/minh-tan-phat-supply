"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { EXCHANGE_STATUS, statusBadgeVariant } from "@/lib/labels";
import {
  approveExchange,
  cancelExchange,
  issueExchange,
  receiveExchange,
  rejectExchange,
} from "@/features/exchanges/actions";

export interface ExchangeItemRow {
  id: string;
  quantity: number;
  productName: string | null;
  variantLabel: string;
}

export interface ExchangeListRow {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  defectCode: string | null;
  reporterName: string | null;
  rejectionReason: string | null;
  items: ExchangeItemRow[];
}

export function ExchangesList({
  rows,
  isManager,
}: {
  rows: ExchangeListRow[];
  isManager: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-muted-foreground">
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Mã phiếu</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Phiếu hỏng</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Người lập HONG</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Ngày lập</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Chưa có phiếu Đổi Mới nào.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className="cursor-pointer hover:bg-accent/40"
              >
                <td className="whitespace-nowrap px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenId(r.id)}
                    className="font-mono font-semibold text-primary hover:underline"
                  >
                    {r.code}
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-muted-foreground">
                  {r.defectCode ?? "—"}
                </td>
                <td className="max-w-[180px] truncate px-3 py-2.5 text-muted-foreground">
                  {r.reporterName ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                  {formatDate(r.createdAt)}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant={statusBadgeVariant(r.status)}>
                    {EXCHANGE_STATUS[r.status] ?? r.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <ExchangeDetailModal
          row={selected}
          isManager={isManager}
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

function ExchangeDetailModal({
  row,
  isManager,
  onClose,
  onChanged,
}: {
  row: ExchangeListRow;
  isManager: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  function run(action: () => Promise<void>, success: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        setRejecting(false);
        setReason("");
        onChanged();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
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
              {EXCHANGE_STATUS[row.status] ?? row.status}
            </Badge>
          </DialogTitle>
          <DialogDescription className="space-y-0.5 text-sm">
            <div>
              Phiếu hỏng liên quan:{" "}
              <span className="font-mono text-foreground">{row.defectCode ?? "—"}</span> · Người lập
              HONG: <span className="text-foreground">{row.reporterName ?? "—"}</span>
            </div>
            <div>Ngày lập: {formatDate(row.createdAt)}</div>
          </DialogDescription>
        </DialogHeader>

        {row.rejectionReason ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
            <span className="font-semibold">Lý do từ chối: </span>
            {row.rejectionReason}
          </p>
        ) : null}

        {/* Vật tư cấp mới */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Vật tư cấp mới ({row.items.length})</h3>
          {row.items.length === 0 && (
            <p className="text-sm text-muted-foreground">Không có vật tư.</p>
          )}
          {row.items.map((it, idx) => (
            <div key={it.id} className="flex items-baseline justify-between gap-3 rounded-lg border p-3">
              <span className="font-medium">
                {idx + 1}. {it.productName ?? "Vật tư"}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">
                {it.variantLabel} · SL {it.quantity}
              </span>
            </div>
          ))}
        </div>

        {/* Thao tác theo trạng thái */}
        <div className="space-y-3 border-t pt-4">
          <h4 className="text-sm font-semibold">Xử lý phiếu</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {row.status === "pending" && (
              <>
                {isManager && (
                  <Button type="button" size="lg" onClick={() => run(() => approveExchange(row.id), "Đã duyệt")} disabled={pending} className="w-full sm:col-span-2">
                    Duyệt phiếu
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => run(() => cancelExchange(row.id), "Đã hủy phiếu")}
                  disabled={pending}
                  className="w-full"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Hủy phiếu
                </Button>
                {isManager &&
                  (rejecting ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Lý do từ chối"
                        className="h-9"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => run(() => rejectExchange(row.id, reason), "Đã từ chối")}
                        disabled={pending || !reason.trim()}
                      >
                        Xác nhận
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="destructive" onClick={() => setRejecting(true)} disabled={pending} className="w-full">
                      Từ chối
                    </Button>
                  ))}
              </>
            )}
            {isManager && row.status === "approved" && (
              <Button type="button" size="lg" onClick={() => run(() => issueExchange(row.id), "Đã cấp phát (thu đồ hỏng về kho)")} disabled={pending} className="w-full sm:col-span-2">
                Cấp phát
              </Button>
            )}
            {isManager && row.status === "issued" && (
              <Button type="button" size="lg" onClick={() => run(() => receiveExchange(row.id), "Đã xác nhận nhận")} disabled={pending} className="w-full sm:col-span-2">
                Xác nhận đã nhận
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {row.status === "approved"
              ? "Cấp phát sẽ trừ Kho chính cấp vật tư mới và thu đồ hỏng về Kho hỏng."
              : row.status === "issued"
                ? "Xác nhận nhận để hoàn tất phiếu."
                : null}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
