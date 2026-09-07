"use client";

import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export function SlipCodeButton({
  type,
  id,
  code,
  className,
}: {
  type: string;
  id: string;
  code: string;
  className?: string;
}) {
  const openSlipModal = useUIStore((s) => s.openSlipModal);

  return (
    <button
      type="button"
      onClick={() => openSlipModal(type, id)}
      className={cn(
        "font-mono text-xs font-semibold text-primary hover:underline text-left cursor-pointer",
        className,
      )}
    >
      {code}
    </button>
  );
}
