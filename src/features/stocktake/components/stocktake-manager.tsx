"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { STOCKTAKE_STATUS, statusBadgeClass } from "@/lib/labels";
import { createStocktake, postStocktake } from "../actions";

interface StocktakeItem {
  id: string;
  label: string;
  systemQty: number;
  actualQty: number;
}

interface Session {
  id: string;
  code: string;
  locationName: string;
  status: string;
  postedAt: string | null;
  items: StocktakeItem[];
}

export function StocktakeManager({ sessions, locations }: { sessions: Session[]; locations: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [locationId, setLocationId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try { await action(); toast.success(success); setOpenId(null); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Thao tác thất bại"); }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Tạo phiếu kiểm kê</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div className="w-64 space-y-1.5">
            <Label>Vị trí kho</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn kho" /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => run(() => createStocktake(locationId), "Đã tạo phiếu kiểm kê")} disabled={pending || !locationId}>
            Tạo phiếu
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {sessions.length === 0 && <p className="text-sm text-muted-foreground">Chưa có phiếu kiểm kê.</p>}
        {sessions.map((s) => (
          <Card key={s.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">{s.code}</span>
                <Badge variant="outline" className={statusBadgeClass(s.status)}>{STOCKTAKE_STATUS[s.status] ?? s.status}</Badge>
              </div>
              <span className="text-sm text-muted-foreground">{s.locationName} · {s.postedAt ? formatDate(s.postedAt) : formatDate(null)}</span>
            </CardHeader>
            {s.status === "draft" && (
              <CardContent>
                <Button variant="outline" size="sm" onClick={() => { setOpenId(openId === s.id ? null : s.id); setQuantities({}); }}>
                  {openId === s.id ? "Đóng" : "Nhập số thực tế"}
                </Button>
                {openId === s.id && (
                  <div className="mt-3 space-y-3">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Vật tư</TableHead><TableHead>Tồn hệ thống</TableHead><TableHead>Thực tế</TableHead><TableHead>Lệch</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {s.items.map((i) => {
                          const val = quantities[i.id] ?? String(i.actualQty);
                          const diff = Number(val) - i.systemQty;
                          return (
                            <TableRow key={i.id}>
                              <TableCell>{i.label}</TableCell>
                              <TableCell className="tabular-nums">{i.systemQty}</TableCell>
                              <TableCell>
                                <Input type="number" min="0" className="w-24" value={val} onChange={(e) => setQuantities((q) => ({ ...q, [i.id]: e.target.value }))} />
                              </TableCell>
                              <TableCell className={`tabular-nums ${diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {diff > 0 ? `+${diff}` : diff}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <div className="flex justify-end">
                      <Button onClick={() => run(
                        () => postStocktake(s.id, s.items.map((i) => ({ itemId: i.id, actualQty: Number(quantities[i.id] ?? i.actualQty) || 0 }))),
                        "Đã chốt kiểm kê",
                      )} disabled={pending}>
                        Chốt kiểm kê
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
