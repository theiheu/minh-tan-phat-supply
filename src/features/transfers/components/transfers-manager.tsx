"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adjustStock, transferStock } from "../actions";
import { SkuSelector } from "@/features/catalog/components/sku-selector";
import { TransactionUomSelect } from "@/features/catalog/components/transaction-uom-select";

export interface TransferDraftItem {
  skuId: string;
  transactionUnitId: string;
  enteredQuantity: string;
  trackingPolicy: string;
}

const EMPTY_ITEM: TransferDraftItem = {
  skuId: "",
  transactionUnitId: "",
  enteredQuantity: "1",
  trackingPolicy: "none",
};

export function TransfersManager({
  locations,
  _variants,
}: {
  locations: { id: string; name: string }[];
  variants?: { id: string; label: string }[];
}) {
  const [pending, startTransition] = useTransition();

  // transfer state
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [items, setItems] = useState<TransferDraftItem[]>([EMPTY_ITEM]);

  // adjust state
  const [adjustSkuId, setAdjustSkuId] = useState("");
  const [locId, setLocId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  function setItem(i: number, patch: Partial<TransferDraftItem>) {
    setItems((arr) => arr.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function run(action: () => Promise<unknown>, success: string, reset: () => void) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        reset();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="border-2 border-border shadow-xs rounded-xl">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base font-semibold">Điều chuyển kho nội bộ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Từ kho</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn kho nguồn" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Đến kho</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn kho đích" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Danh sách vật tư chuyển</Label>
            {items.map((it, i) => (
              <div key={i} className="relative rounded-lg border border-border/80 bg-muted/20 p-2.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-destructive"
                  onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}
                  aria-label="Xóa dòng"
                >
                  <Trash2 className="size-3.5" />
                </Button>
                <div className="grid grid-cols-1 gap-2 pr-7 sm:grid-cols-12">
                  <div className="sm:col-span-6 space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Vật tư</Label>
                    <SkuSelector
                      value={it.skuId}
                      onSelect={(sku) => {
                        setItem(i, { skuId: sku.skuId, trackingPolicy: sku.trackingPolicy });
                      }}
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Đơn vị</Label>
                    <TransactionUomSelect
                      skuId={it.skuId}
                      value={it.transactionUnitId}
                      onValueChange={(v) => setItem(i, { transactionUnitId: v })}
                      disabled={!it.skuId}
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Số lượng</Label>
                    <Input
                      type="number"
                      min="0.000001"
                      step="any"
                      value={it.enteredQuantity}
                      onChange={(e) => setItem(i, { enteredQuantity: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((a) => [...a, EMPTY_ITEM])}
            className="w-full"
          >
            <Plus className="mr-1 size-4" /> Thêm vật tư
          </Button>

          <div className="flex justify-end pt-2">
            <Button
              disabled={pending || !fromId || !toId || fromId === toId}
              onClick={() =>
                run(
                  () =>
                    transferStock({
                      items: items
                        .filter((i) => i.skuId && Number(i.enteredQuantity) > 0)
                        .map((i) => ({
                          skuId: i.skuId,
                          enteredQuantity: Number(i.enteredQuantity) || 0,
                          transactionUnitId: i.transactionUnitId || undefined,
                        })),
                      fromLocationId: fromId,
                      toLocationId: toId,
                    }),
                  "Đã điều chuyển kho thành công",
                  () => setItems([EMPTY_ITEM]),
                )
              }
            >
              {pending ? "Đang xử lý…" : "Chuyển kho"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-border shadow-xs rounded-xl">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base font-semibold">Điều chỉnh tồn thủ công</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3.5 pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Vật tư</Label>
            <SkuSelector
              value={adjustSkuId}
              onSelect={(sku) => setAdjustSkuId(sku.skuId)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Vị trí kho</Label>
            <Select value={locId} onValueChange={setLocId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn vị trí kho" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Điều chỉnh (± delta)</Label>
            <Input
              type="number"
              step="any"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="VD: +5 hoặc -3"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Lý do điều chỉnh (bắt buộc)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do điều chỉnh số lượng tồn"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button
              disabled={pending || !adjustSkuId || !locId || !delta || !reason.trim()}
              onClick={() =>
                run(
                  () =>
                    adjustStock({
                      skuId: adjustSkuId,
                      locationId: locId,
                      delta: Number(delta) || 0,
                      reason: reason.trim(),
                    }),
                  "Đã điều chỉnh tồn kho thành công",
                  () => {
                    setDelta("");
                    setReason("");
                  },
                )
              }
            >
              {pending ? "Đang xử lý…" : "Lưu điều chỉnh"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
