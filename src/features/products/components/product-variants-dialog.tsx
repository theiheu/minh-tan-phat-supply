"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { formatVnd } from "@/lib/format";
import { variantLabel } from "@/lib/labels";
import type { Variant } from "@/lib/types";
import { createVariant, deleteVariant, setDefaultVariant, updateVariant } from "../actions";
import { uploadProductImage } from "../upload";
import type { AdminProductRow } from "../types";

export function ProductVariantsDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: AdminProductRow | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [editing, setEditing] = useState<Variant | null>(null);
  const [attributes, setAttributes] = useState("{}");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [isTrackableLot, setIsTrackableLot] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  async function load() {
    if (!product) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("variants")
      .select("*")
      .eq("product_id", product.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    setVariants(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (open && product) {
      load();
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  function resetForm() {
    setEditing(null);
    setAttributes("{}");
    setPrice("");
    setUnit("");
    setMinStock("0");
    setIsTrackableLot(false);
    setImageFile(null);
    setImagePreview(null);
    setShowForm(false);
  }

  function startEdit(v: Variant) {
    setEditing(v);
    setAttributes(JSON.stringify(v.attributes ?? {}));
    setPrice(v.price != null ? String(v.price) : "");
    setUnit(v.unit ?? "");
    setMinStock(String(v.min_stock ?? 0));
    setIsTrackableLot(v.is_trackable_lot ?? false);
    setImageFile(null);
    setImagePreview(v.images?.[0] ?? null);
    setShowForm(true);
  }

  function removeVariant(v: Variant) {
    if (!window.confirm("Xóa biến thể này?")) return;
    startTransition(async () => {
      try {
        await deleteVariant(v.id);
        toast.success("Đã xóa biến thể");
        resetForm();
        await load();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa biến thể thất bại");
      }
    });
  }

  function makeDefault(v: Variant) {
    if (!product) return;
    startTransition(async () => {
      try {
        await setDefaultVariant(product.id, v.id);
        toast.success("Đã đặt biến thể mặc định");
        await load();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Đặt mặc định thất bại");
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    startTransition(async () => {
      try {
        let url: string | undefined;
        if (imageFile) url = await uploadProductImage(imageFile);

        const input = {
          attributes,
          price: price === "" ? null : Number(price),
          unit: unit || null,
          minStock: Number(minStock) || 0,
          isTrackableLot,
          images: url ? [url] : editing?.images?.[0] ? [editing.images[0]] : [],
        };

        if (editing) {
          await updateVariant(editing.id, input);
          toast.success("Đã cập nhật biến thể");
        } else {
          await createVariant(product.id, input);
          toast.success("Đã thêm biến thể");
        }

        resetForm();
        await load();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lưu biến thể thất bại");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Biến thể · {product?.name}</DialogTitle>
          <DialogDescription>Xem, thêm và sửa biến thể cho vật tư này.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Đang tải…</p>
          ) : variants.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có biến thể nào.</p>
          ) : (
            <ul className="space-y-2">
              {variants.map((v) => (
                <li key={v.id} className="flex items-center gap-3 rounded-lg border p-3">
                  {v.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.images[0]} alt="" className="size-12 shrink-0 rounded-md border object-cover" />
                  ) : (
                    <div className="size-12 shrink-0 rounded-md border bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{variantLabel(v.attributes, v.unit)}</div>
                    <div className="text-xs text-muted-foreground">
                      {v.price != null ? formatVnd(v.price) : "—"} · Tồn tối thiểu {v.min_stock} · Đơn vị {v.unit ?? "—"}
                    </div>
                  </div>
                  {v.is_trackable_lot && (
                    <Badge variant="outline" className="bg-sky-100 text-sky-700">
                      Theo lô
                    </Badge>
                  )}
                  {v.is_default && (
                    <Badge variant="outline" className="bg-amber-100 text-amber-700">
                      Mặc định
                    </Badge>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    {!v.is_default && (
                      <Button size="sm" variant="ghost" onClick={() => makeDefault(v)} disabled={pending}>
                        Đặt mặc định
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => startEdit(v)}>
                      Sửa
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => removeVariant(v)} disabled={pending}>
                      Xóa
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => (showForm ? resetForm() : setShowForm(true))}>
              {showForm ? "Đóng" : "+ Thêm biến thể"}
            </Button>
          </div>

          {showForm && (
            <form onSubmit={submit} className="space-y-3 rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Thuộc tính (JSON)</Label>
                  <Input value={attributes} onChange={(e) => setAttributes(e.target.value)} placeholder='{"Trọng lượng":"Bao 10kg"}' />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Giá</Label>
                  <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Đơn vị</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tồn tối thiểu</Label>
                  <Input type="number" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={isTrackableLot}
                      onChange={(e) => setIsTrackableLot(e.target.checked)}
                      className="size-4 accent-primary"
                    />
                    Theo lô
                  </label>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Ảnh biến thể</Label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setImageFile(f);
                      setImagePreview(f ? URL.createObjectURL(f) : null);
                    }}
                    className="block w-full text-sm text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary-foreground"
                  />
                  {imagePreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imagePreview} alt="Xem trước" className="mt-1.5 h-12 w-12 rounded-md border object-cover" />
                  )}
                </div>
              </div>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Đang lưu…" : editing ? "Lưu biến thể" : "Thêm biến thể"}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
