"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatVnd } from "@/lib/format";
import { REQUISITION_TYPE } from "@/lib/labels";
import type { Zone } from "@/lib/types";
import { useCartStore } from "@/stores/cart-store";
import { createRequisition, submitRequisition } from "../actions";

export function RequisitionForm({
  zones,
  defects,
}: {
  zones: Zone[];
  defects: { id: string; code: string }[];
}) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  const [zoneId, setZoneId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [type, setType] = useState<"new_supply" | "replacement">("new_supply");
  const [defectId, setDefectId] = useState("");
  const [pending, startTransition] = useTransition();

  async function run(submitAfterCreate: boolean) {
    if (items.length === 0) return toast.error("Chưa có vật tư trong yêu cầu");
    if (!zoneId) return toast.error("Chọn khu vực");
    if (!purpose.trim()) return toast.error("Nhập mục đích");
    if (type === "replacement" && !defectId) return toast.error("Đổi mới phải chọn phiếu hỏng liên quan");

    startTransition(async () => {
      try {
        const id = await createRequisition({
          zoneId,
          purpose: purpose.trim(),
          requisitionType: type,
          linkedDefectId: type === "replacement" ? defectId : undefined,
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        });
        if (submitAfterCreate) await submitRequisition(id);
        clear();
        toast.success(submitAfterCreate ? "Đã gửi phiếu yêu cầu" : "Đã lưu nháp");
        router.push(`/requisitions/${id}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo phiếu thất bại");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin phiếu</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Khu vực</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn khu vực" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Loại phiếu</Label>
            <Select value={type} onValueChange={(v) => setType(v as "new_supply" | "replacement")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REQUISITION_TYPE) as ("new_supply" | "replacement")[]).map((k) => (
                  <SelectItem key={k} value={k}>{REQUISITION_TYPE[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type === "replacement" && (
            <div className="space-y-1.5">
              <Label>Phiếu hỏng liên quan</Label>
              <Select value={defectId} onValueChange={setDefectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn phiếu hỏng" />
                </SelectTrigger>
                <SelectContent>
                  {defects.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Mục đích</Label>
            <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Mục đích sử dụng vật tư…" rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vật tư yêu cầu</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có vật tư. Hãy thêm từ Kho vật tư.</p>
          ) : (
            <ul className="divide-y">
              {items.map((i) => (
                <li key={i.variantId} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{i.name}</div>
                    <div className="text-xs text-muted-foreground">{i.label}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon-xs" onClick={() => updateQty(i.variantId, i.quantity - 1)} aria-label="Giảm">−</Button>
                    <span className="w-10 text-center text-sm tabular-nums">{i.quantity}</span>
                    <Button variant="outline" size="icon-xs" onClick={() => updateQty(i.variantId, i.quantity + 1)} aria-label="Tăng">+</Button>
                  </div>
                  <div className="w-24 text-right text-sm tabular-nums">
                    {i.price != null ? formatVnd(i.price * i.quantity) : "—"}
                  </div>
                  <Button variant="ghost" size="icon-xs" onClick={() => removeItem(i.variantId)} aria-label="Xóa">×</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => run(false)} disabled={pending}>
          Lưu nháp
        </Button>
        <Button onClick={() => run(true)} disabled={pending}>
          {pending ? "Đang xử lý…" : "Gửi yêu cầu"}
        </Button>
      </div>
    </div>
  );
}
