"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { returnRequisitionItems } from "../actions";

interface Item {
  id: string;
  variantId: string;
  label: string;
  quantity: number;
  /** Số lượng đã trả lại kho trước đó (để cap ô nhập theo phần còn lại). */
  returned: number;
}

export function ReturnItems({ requisitionId, items }: { requisitionId: string; items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState<Record<string, string>>({});

  function submit() {
    const returns = items
      .filter((i) => Math.max(0, i.quantity - i.returned) > 0 && Number(qty[i.id]) > 0)
      .map((i) => ({ variantId: i.variantId, quantity: Number(qty[i.id]) }));
    if (returns.length === 0) return toast.error("Nhập số lượng cần trả");
    startTransition(async () => {
      try {
        await returnRequisitionItems(requisitionId, returns);
        toast.success("Đã nhập trả lại kho");
        setQty({});
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Trả lại thất bại");
      }
    });
  }

  return (
    <div className="space-y-2">
      {items.map((i) => {
        const remaining = Math.max(0, i.quantity - i.returned);
        return (
          <div key={i.id} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm">{i.label}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              đã cấp {i.quantity} · đã trả {i.returned}
            </span>
            <Input
              type="number"
              min="0"
              max={remaining}
              disabled={remaining <= 0}
              className="w-24"
              value={remaining <= 0 ? "" : (qty[i.id] ?? "")}
              onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))}
              placeholder={remaining <= 0 ? "Hết" : "Số trả"}
            />
          </div>
        );
      })}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={submit} disabled={pending}>
          {pending ? "Đang xử lý…" : "Trả lại kho"}
        </Button>
      </div>
    </div>
  );
}
