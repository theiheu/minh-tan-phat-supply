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

export function ReturnItems({
  requisitionId,
  items,
  onSuccess,
}: {
  requisitionId: string;
  items: Item[];
  /** Được gọi sau khi trả lại thành công (vd modal cần tải lại nội dung). */
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState<Record<string, string>>({});

  function submit() {
    // Clamp theo phần còn lại: ô <Input max> chỉ advisory, không có <form> nên browser
    // không tự chặn — gõ 99 khi còn 3 sẽ bị RPC reject cả batch.
    const returns = items
      .map((i) => ({
        variantId: i.variantId,
        remaining: Math.max(0, i.quantity - i.returned),
        typed: Number(qty[i.id]),
      }))
      .filter((r) => r.remaining > 0)
      .map(({ variantId, remaining, typed }) => ({
        variantId,
        quantity: Math.min(typed, remaining),
      }))
      .filter((r) => r.quantity > 0);
    if (returns.length === 0) return toast.error("Nhập số lượng cần trả");
    startTransition(async () => {
      try {
        await returnRequisitionItems(requisitionId, returns);
        toast.success("Đã nhập trả lại kho");
        setQty({});
        router.refresh();
        onSuccess?.();
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
