"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ComboboxInput } from "@/components/combobox-input";
import { createReceipt, postReceipt, updateReceipt } from "../actions";
import { uploadReceiptInvoiceImage } from "../upload";
import { ZoomableImage } from "@/components/image-lightbox";
import { cn } from "@/lib/utils";

export interface ItemDraft {
  variantId: string;
  quantity: string;
  unitCost: string;
  batchNo: string;
  expiryDate: string;
}

export interface VariantOption {
  id: string;
  name: string;
  detail: string;
  isTrackableLot: boolean;
}

const EMPTY: ItemDraft = { variantId: "", quantity: "1", unitCost: "", batchNo: "", expiryDate: "" };

export function ReceiptForm({
  suppliers,
  variants,
  receiptId,
  receiptCode,
  receiptStatus,
  initialSupplierId = null,
  initialNotes = "",
  initialInvoiceImages = [],
  initialItems,
  onSuccess,
  onCancel,
}: {
  suppliers: { id: string; name: string }[];
  variants: VariantOption[];
  receiptId?: string;
  receiptCode?: string;
  receiptStatus?: string;
  initialSupplierId?: string | null;
  initialNotes?: string;
  initialInvoiceImages?: string[];
  initialItems?: ItemDraft[];
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(receiptId);
  const isApproved = receiptStatus === "approved";
  const [supplierId, setSupplierId] = useState<string | null>(initialSupplierId);
  const [notes, setNotes] = useState(initialNotes);
  const [invoiceImages, setInvoiceImages] = useState<string[]>(initialInvoiceImages);
  const [uploadingInvoices, setUploadingInvoices] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>(
    initialItems && initialItems.length > 0 ? initialItems : [EMPTY],
  );
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

  async function handleInvoiceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadingInvoices(true);
    try {
      const urls = await Promise.all(files.map((f) => uploadReceiptInvoiceImage(f)));
      setInvoiceImages((prev) => [...prev, ...urls]);
      toast.success(`Đã tải lên ${urls.length} ảnh hóa đơn / chứng từ`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải ảnh thất bại");
    } finally {
      setUploadingInvoices(false);
      e.target.value = "";
    }
  }

  function removeInvoiceImage(url: string) {
    setInvoiceImages((prev) => prev.filter((u) => u !== url));
  }

  async function run(postAfterSave: boolean) {
    const valid = items.filter((i) => i.variantId && Number(i.quantity) > 0);
    if (valid.length === 0) return toast.error("Thêm ít nhất 1 vật tư");

    startTransition(async () => {
      try {
        const payload = {
          supplierId,
          notes: notes.trim() ? notes : undefined,
          invoiceImages,
          items: valid.map((i) => ({
            variantId: i.variantId,
            quantity: Number(i.quantity),
            unitCost: Number(i.unitCost) || 0,
            batchNo: i.batchNo || undefined,
            expiryDate: i.expiryDate || undefined,
          })),
        };

        let targetId = receiptId;
        if (isEditing && receiptId) {
          await updateReceipt(receiptId, payload);
        } else {
          targetId = await createReceipt(payload);
        }

        if (postAfterSave && targetId) {
          const linked = (await postReceipt(targetId)) as string[] | null;
          toast.success(
            linked && linked.length > 0
              ? `Đã duyệt nhập kho thành công (tự động cấp phát ${linked.length} phiếu yêu cầu)`
              : "Đã duyệt nhập kho thành công",
          );
          if (onSuccess) {
            onSuccess(targetId);
          } else {
            router.push(`/receipts/${targetId}`);
          }
        } else {
          toast.success(
            isEditing
              ? isApproved
                ? "Đã lưu kết quả kiểm đếm & hóa đơn"
                : "Đã lưu cập nhật phiếu đặt hàng"
              : "Đã lưu phiếu đặt hàng (chờ duyệt)",
          );
          if (onSuccess && targetId) {
            onSuccess(targetId);
          } else {
            router.push(targetId ? `/receipts/${targetId}` : "/receipts");
          }
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card className="border-2 border-border shadow-xs rounded-xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {isEditing
              ? isApproved
                ? `Kiểm đếm & Đối chiếu hàng về (${receiptCode ?? ""})`
                : `Chỉnh sửa thông tin phiếu đặt hàng (${receiptCode ?? ""})`
              : "Thông tin phiếu đặt hàng / nhập kho"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-1.5">
            <Label className="font-medium">Nhà cung cấp</Label>
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
          <div className="max-w-md space-y-1.5 pt-3">
            <Label className="font-medium">Ghi chú</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú thêm cho phiếu nhập (không bắt buộc)"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-border shadow-xs rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Hóa đơn & Chứng từ mua hàng</CardTitle>
            <p className="text-xs text-muted-foreground">
              Tải ảnh chụp hóa đơn VAT, phiếu giao hàng hoặc biên bản giao nhận từ nhà cung cấp trước khi duyệt nhập kho.
            </p>
          </div>
          <Label className="cursor-pointer">
            <Button variant="outline" size="sm" type="button" asChild disabled={uploadingInvoices} className="h-9 gap-1.5 text-xs">
              <span>
                <ImagePlus className="size-4" />
                {uploadingInvoices ? "Đang tải ảnh…" : "Tải ảnh hóa đơn"}
              </span>
            </Button>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="sr-only"
              disabled={uploadingInvoices}
              onChange={handleInvoiceUpload}
            />
          </Label>
        </CardHeader>
        <CardContent>
          {invoiceImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 text-center text-sm text-muted-foreground">
              <ImagePlus className="mb-2 size-8 text-muted-foreground/50" />
              <span>Chưa có ảnh hóa đơn mua hàng</span>
              <span className="text-xs">Bấm nút trên để tải ảnh từ máy tính hoặc điện thoại</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {invoiceImages.map((url, idx) => (
                <div key={url} className="relative group">
                  <ZoomableImage
                    src={url}
                    images={invoiceImages}
                    alt={`Hóa đơn ${idx + 1}`}
                    title={`Hóa đơn mua hàng #${idx + 1}`}
                    className="size-24 rounded-lg border-2 object-cover shadow-sm sm:size-28"
                  />
                  <button
                    type="button"
                    onClick={() => removeInvoiceImage(url)}
                    className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700"
                    aria-label="Xóa ảnh này"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-border shadow-xs rounded-xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Vật tư nhập</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {items.map((it, i) => {
              const trackable = variants.find((v) => v.id === it.variantId)?.isTrackableLot;
              return (
                <div key={i} className="relative rounded-xl border-2 border-border/80 bg-muted/30 p-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-2 top-2 z-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}
                    aria-label="Xóa dòng"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  <div className="grid grid-cols-1 gap-2.5 pr-9 sm:grid-cols-2 sm:pr-9 lg:grid-cols-12 lg:pr-10">
                    <div className={cn("space-y-1 sm:col-span-2", trackable ? "lg:col-span-5" : "lg:col-span-6")}>
                      <Label className="text-xs font-semibold">Vật tư</Label>
                      <ComboboxInput
                        value={it.variantId}
                        onChange={(v) => setItem(i, { variantId: v })}
                        options={variantOptions}
                        placeholder="Chọn hoặc gõ tên vật tư…"
                        emptyText="Không tìm thấy vật tư."
                      />
                    </div>
                    <div className={cn("space-y-1", trackable ? "lg:col-span-2" : "lg:col-span-3")}>
                      <Label className="text-xs font-semibold">Số lượng</Label>
                      <Input type="number" min="1" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                    </div>
                    <div className={cn("space-y-1", trackable ? "lg:col-span-2" : "lg:col-span-3")}>
                      <Label className="text-xs font-semibold">Đơn giá</Label>
                      <Input type="number" min="0" value={it.unitCost} onChange={(e) => setItem(i, { unitCost: e.target.value })} placeholder="đ" />
                    </div>
                    {trackable ? (
                      <>
                        <div className="space-y-1 lg:col-span-1.5">
                          <Label className="text-xs font-semibold">Lô</Label>
                          <Input value={it.batchNo} onChange={(e) => setItem(i, { batchNo: e.target.value })} placeholder="Số lô" />
                        </div>
                        <div className="space-y-1 lg:col-span-1.5">
                          <Label className="text-xs font-semibold">Hạn sử dụng</Label>
                          <Input type="date" value={it.expiryDate} onChange={(e) => setItem(i, { expiryDate: e.target.value })} />
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems((a) => [...a, EMPTY])}
              className="h-9 gap-1.5 px-3 text-xs font-medium"
            >
              <Plus className="size-3.5" aria-hidden />
              Thêm dòng
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Hủy
          </Button>
        )}
        <Button variant="outline" onClick={() => run(false)} disabled={pending}>
          {isEditing
            ? isApproved
              ? "Lưu kiểm đếm (chưa nhập kho)"
              : "Lưu thay đổi"
            : "Lưu phiếu đặt hàng"}
        </Button>
        <Button onClick={() => run(true)} disabled={pending}>
          {pending
            ? "Đang xử lý…"
            : isApproved
              ? "Duyệt nhập kho"
              : isEditing
                ? "Lưu & Nhập kho ngay"
                : "Lưu & Nhập kho ngay"}
        </Button>
      </div>
    </div>
  );
}
