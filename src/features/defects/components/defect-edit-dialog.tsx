"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { ComboboxInput, type ComboboxInputOption } from "@/components/combobox-input";
import { updateDefect } from "../actions";
import { uploadDefectImage } from "../upload";
import { ZoomableImage } from "@/components/image-lightbox";
import type { DefectListRow } from "./defects-list";

interface ItemDraft {
  variantId: string;
  quantity: string;
  damageDetail: string;
  note: string;
  images: string[];
  uploading: boolean;
}

const EMPTY: ItemDraft = {
  variantId: "",
  quantity: "1",
  damageDetail: "",
  note: "",
  images: [],
  uploading: false,
};

export function DefectEditDialog({
  row,
  sourceLocationId,
  variants,
  open,
  onOpenChange,
  onSuccess,
}: {
  row: DefectListRow;
  sourceLocationId: string;
  variants: { id: string; name: string; detail: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open && row) {
      if (row.items && row.items.length > 0) {
        setItems(
          row.items.map((i) => ({
            variantId: i.variantId ?? "",
            quantity: String(i.quantity ?? 1),
            damageDetail: i.damageDetail ?? "",
            note: i.note ?? "",
            images: i.images ?? [],
            uploading: false,
          })),
        );
      } else {
        setItems([EMPTY]);
      }
    }
  }, [open, row]);

  const variantOptions: ComboboxInputOption[] = variants.map((v) => ({
    value: v.id,
    label: v.name,
    detail: v.detail,
    text: v.detail ? `${v.name} — ${v.detail}` : v.name,
  }));

  function setItem(i: number, patch: Partial<ItemDraft>) {
    setItems((arr) => arr.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }

  async function uploadRowImages(i: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    setItem(i, { uploading: true });
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadDefectImage(file));
      }
      const currentRow = items[i];
      setItems((arr) =>
        arr.map((r, idx) =>
          idx === i ? { ...r, images: [...(currentRow?.images ?? []), ...urls], uploading: false } : r,
        ),
      );
    } catch (err) {
      setItem(i, { uploading: false });
      toast.error(err instanceof Error ? err.message : "Upload ảnh thất bại");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const valid = items.filter(
      (i) => i.variantId && i.damageDetail.trim() && i.images.length >= 1 && Number(i.quantity) > 0,
    );
    if (valid.length === 0) {
      return toast.error("Nhập ít nhất 1 dòng đầy đủ: tên, số lượng, mô tả và 1 ảnh");
    }

    startTransition(async () => {
      try {
        await updateDefect(row.id, {
          sourceLocationId: row.sourceLocationId ?? sourceLocationId,
          items: valid.map((i) => ({
            variantId: i.variantId,
            quantity: Number(i.quantity),
            damageDetail: i.damageDetail.trim(),
            note: i.note.trim(),
            images: i.images,
          })),
        });

        toast.success(`Đã cập nhật phiếu hỏng ${row.code}`);
        onOpenChange(false);
        onSuccess();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-4xl lg:max-w-5xl h-[92svh] max-h-[92svh] sm:h-auto sm:max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden border-2 border-border shadow-2xl rounded-2xl">
        <DialogHeader className="shrink-0 pb-2 border-b">
          <DialogTitle className="text-base font-semibold font-mono">
            Chỉnh sửa phiếu hỏng: {row.code}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Cập nhật danh sách vật tư hỏng, mô tả sự cố và hình ảnh minh chứng.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex-1 min-h-0 flex flex-col pt-2">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-3">
            {items.map((it, idx) => (
              <Card key={idx} className="border-border/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground">
                    Vật tư #{idx + 1}
                  </CardTitle>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setItems((arr) => arr.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </CardHeader>

                <CardContent className="space-y-3 p-3 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-8 space-y-1">
                      <Label className="text-xs">Vật tư hỏng <span className="text-destructive">*</span></Label>
                      <ComboboxInput
                        options={variantOptions}
                        value={it.variantId}
                        onChange={(v) => setItem(idx, { variantId: v })}
                        placeholder="Chọn vật tư…"
                        emptyText="Không tìm thấy vật tư"
                      />
                    </div>
                    <div className="sm:col-span-4 space-y-1">
                      <Label className="text-xs">Số lượng hỏng <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => setItem(idx, { quantity: e.target.value })}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">
                      Mô tả hỏng hóc <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={it.damageDetail}
                      onChange={(e) => setItem(idx, { damageDetail: e.target.value })}
                      placeholder="Mô tả chi tiết vị trí/tình trạng hỏng…"
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Ghi chú thêm</Label>
                    <Input
                      value={it.note}
                      onChange={(e) => setItem(idx, { note: e.target.value })}
                      placeholder="Ghi chú thêm nếu có…"
                      className="h-9"
                    />
                  </div>

                  {/* Ảnh minh chứng */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Ảnh minh chứng <span className="text-destructive">*</span> (ít nhất 1 ảnh)
                    </Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {it.images.map((url, imgIdx) => (
                        <div key={url} className="relative group">
                          <ZoomableImage
                            src={url}
                            images={it.images}
                            alt={`Ảnh minh chứng ${imgIdx + 1}`}
                            title={`Ảnh minh chứng ${imgIdx + 1}`}
                            className="size-16 rounded-md border object-cover shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setItem(idx, { images: it.images.filter((_, i) => i !== imgIdx) })
                            }
                            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
                            title="Xóa ảnh"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}

                      <Label className="cursor-pointer inline-flex items-center">
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          asChild
                          disabled={it.uploading}
                          className="flex h-16 w-16 flex-col items-center justify-center gap-1 border-dashed p-0 text-[10px]"
                        >
                          <span>
                            <ImagePlus className="size-4 text-muted-foreground" />
                            {it.uploading ? "Đang tải…" : "+ Thêm ảnh"}
                          </span>
                        </Button>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
                          multiple
                          className="sr-only"
                          disabled={it.uploading}
                          onChange={(e) => {
                            uploadRowImages(idx, e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems((arr) => [...arr, EMPTY])}
              className="w-full border-dashed"
            >
              <Plus className="mr-1.5 size-4" />
              Thêm dòng vật tư hỏng
            </Button>
          </div>

          <div className="shrink-0 pt-3 border-t mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu thay đổi"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
