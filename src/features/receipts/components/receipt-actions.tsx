"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveReceipt, postReceipt } from "../actions";

export function ReceiptActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>, success: string, goDetail: boolean) {
    startTransition(async () => {
      try {
        const res = await action();
        if (Array.isArray(res)) {
          toast.success(
            res.length > 0
              ? `${success} (tự động cấp phát ${res.length} phiếu yêu cầu)`
              : `${success} (không có phiếu yêu cầu nào cần cấp phát)`,
          );
        } else {
          toast.success(success);
        }
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

  if (status === "draft") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/receipts/${id}/edit`}>Sửa thông tin</Link>
        </Button>
        <Button
          size="sm"
          onClick={() => run(() => approveReceipt(id), "Đã duyệt phiếu đặt hàng", true)}
          disabled={pending}
        >
          Duyệt đặt hàng
        </Button>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/receipts/${id}/edit`}>Kiểm đếm hàng về</Link>
        </Button>
        <Button
          size="sm"
          onClick={() => run(() => postReceipt(id), "Đã duyệt nhập kho", true)}
          disabled={pending}
        >
          Duyệt nhập kho
        </Button>
      </div>
    );
  }

  return null;
}
