"use client";

import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import { ZoomableImage } from "@/components/image-lightbox";
import { formatVnd } from "@/lib/format";
import { createFuelReceiptAction } from "../actions";
import { uploadFuelImage } from "../upload";
import type { FuelType } from "../types";

export function FuelReceiptDialog({
  fuelTypes,
  suppliers,
  onSaved,
}: {
  fuelTypes: FuelType[];
  suppliers: { id: string; name: string }[];
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [fuelTypeId, setFuelTypeId] = useState(fuelTypes[0]?.id || "");
  const [supplierId, setSupplierId] = useState("none");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceImages, setInvoiceImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [notes, setNotes] = useState("");

  const numQty = Math.max(0, Number(quantity) || 0);
  const numPrice = Math.max(0, Number(unitPrice) || 0);
  const totalAmount = numQty * numPrice;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImage(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadFuelImage(file);
        urls.push(url);
      }
      setInvoiceImages((prev) => [...prev, ...urls]);
      toast.success(`Đã tải lên ${urls.length} ảnh hóa đơn/chứng từ`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lỗi khi tải ảnh lên");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  function removeImage(index: number) {
    setInvoiceImages((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!fuelTypeId) {
      toast.error("Vui lòng chọn loại dầu nhập");
      return;
    }
    if (numQty <= 0) {
      toast.error("Số lượng nhập phải lớn hơn 0");
      return;
    }

    startTransition(async () => {
      try {
        await createFuelReceiptAction({
          fuelTypeId,
          supplierId: supplierId === "none" ? null : supplierId,
          quantity: numQty,
          unitPrice: numPrice,
          invoiceNumber: invoiceNumber.trim() ? invoiceNumber.trim() : undefined,
          invoiceImages,
          notes: notes.trim() ? notes.trim() : undefined,
        });

        toast.success("Đã tạo phiếu nhập kho dầu thành công");
        setOpen(false);
        // Reset form
        setQuantity("");
        setUnitPrice("");
        setInvoiceNumber("");
        setInvoiceImages([]);
        setNotes("");
        onSaved?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Lỗi khi tạo phiếu nhập");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs sm:text-sm h-9">
          <Plus className="mr-1.5 size-3.5 sm:size-4" />
          Nhập dầu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nhập kho dầu / Nhiên liệu</DialogTitle>
          <DialogDescription>
            Ghi nhận đợt nhập dầu từ nhà cung cấp (Petrolimex, PVOIL...). Tồn kho sẽ tự động tăng.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fuelTypeId" className="text-xs font-semibold">
                Loại dầu / Nhiên liệu <span className="text-destructive">*</span>
              </Label>
              <Select value={fuelTypeId} onValueChange={setFuelTypeId} disabled={pending}>
                <SelectTrigger id="fuelTypeId">
                  <SelectValue placeholder="Chọn loại dầu" />
                </SelectTrigger>
                <SelectContent>
                  {fuelTypes.map((ft) => (
                    <SelectItem key={ft.id} value={ft.id}>
                      {ft.name} ({ft.unit}) - Tồn: {ft.current_stock}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quantity" className="text-xs font-semibold">
                Số lượng nhập (Lít) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="VD: 2500"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={pending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unitPrice" className="text-xs font-semibold">
                Đơn giá nhập / Lít (VNĐ)
              </Label>
              <Input
                id="unitPrice"
                type="number"
                step="1"
                min="0"
                placeholder="VD: 19500"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                disabled={pending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supplierId" className="text-xs font-semibold">Nhà cung cấp</Label>
              <Select value={supplierId} onValueChange={setSupplierId} disabled={pending}>
                <SelectTrigger id="supplierId">
                  <SelectValue placeholder="Chọn nhà cung cấp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Không chọn / Mua ngoài --</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoiceNumber" className="text-xs font-semibold">Số hóa đơn / Phiếu giao hàng</Label>
              <Input
                id="invoiceNumber"
                placeholder="VD: HD-0019283"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                disabled={pending}
              />
            </div>

            {totalAmount > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Tổng tiền thanh toán dự tính:</p>
                <p className="text-lg font-bold text-primary">{formatVnd(totalAmount)}</p>
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">Ảnh hóa đơn / Phiếu giao hàng</Label>
              <div className="flex flex-wrap gap-2">
                {invoiceImages.map((img, idx) => (
                  <div key={idx} className="relative size-16 overflow-hidden rounded-lg border">
                    <ZoomableImage
                      src={img}
                      images={invoiceImages}
                      alt="Hóa đơn"
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 rounded-full bg-destructive p-0.5 text-white"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
                <label className="flex size-16 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed hover:bg-muted">
                  <ImagePlus className="size-5 text-muted-foreground" />
                  <span className="mt-1 text-[10px] text-muted-foreground">Thêm ảnh</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploadingImage || pending}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes" className="text-xs font-semibold">Ghi chú</Label>
              <Textarea
                id="notes"
                placeholder="Ghi chú thêm về đợt nhập dầu..."
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending || uploadingImage}>
              {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Xác nhận nhập dầu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
