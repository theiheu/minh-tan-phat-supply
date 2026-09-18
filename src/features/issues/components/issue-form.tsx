"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SearchSelect } from "@/components/search-select";
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
import { Textarea } from "@/components/ui/textarea";
import { ZoneSubZoneSelect } from "@/components/zone-sub-zone-select";
import { SkuSelector } from "@/features/catalog/components/sku-selector";
import { TransactionUomSelect } from "@/features/catalog/components/transaction-uom-select";
import { createIssue } from "../actions";

type DestinationType = "zone" | "customer";

export interface IssueItemDraft {
  skuId: string;
  transactionUnitId: string;
  enteredQuantity: string;
  unitPrice: string;
  trackingPolicy: string;
  batchNo: string;
  expiryDate: string;
  overrideReason: string;
}

const EMPTY: IssueItemDraft = {
  skuId: "",
  transactionUnitId: "",
  enteredQuantity: "1",
  unitPrice: "",
  trackingPolicy: "none",
  batchNo: "",
  expiryDate: "",
  overrideReason: "",
};

export function IssueForm({
  zones,
  subZones = [],
  customers,
  skus: _skus,
  onSuccess,
  onCancel,
}: {
  zones: { id: string; name: string }[];
  subZones?: { id: string; zone_id: string; name: string }[];
  customers: { id: string; name: string }[];
  skus?: { id: string; name?: string; detail?: string; isTrackableLot?: boolean; price?: number | null; label?: string }[];
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [destinationType, setDestinationType] = useState<DestinationType>("zone");
  const [zoneId, setZoneId] = useState("");
  const [subZoneId, setSubZoneId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<IssueItemDraft[]>([EMPTY]);
  const [pending, startTransition] = useTransition();

  const isSale = destinationType === "customer";
  const customerOptions = useMemo(() => customers.map((c) => ({ value: c.id, label: c.name })), [customers]);

  function setItem(i: number, patch: Partial<IssueItemDraft>) {
    setItems((arr) => arr.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function run() {
    if (destinationType === "zone" && !zoneId) return toast.error("Chọn khu vực nhận hàng");
    if (destinationType === "customer" && !customerId) return toast.error("Chọn khách hàng");

    const validItems = items.filter((i) => i.skuId && Number(i.enteredQuantity) > 0);
    if (validItems.length === 0) return toast.error("Cần ít nhất một vật tư hợp lệ");

    for (const it of validItems) {
      if (isSale && (!it.unitPrice || Number(it.unitPrice) <= 0)) {
        return toast.error("Xuất bán cho khách hàng yêu cầu nhập đơn giá > 0");
      }
    }

    startTransition(async () => {
      try {
        const id = await createIssue({
          destinationType,
          zoneId: destinationType === "zone" ? zoneId : undefined,
          subZoneId: destinationType === "zone" && subZoneId ? subZoneId : undefined,
          customerId: destinationType === "customer" ? customerId : undefined,
          vehiclePlate: vehiclePlate.trim() || undefined,
          driverName: driverName.trim() || undefined,
          notes: notes.trim() || undefined,
          items: validItems.map((i) => ({
            skuId: i.skuId,
            enteredQuantity: Number(i.enteredQuantity) || 0,
            transactionUnitId: i.transactionUnitId || undefined,
            unitPrice: isSale ? Number(i.unitPrice) || 0 : undefined,
            batchNo: i.batchNo || undefined,
            expiryDate: i.expiryDate || undefined,
            overrideReason: i.overrideReason || undefined,
          })),
        });

        toast.success("Đã tạo phiếu xuất kho");
        if (onSuccess) onSuccess(id);
        else {
          router.push(`/issues/${id}`);
          router.refresh();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Tạo phiếu xuất thất bại");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card className="border-2 border-border shadow-xs rounded-xl">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base font-semibold">Thông tin xuất kho</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Loại xuất kho</Label>
            <Select
              value={destinationType}
              onValueChange={(v) => setDestinationType(v as DestinationType)}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zone">Xuất nội bộ (Khu trại / xưởng)</SelectItem>
                <SelectItem value="customer">Xuất bán (Khách hàng)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {destinationType === "zone" ? (
            <ZoneSubZoneSelect
              zones={zones}
              subZones={subZones}
              zoneId={zoneId}
              subZoneId={subZoneId}
              onZoneChange={setZoneId}
              onSubZoneChange={setSubZoneId}
              required
            />
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Khách hàng</Label>
              <SearchSelect
                value={customerId}
                onChange={setCustomerId}
                options={customerOptions}
                placeholder="Chọn khách hàng…"
                searchPlaceholder="Gõ tên khách hàng để tìm…"
                emptyText="Không tìm thấy khách hàng."
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Biển số xe (tuỳ chọn)</Label>
              <Input
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                placeholder="VD: 51A-123.45"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Người vận chuyển (tuỳ chọn)</Label>
              <Input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Tên tài xế/người nhận"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Ghi chú</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú nội dung xuất hàng…"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-border shadow-xs rounded-xl">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base font-semibold">Danh sách vật tư xuất</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {items.map((it, i) => (
            <div key={i} className="relative rounded-lg border border-border/80 bg-muted/20 p-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute right-2 top-2 text-muted-foreground hover:text-destructive"
                onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}
                aria-label="Xóa dòng"
              >
                <Trash2 className="size-4" />
              </Button>
              <div className="grid grid-cols-1 gap-2 pr-8 sm:grid-cols-12">
                <div className="sm:col-span-5 space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">Vật tư</Label>
                  <SkuSelector
                    value={it.skuId}
                    onSelect={(sku) => {
                      setItem(i, {
                        skuId: sku.skuId,
                        trackingPolicy: sku.trackingPolicy,
                      });
                    }}
                  />
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">Đơn vị</Label>
                  <TransactionUomSelect
                    skuId={it.skuId}
                    value={it.transactionUnitId}
                    onValueChange={(v) => setItem(i, { transactionUnitId: v })}
                    disabled={!it.skuId}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">Số lượng</Label>
                  <Input
                    type="number"
                    min="0.000001"
                    step="any"
                    value={it.enteredQuantity}
                    onChange={(e) => setItem(i, { enteredQuantity: e.target.value })}
                  />
                </div>
                {isSale ? (
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Đơn giá</Label>
                    <Input
                      type="number"
                      min="0"
                      value={it.unitPrice}
                      onChange={(e) => setItem(i, { unitPrice: e.target.value })}
                      placeholder="VNĐ"
                    />
                  </div>
                ) : (
                  <div className="sm:col-span-2" />
                )}
              </div>

              {it.trackingPolicy && it.trackingPolicy !== "none" && (
                <div className="mt-2.5 grid grid-cols-1 gap-2 border-t border-border/40 pt-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Số lô (tuỳ chọn FEFO)</Label>
                    <Input
                      className="h-8 text-xs"
                      value={it.batchNo}
                      onChange={(e) => setItem(i, { batchNo: e.target.value })}
                      placeholder="Để trống tự chọn FEFO"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Hạn sử dụng</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={it.expiryDate}
                      onChange={(e) => setItem(i, { expiryDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Lý do chỉ định lô</Label>
                    <Input
                      className="h-8 text-xs"
                      value={it.overrideReason}
                      onChange={(e) => setItem(i, { overrideReason: e.target.value })}
                      placeholder="Bắt buộc nếu đổi lô"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((a) => [...a, EMPTY])}
            className="w-full"
          >
            <Plus className="mr-1 size-4" /> Thêm vật tư
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Hủy
          </Button>
        )}
        <Button onClick={run} disabled={pending}>
          {pending ? "Đang xử lý…" : "Tạo phiếu xuất"}
        </Button>
      </div>
    </div>
  );
}
