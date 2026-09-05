"use client";

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
import { adjustStock, transferStock } from "../actions";

interface VariantOption { id: string; label: string; }

export function TransfersManager({
  locations,
  variants,
}: {
  locations: { id: string; name: string }[];
  variants: VariantOption[];
}) {
  const [pending, startTransition] = useTransition();

  // transfer state
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [items, setItems] = useState([{ variantId: "", quantity: "1" }]);

  // adjust state
  const [variantId, setVariantId] = useState("");
  const [locId, setLocId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  function run(action: () => Promise<unknown>, success: string, reset: () => void) {
    startTransition(async () => {
      try { await action(); toast.success(success); reset(); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Thao tác thất bại"); }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Chuyển kho</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Từ kho</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Đến kho</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {items.map((it, i) => (
            <div key={i} className="flex gap-2">
              <Select value={it.variantId} onValueChange={(v) => setItems((a) => a.map((r, idx) => idx === i ? { ...r, variantId: v } : r))}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Chọn vật tư" /></SelectTrigger>
                <SelectContent>{variants.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" min="1" className="w-24" value={it.quantity} onChange={(e) => setItems((a) => a.map((r, idx) => idx === i ? { ...r, quantity: e.target.value } : r))} />
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}>×</Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((a) => [...a, { variantId: "", quantity: "1" }])}>+ Thêm</Button>
          <div className="flex justify-end">
            <Button
              disabled={pending || !fromId || !toId}
              onClick={() => run(
                () => transferStock({
                  items: items.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId, quantity: Number(i.quantity) || 0 })),
                  fromLocationId: fromId,
                  toLocationId: toId,
                }),
                "Đã chuyển kho",
                () => setItems([{ variantId: "", quantity: "1" }]),
              )}
            >
              Chuyển
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Điều chỉnh tồn thủ công</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Vật tư</Label>
            <Select value={variantId} onValueChange={setVariantId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn vật tư" /></SelectTrigger>
              <SelectContent>{variants.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Vị trí kho</Label>
            <Select value={locId} onValueChange={setLocId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn kho" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Điều chỉnh (±)</Label>
            <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="VD 5 hoặc -3" />
          </div>
          <div className="space-y-1.5">
            <Label>Lý do (bắt buộc)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do điều chỉnh" />
          </div>
          <div className="flex justify-end">
            <Button
              disabled={pending || !variantId || !locId || !delta || !reason.trim()}
              onClick={() => run(
                () => adjustStock({ variantId, locationId: locId, delta: Number(delta) || 0, reason: reason.trim() }),
                "Đã điều chỉnh tồn",
                () => { setDelta(""); setReason(""); },
              )}
            >
              Lưu
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
