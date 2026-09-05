"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { createReceipt, postReceipt } from "../actions";

interface ItemDraft {
  variantId: string;
  quantity: string;
  unitCost: string;
  batchNo: string;
  expiryDate: string;
}

interface VariantOption {
  id: string;
  label: string;
  isTrackableLot: boolean;
}

const EMPTY: ItemDraft = { variantId: "", quantity: "1", unitCost: "", batchNo: "", expiryDate: "" };

export function ReceiptForm({
  suppliers,
  variants,
}: {
  suppliers: { id: string; name: string }[];
  variants: VariantOption[];
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([EMPTY]);
  const [pending, startTransition] = useTransition();

  function setItem(i: number, patch: Partial<ItemDraft>) {
    setItems((arr) => arr.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function run(postAfterCreate: boolean) {
    const valid = items.filter((i) => i.variantId && Number(i.quantity) > 0);
    if (valid.length === 0) return toast.error("Thêm ít nhất 1 vật tư");

    startTransition(async () => {
      try {
        const id = await createReceipt({
          supplierId,
          items: valid.map((i) => ({
            variantId: i.variantId,
            quantity: Number(i.quantity),
            unitCost: Number(i.unitCost) || 0,
            batchNo: i.batchNo || undefined,
            expiryDate: i.expiryDate || undefined,
          })),
        });
        if (postAfterCreate) await postReceipt(id);
        toast.success(postAfterCreate ? "Đã ghi nhận phiếu nhập" : "Đã lưu nháp");
        router.push("/receipts");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin phiếu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-1.5">
            <Label>Nhà cung cấp</Label>
            <Select value={supplierId ?? "none"} onValueChange={(v) => setSupplierId(v === "none" ? null : v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Không —</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Vật tư nhập</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((a) => [...a, EMPTY])}>
            + Thêm dòng
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((it, i) => {
            const trackable = variants.find((v) => v.id === it.variantId)?.isTrackableLot;
            return (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-3 lg:grid-cols-7">
                <div className="space-y-1 lg:col-span-2">
                  <Label className="text-xs">Vật tư</Label>
                  <Select value={it.variantId} onValueChange={(v) => setItem(i, { variantId: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn vật tư" />
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Số lượng</Label>
                  <Input type="number" min="1" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Đơn giá</Label>
                  <Input type="number" min="0" value={it.unitCost} onChange={(e) => setItem(i, { unitCost: e.target.value })} />
                </div>
                {trackable ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Lô</Label>
                      <Input value={it.batchNo} onChange={(e) => setItem(i, { batchNo: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Hạn sử dụng</Label>
                      <Input type="date" value={it.expiryDate} onChange={(e) => setItem(i, { expiryDate: e.target.value })} />
                    </div>
                  </>
                ) : (
                  <div className="lg:col-span-2" />
                )}
                <div className="flex items-end">
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} aria-label="Xóa dòng">
                    ×
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => run(false)} disabled={pending}>
          Lưu nháp
        </Button>
        <Button onClick={() => run(true)} disabled={pending}>
          {pending ? "Đang xử lý…" : "Lưu & Ghi nhận"}
        </Button>
      </div>
    </div>
  );
}
