"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REPAIR_OUTCOME } from "@/lib/labels";
import { completeRepair } from "../actions";

interface RepairItem {
  id: string;
  label: string;
  quantity: number;
}

export function RepairActions({ order }: { order: { id: string; status: string; items: RepairItem[] } }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, { outcome: string; cost: string }>>({});

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  function complete() {
    const list = order.items.map((i) => ({
      repairItemId: i.id,
      outcome: (outcomes[i.id]?.outcome ?? "returned_to_stock") as "returned_to_stock" | "liquidation",
      cost: outcomes[i.id]?.cost ? Number(outcomes[i.id].cost) : null,
    }));
    run(() => completeRepair({ repairId: order.id, outcomes: list }), "Đã hoàn tất sửa chữa");
  }

  if (order.status !== "in_repair") return null;

  return (
    <div className="flex gap-1">
      <Button size="sm" onClick={() => setOpen(true)}>
        Hoàn tất
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kết quả sửa chữa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {order.items.map((i) => (
              <div key={i.id} className="grid grid-cols-3 items-end gap-2 rounded-lg border p-2">
                <div className="col-span-1">
                  <div className="truncate text-sm font-medium">{i.label}</div>
                  <div className="text-xs text-muted-foreground">SL: {i.quantity}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kết quả</Label>
                  <Select
                    value={outcomes[i.id]?.outcome ?? "returned_to_stock"}
                    onValueChange={(v) => setOutcomes((o) => ({ ...o, [i.id]: { ...o[i.id], outcome: v } }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REPAIR_OUTCOME).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Chi phí</Label>
                  <Input
                    type="number"
                    min="0"
                    value={outcomes[i.id]?.cost ?? ""}
                    onChange={(e) => setOutcomes((o) => ({ ...o, [i.id]: { ...o[i.id], cost: e.target.value } }))}
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={complete} disabled={pending}>
              Xác nhận hoàn tất
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
