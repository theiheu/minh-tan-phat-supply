"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelReceipt, postReceipt } from "../actions";

export function ReceiptActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        const res = await action();
        if (Array.isArray(res)) toast.success(`${success} (đã cấp phát ${res.length} phiếu)`);
        else toast.success(success);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  if (status !== "draft") return null;

  return (
    <div className="flex gap-1">
      <Button size="sm" onClick={() => run(() => postReceipt(id), "Đã ghi nhận")} disabled={pending}>
        Ghi nhận
      </Button>
      <Button size="sm" variant="destructive" onClick={() => run(() => cancelReceipt(id), "Đã hủy")} disabled={pending}>
        Hủy
      </Button>
    </div>
  );
}
