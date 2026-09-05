"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createReplacementRequest } from "../exchange-action";

export function ExchangeRequestButton({ noteId, disabled = false }: { noteId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go() {
    startTransition(async () => {
      try {
        const id = await createReplacementRequest(noteId);
        toast.success("Đã tạo yêu cầu đổi mới");
        router.push(`/requisitions/${id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo yêu cầu thất bại");
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
      {pending ? "Đang tạo…" : "Tạo yêu cầu đổi mới"}
    </button>
  );
}
