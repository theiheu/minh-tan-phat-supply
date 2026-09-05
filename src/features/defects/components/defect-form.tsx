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
import { DAMAGE_TYPE, SEVERITY_LEVEL } from "@/lib/labels";
import { recordDefect } from "../actions";

interface ItemDraft {
  variantId: string;
  quantity: string;
  damageDetail: string;
  damageType: string;
  severity: string;
}

const EMPTY: ItemDraft = { variantId: "", quantity: "1", damageDetail: "", damageType: "", severity: "" };

export function DefectForm({
  locations,
  variants,
}: {
  locations: { id: string; name: string }[];
  variants: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [sourceLocationId, setSourceLocationId] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([EMPTY]);
  const [pending, startTransition] = useTransition();

  function setItem(i: number, patch: Partial<ItemDraft>) {
    setItems((arr) => arr.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceLocationId) return toast.error("Chọn kho nguồn");
    const valid = items.filter((i) => i.variantId && i.damageDetail.trim() && Number(i.quantity) > 0);
    if (valid.length === 0) return toast.error("Điền đầy đủ ít nhất 1 vật tư hỏng");

    startTransition(async () => {
      try {
        await recordDefect({
          sourceLocationId,
          items: valid.map((i) => ({
            variantId: i.variantId,
            quantity: Number(i.quantity),
            damageDetail: i.damageDetail.trim(),
            damageType: (i.damageType || undefined) as "cracked" | "chipped" | "broken" | "worn" | "electrical" | "chemical" | "other" | undefined,
            severity: (i.severity || undefined) as "light" | "medium" | "severe" | undefined,
            images: [],
          })),
        });
        toast.success("Đã ghi nhận vật tư hỏng");
        router.push("/defects");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ghi nhận thất bại");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kho nguồn</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-1.5">
            <Label>Vị trí kho</Label>
            <Select value={sourceLocationId} onValueChange={setSourceLocationId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn kho nguồn" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Vật tư hỏng</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((a) => [...a, EMPTY])}>
            + Thêm dòng
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((it, i) => (
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
              <div className="space-y-1 lg:col-span-2">
                <Label className="text-xs">Chi tiết hỏng</Label>
                <Input value={it.damageDetail} onChange={(e) => setItem(i, { damageDetail: e.target.value })} placeholder="VD: nứt, gãy…" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kiểu hỏng</Label>
                <Select value={it.damageType} onValueChange={(v) => setItem(i, { damageType: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DAMAGE_TYPE).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mức độ</Label>
                <Select value={it.severity} onValueChange={(v) => setItem(i, { severity: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITY_LEVEL).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="ghost" size="icon-xs" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} aria-label="Xóa dòng">
                  ×
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Đang lưu…" : "Ghi nhận hỏng"}
        </Button>
      </div>
    </form>
  );
}
