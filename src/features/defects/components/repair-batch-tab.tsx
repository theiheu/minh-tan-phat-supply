"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboboxInput, type ComboboxInputOption } from "@/components/combobox-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageOff, Wrench } from "lucide-react";
import { cn } from "cn";
import { formatDate } from "@/lib/format";
import { ZoomableImage } from "@/components/image-lightbox";
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
  isCollected?: boolean;
  collectedAt?: string | null;
  repairRequested?: boolean;
}

export function RepairBatchTab({
  notes,
  items,
  suppliers = [],
}: {
  notes: BatchNote[];
  items: BatchItem[];
  suppliers?: { id: string; name: string; phone?: string | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [openForm, setOpenForm] = useState(false);
  const [vendor, setVendor] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");

  const supplierOptions: ComboboxInputOption[] = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s.name,
        label: s.name,
        hint: s.phone ?? undefined,
      })),
    [suppliers],
  );

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
          Vật tư tại Kho đồ hỏng → gom tạo <span className="font-medium text-foreground">1 phiếu sửa chữa (SC)</span> đưa đi sửa cùng đơn vị. Theo dõi tại màn{" "}
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
                    {allChecked ? "Đã chọn" : someChecked ? "Chọn 1 phần" : "Tại kho đồ hỏng"}
                  </Badge>
                  {n.isCollected ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 text-[11px]">
                      Đã về kho
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-300 text-[11px]">
                      Chưa về kho
                    </Badge>
                  )}
                  {n.repairRequested && (
                    <Badge variant="warning" className="text-[11px]">
                      Chờ xác nhận sửa
                    </Badge>
                  )}
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
                        className={cn("mt-3.5 size-4 shrink-0 accent-primary")}
                      />
                      {i.images.length > 0 ? (
                        <div className="flex shrink-0 gap-1">
                          {i.images.slice(0, 2).map((url) => (
                            <ZoomableImage
                              key={url}
                              src={url}
                              images={i.images}
                              alt={`${i.productName ?? "Vật tư"} — ảnh hỏng`}
                              title={i.productName ?? "Ảnh hỏng"}
                              className="size-12 rounded-md border object-cover"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                          <ImageOff className="size-4" aria-hidden />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="font-medium">{i.productName ?? "Vật tư"}</span>
                          <span className="shrink-0 text-sm text-muted-foreground">
                            {i.variantLabel} · <span className="font-semibold text-foreground">SL {i.quantity}</span>
                          </span>
                        </div>
                        {i.damageDetail ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">{i.damageDetail}</p>
                        ) : null}
                        {i.note ? (
                          <p className="text-xs text-muted-foreground">Ghi chú: {i.note}</p>
                        ) : null}
                      </div>
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
              <Label className="text-sm font-medium">Đơn vị sửa chữa (Nhà cung cấp)</Label>
              <ComboboxInput
                value={vendor}
                onChange={setVendor}
                options={supplierOptions}
                placeholder="Chọn hoặc tìm nhà cung cấp…"
                emptyText="Không tìm thấy nhà cung cấp."
              />
              <p className="text-xs text-muted-foreground">
                Chưa có đơn vị phù hợp?{" "}
                <Link
                  href="/admin/suppliers"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Tạo nhà cung cấp mới
                </Link>{" "}
                (mở tab mới).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Ngày gửi</Label>
                <Input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Dự kiến về <span className="text-xs font-normal text-muted-foreground">(không bắt buộc)</span>
                </Label>
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
