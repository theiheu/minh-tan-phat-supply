"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ComboboxInput } from "@/components/combobox-input";
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
  name: string;
  detail: string;
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
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([EMPTY]);
  const [pending, startTransition] = useTransition();

  // Options cho ô gõ-tìm chọn vật tư: dòng 1 = tên, dòng 2 = biến thể · đơn vị,
  // ô sau khi chọn hiện "Tên — biến thể" để biết chính xác đã chọn biến thể nào.
  const variantOptions = useMemo(
    () =>
      variants.map((v) => ({
        value: v.id,
        label: v.name,
        detail: v.detail,
        text: `${v.name} — ${v.detail}`,
      })),
    [variants],
  );
  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers],
  );

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
          notes: notes.trim() ? notes : undefined,
          items: valid.map((i) => ({
            variantId: i.variantId,
            quantity: Number(i.quantity),
            unitCost: Number(i.unitCost) || 0,
            batchNo: i.batchNo || undefined,
            expiryDate: i.expiryDate || undefined,
          })),
        });
        if (postAfterCreate) {
          const linked = (await postReceipt(id)) as string[] | null;
          toast.success(
            linked && linked.length > 0
              ? `Đã ghi nhận phiếu nhập (cấp phát ${linked.length} phiếu yêu cầu)`
              : "Đã ghi nhận phiếu nhập",
          );
          router.push(`/receipts/${id}`);
        } else {
          toast.success("Đã lưu nháp");
          router.push("/receipts");
        }
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
            <ComboboxInput
              value={supplierId ?? ""}
              onChange={(v) => setSupplierId(v === "" ? null : v)}
              options={supplierOptions}
              placeholder="Chọn hoặc gõ tên nhà cung cấp…"
              emptyText="Không tìm thấy nhà cung cấp."
            />
            <p className="text-xs text-muted-foreground">
              Chưa có nhà cung cấp phù hợp?{" "}
              <Link
                href="/admin/suppliers"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Tạo nhà cung cấp mới
              </Link>{" "}
              (mở tab mới, không mất phiếu đang nhập).
            </p>
          </div>
          <div className="max-w-sm space-y-1.5 pt-3">
            <Label>Ghi chú</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú thêm cho phiếu nhập (không bắt buộc)"
              rows={3}
            />
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
              <div key={i} className="relative rounded-lg border bg-muted/30 p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}
                  aria-label="Xóa dòng"
                >
                  <Trash2 className="size-4" />
                </Button>
                <div className="grid grid-cols-1 gap-2 pr-9 sm:grid-cols-2 sm:pr-9 lg:grid-cols-12 lg:pr-10">
                  <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                    <Label className="text-xs">Vật tư</Label>
                    <ComboboxInput
                      value={it.variantId}
                      onChange={(v) => setItem(i, { variantId: v })}
                      options={variantOptions}
                      placeholder="Chọn hoặc gõ tên vật tư…"
                      emptyText="Không tìm thấy vật tư."
                    />
                  </div>
                  <div className="space-y-1 lg:col-span-2">
                    <Label className="text-xs">Số lượng</Label>
                    <Input type="number" min="1" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                  </div>
                  <div className="space-y-1 lg:col-span-2">
                    <Label className="text-xs">Đơn giá</Label>
                    <Input type="number" min="0" value={it.unitCost} onChange={(e) => setItem(i, { unitCost: e.target.value })} />
                  </div>
                  {trackable ? (
                    <>
                      <div className="space-y-1 lg:col-span-2">
                        <Label className="text-xs">Lô</Label>
                        <Input value={it.batchNo} onChange={(e) => setItem(i, { batchNo: e.target.value })} />
                      </div>
                      <div className="space-y-1 lg:col-span-2">
                        <Label className="text-xs">Hạn sử dụng</Label>
                        <Input type="date" value={it.expiryDate} onChange={(e) => setItem(i, { expiryDate: e.target.value })} />
                      </div>
                    </>
                  ) : null}
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
