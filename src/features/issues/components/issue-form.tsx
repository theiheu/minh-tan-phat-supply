"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComboboxInput } from "@/components/combobox-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ISSUE_DESTINATION } from "@/lib/labels";
import { createIssue } from "../actions";

interface ItemDraft {
  variantId: string;
  quantity: string;
  unitPrice: string;
}

interface VariantOption {
  id: string;
  name: string;
  detail: string;
  isTrackableLot: boolean;
  price: number | null;
}

type DestinationType = "zone" | "customer";

const EMPTY: ItemDraft = { variantId: "", quantity: "1", unitPrice: "" };

export function IssueForm({
  zones,
  customers,
  variants,
}: {
  zones: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  variants: VariantOption[];
}) {
  const router = useRouter();
  const [destinationType, setDestinationType] = useState<DestinationType>("zone");
  const [zoneId, setZoneId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([EMPTY]);
  const [pending, startTransition] = useTransition();

  const isSale = destinationType === "customer";

  // Options cho ô gõ-tìm chọn vật tư: dòng 1 = tên, dòng 2 = biến thể · đơn vị,
  // ô sau khi chọn hiện "Tên — biến thể" để biết chính xác đã chọn biến thể nào.
  const variantOptions = variants.map((v) => ({
    value: v.id,
    label: v.name,
    detail: v.detail,
    text: `${v.name} — ${v.detail}`,
  }));
  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));

  function setItem(i: number, patch: Partial<ItemDraft>) {
    setItems((arr) => arr.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  // Khi bán cho khách: tự điền đơn giá theo giá bán của biến thể được chọn.
  // Luôn làm mới giá khi đổi sang biến thể KHÁC (tránh giữ giá cũ của biến thể trước)
  // và xoá đơn giá khi xoá lựa chọn. Chỉ khi chọn lại ĐÚNG biến thể đang có trên dòng
  // thì giữ nguyên giá người dùng đã nhập (không đè).
  function onPickVariant(i: number, v: string) {
    setItems((arr) =>
      arr.map((row, idx) => {
        if (idx !== i) return row;
        const next: ItemDraft = { ...row, variantId: v };
        if (!isSale) return next;
        if (v === "") {
          // Xoá lựa chọn biến thể → bỏ đơn giá còn sót lại.
          next.unitPrice = "";
        } else if (v !== row.variantId || !next.unitPrice) {
          // Đổi biến thể khác, hoặc vừa chọn lần đầu còn ô giá trống → điền giá của biến thể mới.
          const price = variants.find((x) => x.id === v)?.price;
          next.unitPrice = price != null ? String(price) : "";
        }
        return next;
      }),
    );
  }

  async function run() {
    const valid = items.filter((i) => i.variantId && Number(i.quantity) > 0);
    if (valid.length === 0) return toast.error("Thêm ít nhất 1 vật tư");
    if (destinationType === "zone" && !zoneId) return toast.error("Chọn khu nhận");
    if (isSale) {
      if (!customerId) return toast.error("Chọn khách hàng");
      if (valid.some((i) => !(Number(i.unitPrice) > 0)))
        return toast.error("Nhập đơn giá cho từng vật tư (phiếu bán cho khách)");
    }

    startTransition(async () => {
      try {
        const id = await createIssue({
          destinationType,
          zoneId: destinationType === "zone" ? zoneId : null,
          customerId: isSale ? customerId : null,
          vehiclePlate: vehiclePlate.trim() ? vehiclePlate.trim() : undefined,
          driverName: driverName.trim() ? driverName.trim() : undefined,
          notes: notes.trim() ? notes.trim() : undefined,
          items: valid.map((i) => ({
            variantId: i.variantId,
            quantity: Number(i.quantity),
            unitPrice: isSale ? Number(i.unitPrice) : undefined,
          })),
        });
        toast.success("Đã tạo phiếu xuất (nháp)");
        router.push(`/issues/${id}`);
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
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Kiểu đích</Label>
            <Select
              value={destinationType}
              onValueChange={(v) => {
                const next = v as DestinationType;
                setDestinationType(next);
                if (next === "zone") setCustomerId("");
                if (next === "customer") setZoneId("");
                // Đổi kiểu đích = bắt đầu ngữ cảnh phiếu mới: không giữ text vận chuyển
                // của kiểu cũ, để phiếu khu nội bộ không mang theo biển xe/tài xế.
                setVehiclePlate("");
                setDriverName("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ISSUE_DESTINATION) as DestinationType[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {ISSUE_DESTINATION[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {destinationType === "zone" ? (
            <div className="space-y-1.5">
              <Label>Khu nhận</Label>
              <Select value={zoneId} onValueChange={setZoneId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn khu nhận" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Khách hàng</Label>
              <ComboboxInput
                value={customerId}
                onChange={(v) => setCustomerId(v === "" ? "" : v)}
                options={customerOptions}
                placeholder="Chọn hoặc gõ tên khách hàng…"
                emptyText="Không tìm thấy khách hàng."
              />
              <p className="text-xs text-muted-foreground">
                Chưa có khách hàng phù hợp?{" "}
                <Link
                  href="/admin/customers"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Thêm khách mới
                </Link>{" "}
                (mở tab mới, không mất phiếu đang lập).
              </p>
            </div>
          )}

          {isSale && (
            <>
              <div className="space-y-1.5">
                <Label>Biển số xe</Label>
                <Input
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="Biển số xe vận chuyển (không bắt buộc)"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Người vận chuyển</Label>
                <Input
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Tên người vận chuyển (không bắt buộc)"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Ghi chú</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú thêm cho phiếu xuất (không bắt buộc)"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Vật tư xuất</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((a) => [...a, EMPTY])}>
            + Thêm dòng
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((it, i) => (
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
                <div className="space-y-1 sm:col-span-2 lg:col-span-5">
                  <Label className="text-xs">Vật tư</Label>
                  <ComboboxInput
                    value={it.variantId}
                    onChange={(v) => onPickVariant(i, v)}
                    options={variantOptions}
                    placeholder="Chọn hoặc gõ tên vật tư…"
                    emptyText="Không tìm thấy vật tư."
                  />
                </div>
                <div className="space-y-1 lg:col-span-2">
                  <Label className="text-xs">Số lượng</Label>
                  <Input
                    type="number"
                    min="1"
                    value={it.quantity}
                    onChange={(e) => setItem(i, { quantity: e.target.value })}
                  />
                </div>
                {isSale && (
                  <div className="space-y-1 lg:col-span-2">
                    <Label className="text-xs">Đơn giá</Label>
                    <Input
                      type="number"
                      min="0"
                      value={it.unitPrice}
                      onChange={(e) => setItem(i, { unitPrice: e.target.value })}
                      placeholder="đ"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={run} disabled={pending}>
          {pending ? "Đang xử lý…" : "Tạo phiếu xuất"}
        </Button>
      </div>
    </div>
  );
}
