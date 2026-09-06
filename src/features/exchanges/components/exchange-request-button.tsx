"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createExchange } from "../actions";

export function ExchangeRequestButton({
  noteId,
  isManager = false,
  disabled = false,
}: {
  noteId: string;
  /** Manager tạo xong được chuyển thẳng tới chi tiết phiếu Đổi Mới. */
  isManager?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go() {
    startTransition(async () => {
      try {
        const { id, code } = await createExchange(noteId);
        toast.success(`Đã tạo phiếu Đổi Mới ${code}`);
        if (isManager) {
          router.push(`/defects/exchange/${id}`);
        } else {
          router.refresh();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo phiếu Đổi Mới thất bại");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={disabled || pending}
      className="inline-flex items-center whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-primary hover:bg-accent disabled:opacity-50"
    >
      {pending ? "Đang tạo…" : "Tạo phiếu đổi mới"}
    </button>
  );
}
