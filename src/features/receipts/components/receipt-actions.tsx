"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelReceipt, postReceipt } from "../actions";

export function ReceiptActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>, success: string, goDetail: boolean) {
    startTransition(async () => {
      try {
        const res = await action();
        if (Array.isArray(res)) {
          toast.success(res.length > 0 ? `${success} (đã cấp phát ${res.length} phiếu)` : `${success} (không cấp phát phiếu nào)`);
        } else {
          toast.success(success);
        }
        // Sau Ghi nhận → mở trang chi tiết để xem danh sách phiếu yêu cầu đã được cấp phát.
        if (goDetail) {
          router.push(`/receipts/${id}`);
        } else {
          router.push("/receipts");
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  if (status !== "draft") return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => run(() => postReceipt(id), "Đã ghi nhận phiếu nhập", true)} disabled={pending}>
        Ghi nhận
      </Button>
      <Button size="sm" variant="destructive" onClick={() => run(() => cancelReceipt(id), "Đã hủy phiếu nhập", false)} disabled={pending}>
        Hủy
      </Button>
    </div>
  );
}
