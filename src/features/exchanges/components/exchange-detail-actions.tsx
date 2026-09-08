"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveExchange,
  issueExchange,
  receiveExchange,
  rejectExchange,
} from "../actions";

export function ExchangeDetailActions({
  exchangeId,
  status,
  isManager,
}: {
  exchangeId: string;
  status: string;
  isManager: boolean;
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
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "pending" && (
        <>
          {isManager && (
            <Button size="sm" onClick={() => run(() => approveExchange(exchangeId), "Đã duyệt")} disabled={pending}>
              Duyệt
            </Button>
          )}
          {isManager &&
            (rejecting ? (
              <span className="flex items-center gap-2">
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Lý do từ chối"
                  className="h-8 w-48"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => run(() => rejectExchange(exchangeId, reason), "Đã từ chối")}
                  disabled={pending || !reason.trim()}
                >
                  Xác nhận
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                  Hủy
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => setRejecting(true)} disabled={pending}>
                Từ chối
              </Button>
            ))}
        </>
      )}
      {isManager && status === "approved" && (
        <Button size="sm" onClick={() => run(() => issueExchange(exchangeId), "Đã cấp phát")} disabled={pending}>
          Cấp phát
        </Button>
      )}
      {isManager && status === "issued" && (
        <Button size="sm" onClick={() => run(() => receiveExchange(exchangeId), "Đã xác nhận nhận")} disabled={pending}>
          Xác nhận đã nhận
        </Button>
      )}
    </div>
  );
}
