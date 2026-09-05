"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LIQUIDATION_METHOD, LIQUIDATION_STATUS, statusBadgeClass } from "@/lib/labels";
import {
  approveLiquidation,
  cancelLiquidation,
  completeLiquidation,
  createLiquidation,
  rejectLiquidation,
} from "../actions";

interface Item { variantId: string; quantity: string; method: string; unitValue: string; }
interface AvailableVariant { id: string; label: string; stock: number; }

export function LiquidationManager({
  notes,
  variants,
}: {
  notes: { id: string; code: string; status: string; reason: string | null; items: { id: string; label: string; quantity: number; method: string }[] }[];
  variants: AvailableVariant[];
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<Item[]>([{ variantId: "", quantity: "1", method: "dispose", unitValue: "" }]);
  const [completing, setCompleting] = useState<string | null>(null);
  const [proceeds, setProceeds] = useState<Record<string, string>>({});

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try { await action(); toast.success(success); setOpen(false); setCompleting(null); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Thao tác thất bại"); }
    });
  }

  function create() {
    const valid = items.filter((i) => i.variantId && Number(i.quantity) > 0);
    run(
      () =>
        createLiquidation({
          reason,
          items: valid.map((i) => ({
            variantId: i.variantId,
            quantity: Number(i.quantity),
            method: i.method as "sale" | "dispose",
            unitValue: Number(i.unitValue) || 0,
          })),
        }),
      "Đã tạo phiếu thanh lý",
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>Tạo phiếu thanh lý</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Phiếu thanh lý</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Lý do</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-5">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Vật tư (Kho hỏng)</Label>
                  <Select value={it.variantId} onValueChange={(v) => setItems((a) => a.map((r, idx) => idx === i ? { ...r, variantId: v } : r))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Chọn" /></SelectTrigger>
                    <SelectContent>
                      {variants.map((v) => <SelectItem key={v.id} value={v.id}>{v.label} (tồn {v.stock})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Số lượng</Label>
                  <Input type="number" min="1" value={it.quantity} onChange={(e) => setItems((a) => a.map((r, idx) => idx === i ? { ...r, quantity: e.target.value } : r))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phương thức</Label>
                  <Select value={it.method} onValueChange={(v) => setItems((a) => a.map((r, idx) => idx === i ? { ...r, method: v } : r))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LIQUIDATION_METHOD).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Giá trị</Label>
                  <Input type="number" min="0" value={it.unitValue} onChange={(e) => setItems((a) => a.map((r, idx) => idx === i ? { ...r, unitValue: e.target.value } : r))} />
                </div>
                <Button type="button" variant="ghost" size="icon-xs" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}>×</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setItems((a) => [...a, { variantId: "", quantity: "1", method: "dispose", unitValue: "" }])}>+ Thêm</Button>
          </div>
          <DialogFooter><Button onClick={create} disabled={pending}>Tạo phiếu</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle className="text-base">Danh sách phiếu thanh lý</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Mã</TableHead><TableHead>Lý do</TableHead><TableHead>Trạng thái</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {notes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Chưa có phiếu thanh lý.</TableCell></TableRow>}
              {notes.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono text-sm">{n.code}</TableCell>
                  <TableCell className="text-muted-foreground">{n.reason ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={statusBadgeClass(n.status)}>{LIQUIDATION_STATUS[n.status] ?? n.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {n.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => run(() => approveLiquidation(n.id), "Đã duyệt")} disabled={pending}>Duyệt</Button>
                          <Button size="sm" variant="destructive" onClick={() => run(() => rejectLiquidation(n.id, "Không duyệt"), "Đã từ chối")} disabled={pending}>Từ chối</Button>
                          <Button size="sm" variant="ghost" onClick={() => run(() => cancelLiquidation(n.id), "Đã hủy")} disabled={pending}>Hủy</Button>
                        </>
                      )}
                      {n.status === "approved" && (
                        <Button size="sm" onClick={() => { setCompleting(n.id); setProceeds({}); }} disabled={pending}>Hoàn tất</Button>
                      )}
                      <Link href={`/api/liquidations/${n.id}/pdf`} target="_blank" className="rounded-md px-2 py-1 text-sm text-primary hover:bg-accent">
                        PDF
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hoàn tất thanh lý (tiền thu)</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {notes.find((n) => n.id === completing)?.items.map((i) => (
              <div key={i.id} className="grid grid-cols-2 items-center gap-2">
                <span className="truncate text-sm">{i.label} × {i.quantity}</span>
                <Input type="number" min="0" placeholder="Tiền thu" value={proceeds[i.id] ?? ""} onChange={(e) => setProceeds((p) => ({ ...p, [i.id]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => {
                const note = notes.find((n) => n.id === completing)!;
                run(
                  () => completeLiquidation(note.id, note.items.map((i) => ({ itemId: i.id, proceeds: Number(proceeds[i.id]) || 0 }))),
                  "Đã hoàn tất thanh lý",
                );
              }}
            >
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
