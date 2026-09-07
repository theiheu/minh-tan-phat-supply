"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Wrench } from "lucide-react";
import { cn } from "cn";
import { formatDate } from "@/lib/format";
import { appAssetUrl } from "@/lib/images";
import { sendToRepair } from "@/features/repairs/actions";

export interface BatchItem {
  id: string;
  noteId: string;
  quantity: number;
  productName: string | null;
  variantLabel: string;
  damageDetail: string | null;
  note: string | null;
  images: string[];
}

export interface BatchNote {
  id: string;
  code: string;
  reporterName: string | null;
  createdAt: string;
}

export function RepairBatchTab({
  notes,
  items,
}: {
  notes: BatchNote[];
  items: BatchItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [openForm, setOpenForm] = useState(false);
  const [vendor, setVendor] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");

  const selectedItems = items.filter((i) => checked.has(i.id));
  const selectedNoteIds = new Set(selectedItems.map((i) => i.noteId));
  const totalQty = selectedItems.reduce((s, i) => s + i.quantity, 0);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (vendor.trim().length === 0) return toast.error("Nhập đơn vị sửa chữa");
    startTransition(async () => {
      try {
        await sendToRepair({
          defectItemIds: selectedItems.map((i) => i.id),
          vendor: vendor.trim(),
          sentAt: sentAt || null,
          expectedReturnAt: expectedReturnAt || null,
        });
        toast.success("Đã tạo phiếu sửa chữa (SC) — gom các dòng đã chọn");
        setOpenForm(false);
        setChecked(new Set());
        setVendor("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Tạo phiếu sửa thất bại");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Tập kết vật tư hỏng từ nhiều phiếu HONG → tạo <span className="font-medium text-foreground">1 phiếu sửa chữa (SC)</span> đưa đi sửa cùng đơn vị. Theo dõi tại màn{" "}
          <span className="font-medium text-foreground">Sửa chữa</span>.
        </p>
        <Button
          type="button"
          onClick={() => (selectedItems.length === 0 ? toast.error("Tích chọn ít nhất 1 dòng vật tư hỏng") : setOpenForm(true))}
          disabled={pending}
        >
          <Wrench className="size-4" aria-hidden />
          Tạo phiếu sửa ({selectedItems.length} dòng · {totalQty} món)
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border py-10 text-center text-muted-foreground">
          Không có vật tư hỏng nào đang chờ đưa đi sửa.
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => {
            const noteItems = items.filter((i) => i.noteId === n.id);
            const allChecked = noteItems.length > 0 && noteItems.every((i) => checked.has(i.id));
            const someChecked = noteItems.some((i) => checked.has(i.id));
            if (noteItems.length === 0) return null;
            return (
              <div key={n.id} className="rounded-xl border">
                <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => {
                      const next = new Set(checked);
                      for (const i of noteItems) {
                        if (e.target.checked) next.add(i.id);
                        else next.delete(i.id);
                      }
                      setChecked(next);
                    }}
                    aria-label={`Chọn toàn phiếu ${n.code}`}
                    className="size-4 accent-primary"
                  />
                  <span className="font-mono font-semibold">{n.code}</span>
                  <Badge variant={someChecked && !allChecked ? "warning" : "neutral"}>
                    {allChecked ? "Đã chọn" : someChecked ? "Chọn 1 phần" : "Chờ tập kết"}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {n.reporterName ?? "—"} · {formatDate(n.createdAt)}
                  </span>
                </div>
                <div className="divide-y">
                  {noteItems.map((i) => (
                    <div key={i.id} className="flex items-start gap-3 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={checked.has(i.id)}
                        onChange={() => toggle(i.id)}
                        aria-label="Chọn dòng"
                        className={cn("mt-1 size-4 shrink-0 accent-primary")}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="font-medium">{i.productName ?? "Vật tư"}</span>
                          <span className="shrink-0 text-sm text-muted-foreground">
                            {i.variantLabel} · SL {i.quantity}
                          </span>
                        </div>
                        {i.damageDetail ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">{i.damageDetail}</p>
                        ) : null}
                        {i.note ? (
                          <p className="text-xs text-muted-foreground">Ghi chú: {i.note}</p>
                        ) : null}
                      </div>
                      {i.images.length > 0 ? (
                        <div className="flex shrink-0 gap-1">
                          {i.images.slice(0, 2).map((url) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={url}
                              src={appAssetUrl(url)}
                              alt="Ảnh hỏng"
                              className="size-12 rounded-md border object-cover"
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo phiếu sửa chữa</DialogTitle>
            <DialogDescription>
              Gom {selectedItems.length} dòng ({totalQty} món) từ {selectedNoteIds.size} phiếu HONG
              vào 1 phiếu SC.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Đơn vị sửa chữa</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Công ty sửa chữa…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Ngày gửi</Label>
                <Input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Dự kiến về</Label>
                <Input type="date" value={expectedReturnAt} onChange={(e) => setExpectedReturnAt(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpenForm(false)}>
              Hủy
            </Button>
            <Button type="button" onClick={submit} disabled={pending || !vendor.trim()}>
              {pending ? "Đang tạo…" : "Tạo phiếu sửa chữa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
