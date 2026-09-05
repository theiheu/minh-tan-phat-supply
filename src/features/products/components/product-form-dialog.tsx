"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { createProduct, updateProduct } from "../actions";
import { uploadProductImage } from "../upload";
import type { AdminProductRow } from "../types";

interface VariantDraft {
  attributes: string;
  price: string;
  unit: string;
  minStock: string;
  isTrackableLot: boolean;
  imageFile: File | null;
  imagePreview: string | null;
}

const EMPTY_VARIANT: VariantDraft = {
  attributes: "{}",
  price: "",
  unit: "",
  minStock: "0",
  isTrackableLot: false,
  imageFile: null,
  imagePreview: null,
};

function ImagePicker({
  preview,
  onFile,
}: {
  preview: string | null;
  onFile: (file: File | null, preview: string | null) => void;
}) {
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    onFile(file, file ? URL.createObjectURL(file) : null);
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Ảnh</Label>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onChange}
        className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Xem trước" className="h-16 w-16 rounded-lg border object-cover" />
      )}
    </div>
  );
}

export function ProductFormDialog({
  open,
  onOpenChange,
  categories,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string }[];
  product?: AdminProductRow | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(product);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [options, setOptions] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>([EMPTY_VARIANT]);

  useEffect(() => {
    if (open) {
      setName(product?.name ?? "");
      setDescription(product?.description ?? "");
      setCategoryId(product?.categoryId ?? null);
      setOptions((product?.options ?? []).join(", "));
      setImageFile(null);
      setImagePreview(product?.images?.[0] ?? null);
      setVariants([EMPTY_VARIANT]);
    }
  }, [open, product]);

  function setVariant(i: number, patch: Partial<VariantDraft>) {
    setVariants((v) => v.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        let imageUrl = product?.images?.[0];
        if (imageFile) imageUrl = await uploadProductImage(imageFile);

        if (isEdit && product) {
          await updateProduct(product.id, {
            name,
            description,
            categoryId,
            options,
            images: imageUrl ? [imageUrl] : [],
          });
          toast.success("Đã cập nhật vật tư");
        } else {
          const variantInputs = await Promise.all(
            variants.map(async (v) => {
              let vUrl: string | undefined;
              if (v.imageFile) vUrl = await uploadProductImage(v.imageFile);
              return {
                attributes: v.attributes,
                price: v.price === "" ? null : Number(v.price),
                unit: v.unit || null,
                minStock: Number(v.minStock) || 0,
                isTrackableLot: v.isTrackableLot,
                images: vUrl ? [vUrl] : [],
              };
            }),
          );
          await createProduct({
            name,
            description,
            categoryId,
            options,
            images: imageUrl ? [imageUrl] : [],
            variants: variantInputs,
          });
          toast.success("Đã tạo vật tư");
        }

        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lưu vật tư thất bại");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa vật tư" : "Thêm vật tư"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Cập nhật thông tin vật tư." : "Tạo vật tư mới kèm biến thể."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tên vật tư</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Danh mục</Label>
              <Select value={categoryId ?? "none"} onValueChange={(v) => setCategoryId(v === "none" ? null : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Không —</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <ImagePicker
                preview={imagePreview}
                onFile={(f, p) => {
                  setImageFile(f);
                  setImagePreview(p);
                }}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Mô tả</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Options (phân cách bằng dấu phẩy)</Label>
              <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Trọng lượng, Liều" />
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Biến thể</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setVariants((v) => [...v, { ...EMPTY_VARIANT }])}>
                  + Thêm biến thể
                </Button>
              </div>
              {variants.map((v, i) => (
                <div key={i} className="space-y-3 rounded-lg border p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Thuộc tính (JSON)</Label>
                      <Input value={v.attributes} onChange={(e) => setVariant(i, { attributes: e.target.value })} placeholder='{"Trọng lượng":"Bao 10kg"}' />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Giá</Label>
                      <Input type="number" min="0" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Đơn vị</Label>
                      <Input value={v.unit} onChange={(e) => setVariant(i, { unit: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tồn tối thiểu</Label>
                      <Input type="number" min="0" value={v.minStock} onChange={(e) => setVariant(i, { minStock: e.target.value })} />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" checked={v.isTrackableLot} onChange={(e) => setVariant(i, { isTrackableLot: e.target.checked })} className="size-4 accent-primary" />
                        Theo lô
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <ImagePicker
                        preview={v.imagePreview}
                        onFile={(f, p) => setVariant(i, { imageFile: f, imagePreview: p })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setVariants((arr) => arr.filter((_, idx) => idx !== i))}>
                      Xóa biến thể
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Tạo vật tư"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
