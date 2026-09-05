"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveRequisition,
  cancelRequisition,
  fulfillRequisition,
  receiveRequisition,
  rejectRequisition,
  submitRequisition,
} from "../actions";
import { isPrivileged } from "@/lib/types";

export function RequisitionActions({
  requisitionId,
  status,
  requesterId,
  currentUserId,
  role,
}: {
  requisitionId: string;
  status: string;
  requesterId: string;
  currentUserId: string;
  role: string;
}) {
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const isOwner = requesterId === currentUserId;
  const isManager = isPrivileged(role);

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
      {isOwner && status === "draft" && (
        <Button size="sm" onClick={() => run(() => submitRequisition(requisitionId), "Đã gửi")} disabled={pending}>
          Gửi
        </Button>
      )}
      {isOwner && (status === "draft" || status === "pending") && (
        <Button size="sm" variant="outline" onClick={() => run(() => cancelRequisition(requisitionId), "Đã hủy")} disabled={pending}>
          Hủy
        </Button>
      )}
      {isManager && status === "pending" && (
        <Button size="sm" onClick={() => run(() => approveRequisition(requisitionId), "Đã duyệt")} disabled={pending}>
          Duyệt
        </Button>
      )}
      {isManager && status === "approved" && (
        <Button size="sm" onClick={() => run(() => fulfillRequisition(requisitionId), "Đã cấp phát")} disabled={pending}>
          Cấp phát
        </Button>
      )}
      {isManager && (status === "pending" || status === "approved") &&
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
              onClick={() => run(() => rejectRequisition(requisitionId, reason), "Đã từ chối")}
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
      {isOwner && status === "issued" && (
        <Button size="sm" onClick={() => run(() => receiveRequisition(requisitionId), "Đã xác nhận nhận")} disabled={pending}>
          Xác nhận đã nhận
        </Button>
      )}
    </div>
  );
}
