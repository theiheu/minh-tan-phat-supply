"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { ComboboxInput, type ComboboxInputOption } from "@/components/combobox-input";
import { recordDefect, requestRepair } from "../actions";
import { createExchange } from "@/features/exchanges/actions";
import { uploadDefectImage } from "../upload";
import { ZoomableImage } from "@/components/image-lightbox";
import { cn } from "cn";

type Intent = "record" | "exchange" | "repair";

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

const INTENTS: { key: Intent; label: string; hint: string }[] = [
  { key: "record", label: "Chỉ ghi nhận", hint: "Khai báo, chờ quản lý xử lý sau" },
  { key: "exchange", label: "Đổi mới ngay", hint: "Quản lý cấp mới + thu đồ hỏng" },
  { key: "repair", label: "Gửi đi sửa", hint: "Quản lý xác nhận gửi đơn vị sửa" },
];

export function DefectForm({
  sourceLocationId,
  variants,
  onSuccess,
  onCancel,
}: {
  /** Kho nguồn mặc định — server đã resolve = Kho chính. */
  sourceLocationId: string;
  variants: { id: string; name: string; detail: string }[];
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [intent, setIntent] = useState<Intent>("record");
  const [items, setItems] = useState<ItemDraft[]>([EMPTY]);
  const [pending, startTransition] = useTransition();

  // Mỗi biến thể: tên chính = tên vật tư, dòng phụ = quy cách · đơn vị.
  const variantOptions: ComboboxInputOption[] = variants.map((v) => ({
    value: v.id,
    label: v.name,
    detail: v.detail,
    text: v.detail ? `${v.name} — ${v.detail}` : v.name,
  }));

  function setItem(i: number, patch: Partial<ItemDraft>) {
    setItems((arr) => arr.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function uploadRowImages(i: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    setItem(i, { uploading: true });
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadDefectImage(file));
      }
      const row = items[i];
      setItems((arr) =>
        arr.map((r, idx) =>
          idx === i ? { ...r, images: [...(row?.images ?? []), ...urls], uploading: false } : r,
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
    if (valid.length === 0)
      return toast.error("Nhập ít nhất 1 dòng đầy đủ: tên, số lượng, mô tả và 1 ảnh");

    startTransition(async () => {
      try {
        const noteId = await recordDefect({
          sourceLocationId,
          items: valid.map((i) => ({
            variantId: i.variantId,
            quantity: Number(i.quantity),
            damageDetail: i.damageDetail.trim(),
            note: i.note.trim(),
            images: i.images,
          })),
        });

        if (intent === "exchange") {
          const { code } = await createExchange(noteId);
          toast.success(`Đã ghi nhận hỏng + tạo phiếu Đổi Mới ${code}`);
          if (onSuccess) {
            onSuccess(noteId);
          } else {
            router.push("/defects");
          }
          router.refresh();
          return;
        }
        if (intent === "repair") {
          await requestRepair(noteId);
          toast.success("Đã ghi nhận hỏng + đề nghị gửi đi sửa — chờ manager xác nhận");
          if (onSuccess) {
            onSuccess(noteId);
          } else {
            router.push("/defects");
          }
          router.refresh();
          return;
        }
        toast.success("Đã ghi nhận hỏng");
        if (onSuccess) {
          onSuccess(noteId);
        } else {
          router.push("/defects");
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ghi nhận thất bại");
      }
    });
  }

  const fieldClass = "h-9 text-sm";

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Bước 1 — cách xử lý */}
      <Card className="border-2 border-border shadow-xs rounded-xl">
        <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3 border-b border-border/60">
          <CardTitle className="text-base font-semibold">Chọn cách xử lý</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 px-4 pb-4 sm:px-5 sm:pb-5">
          {INTENTS.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => setIntent(it.key)}
              aria-pressed={intent === it.key}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg border-2 px-3.5 py-3 text-left transition-colors",
                intent === it.key
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "hover:bg-accent border-border/80",
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{it.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{it.hint}</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  intent === it.key ? "border-primary bg-primary text-white" : "border-muted-foreground/50",
                )}
              >
                {intent === it.key ? <X className="size-3 rotate-45" /> : null}
              </span>
            </button>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            Đây là <span className="font-medium text-foreground">khai báo</span> gửi quản lý kho —
            đồ hỏng sẽ được thu về kho khi quản lý thực hiện đổi mới hoặc xác nhận sửa.
          </p>
        </CardContent>
      </Card>

      {/* Bước 2 — chi tiết các dòng hỏng */}
      <Card className="border-2 border-border shadow-xs rounded-xl">
        <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3 border-b border-border/60">
          <CardTitle className="text-base font-semibold">Chi tiết các dòng hỏng</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mỗi dòng: chọn tên, ghi số lượng + mô tả, thêm ít nhất 1 ảnh.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
          {items.map((it, i) => {
            const done = !!it.variantId && it.damageDetail.trim().length > 0 && it.images.length >= 1;
            return (
              <div
                key={i}
                className={cn(
                  "space-y-3 rounded-xl border-2 p-3.5 sm:p-4",
                  done ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-950/10" : "border-border/80",
                )}
              >
                {/* Số thứ tự dòng */}
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-muted px-1.5 text-xs font-bold tabular-nums">
                    Dòng #{i + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}
                    disabled={items.length <= 1}
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Xóa dòng
                  </Button>
                </div>

                {/* Chọn tên */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Tên vật tư</Label>
                  <ComboboxInput
                    value={it.variantId}
                    onChange={(v) => setItem(i, { variantId: v })}
                    options={variantOptions}
                    placeholder="Gõ tên để tìm…"
                    emptyText="Không tìm thấy."
                    inputClassName={fieldClass}
                  />
                </div>

                {/* Số lượng + mô tả */}
                <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2.5 sm:grid-cols-[7rem_minmax(0,1fr)]">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Số lượng</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={it.quantity}
                      onChange={(e) => setItem(i, { quantity: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-xs font-semibold">Mô tả hư hỏng</Label>
                    <Input
                      value={it.damageDetail}
                      onChange={(e) => setItem(i, { damageDetail: e.target.value })}
                      placeholder="Nứt, gãy, thủng…"
                      className={fieldClass}
                    />
                  </div>
                </div>

                {/* Ghi chú tuỳ chọn */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Ghi chú (tuỳ chọn)</Label>
                  <Input
                    value={it.note}
                    onChange={(e) => setItem(i, { note: e.target.value })}
                    placeholder="Ghi chú thêm…"
                    className={fieldClass}
                  />
                </div>

                {/* Ảnh */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Ảnh hư hỏng{" "}
                    <span className={cn("text-xs", it.images.length === 0 ? "font-semibold text-red-600" : "text-muted-foreground")}>
                      (bắt buộc ≥1)
                    </span>
                  </Label>
                  {it.images.length > 0 && (
                    <div className="flex flex-wrap gap-2.5">
                      {it.images.map((url) => (
                        <div key={url} className="relative">
                          <ZoomableImage
                            src={url}
                            images={it.images}
                            alt="Ảnh hàng hỏng"
                            title="Ảnh hàng hỏng"
                            className="size-20 rounded-lg border-2 object-cover sm:size-24"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setItems((a) =>
                                a.map((r, idx) =>
                                  idx === i ? { ...r, images: r.images.filter((u) => u !== url) } : r,
                                ),
                              );
                            }}
                            className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700"
                            aria-label="Bỏ ảnh này"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label
                    className={cn(
                      "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-4 text-center transition-colors hover:bg-accent",
                      it.images.length === 0 ? "border-red-300 dark:border-red-800" : "border-muted-foreground/40",
                    )}
                  >
                    <input
                      type="file"
                      accept="image/*,image/heic,image/heif,.heic,.heif"
                      multiple
                      className="hidden"
                      disabled={it.uploading}
                      onChange={(e) => uploadRowImages(i, e.target.files)}
                    />
                    <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
                    <span className="text-xs font-semibold">
                      {it.uploading ? "Đang tải lên…" : "Bấm để thêm ảnh"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Có thể chọn nhiều ảnh một lúc</span>
                  </label>
                </div>
              </div>
            );
          })}

          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems((a) => [...a, EMPTY])}
              className="h-9 gap-1.5 px-3 text-xs font-medium"
            >
              <Plus className="size-3.5" aria-hidden />
              Thêm dòng hỏng
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={pending}
            className="h-9 text-xs sm:text-sm"
          >
            Hủy
          </Button>
        )}
        <Button type="submit" disabled={pending} className="h-9 w-full text-xs font-medium sm:w-auto sm:text-sm">
          {pending
            ? "Đang xử lý…"
            : intent === "exchange"
              ? "Ghi nhận và tạo phiếu đổi mới"
              : intent === "repair"
                ? "Ghi nhận và đề nghị sửa"
                : "Ghi nhận hỏng"}
        </Button>
      </div>
    </form>
  );
}
