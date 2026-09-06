"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelIssue, postIssue } from "../actions";

export function IssueActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  if (status !== "draft") return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        onClick={() => {
          if (!window.confirm("Xác nhận xuất kho? Vật tư sẽ bị trừ khỏi tồn kho và không thể hoàn tác.")) return;
          run(() => postIssue(id), "Đã xác nhận xuất kho");
        }}
        disabled={pending}
      >
        Xác nhận xuất
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => {
          if (!window.confirm("Hủy phiếu xuất này?")) return;
          run(() => cancelIssue(id), "Đã hủy phiếu xuất");
        }}
        disabled={pending}
      >
        Hủy
      </Button>
    </div>
  );
}
