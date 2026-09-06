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
import { appAssetUrl } from "@/lib/images";
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
  isManager = false,
  variants,
}: {
  /** Kho nguồn mặc định — server đã resolve = Kho chính. */
  sourceLocationId: string;
  isManager?: boolean;
  variants: { id: string; name: string; detail: string }[];
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
          const { id, code } = await createExchange(noteId);
          toast.success(`Đã ghi nhận hỏng + tạo phiếu Đổi Mới ${code}`);
          if (isManager) {
            router.push(`/defects/exchange/${id}`);
          } else {
            router.push("/defects");
          }
          router.refresh();
          return;
        }
        if (intent === "repair") {
          await requestRepair(noteId);
          toast.success("Đã ghi nhận hỏng + đề nghị gửi đi sửa — chờ manager xác nhận");
          router.push("/defects");
          router.refresh();
          return;
        }
        toast.success("Đã ghi nhận hỏng");
        router.push("/defects");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ghi nhận thất bại");
      }
    });
  }

  const fieldClass = "h-12 text-base sm:h-11 sm:text-sm";

  return (
    <form onSubmit={submit} className="space-y-6 sm:space-y-8">
      {/* Bước 1 — cách xử lý */}
      <Card>
        <CardHeader className="px-6 pt-6 sm:px-8 sm:pt-8">
          <CardTitle className="text-lg font-bold">Chọn cách xử lý</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3.5 px-6 pb-6 sm:space-y-4 sm:px-8 sm:pb-8">
          {INTENTS.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => setIntent(it.key)}
              aria-pressed={intent === it.key}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-4 text-left transition-colors sm:px-5 sm:py-4",
                intent === it.key
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "hover:bg-accent",
              )}
            >
              <span className="min-w-0">
                <span className="block text-base font-semibold">{it.label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{it.hint}</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                  intent === it.key ? "border-primary bg-primary text-white" : "border-muted-foreground/50",
                )}
              >
                {intent === it.key ? <X className="size-3.5 rotate-45" /> : null}
              </span>
            </button>
          ))}
          <p className="pt-2 text-sm text-muted-foreground">
            Đây là <span className="font-medium text-foreground">khai báo</span> gửi quản lý kho —
            đồ hỏng sẽ được thu về kho khi quản lý thực hiện đổi mới hoặc xác nhận sửa.
          </p>
        </CardContent>
      </Card>

      {/* Bước 2 — chi tiết các dòng hỏng */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 px-6 pt-6 sm:px-8 sm:pt-8">
          <div>
            <CardTitle className="text-lg font-bold">Chi tiết các dòng hỏng</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Mỗi dòng: chọn tên, ghi số lượng + mô tả, thêm ít nhất 1 ảnh.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setItems((a) => [...a, EMPTY])}
            className="h-12 shrink-0 gap-1.5 px-4 text-base sm:h-10 sm:text-sm"
          >
            <Plus className="size-4" aria-hidden />
            Thêm
          </Button>
        </CardHeader>
        <CardContent className="space-y-5 px-6 pb-6 sm:space-y-6 sm:px-8 sm:pb-8">
          {items.map((it, i) => {
            const done = !!it.variantId && it.damageDetail.trim().length > 0 && it.images.length >= 1;
            return (
              <div
                key={i}
                className={cn(
                  "space-y-5 rounded-2xl border-2 p-5 sm:space-y-6 sm:p-7",
                  done ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-950/10" : "border-border",
                )}
              >
                {/* Số thứ tự dòng */}
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-muted px-2 text-base font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}
                    disabled={items.length <= 1}
                    className="h-10 gap-1.5 px-3 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:h-8"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Xóa dòng
                  </Button>
                </div>

                {/* Chọn tên */}
                <div className="space-y-2">
                  <Label className="text-base font-medium sm:text-sm">Tên</Label>
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
                <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4">
                  <div className="space-y-2">
                    <Label className="text-base font-medium sm:text-sm">Số lượng</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={it.quantity}
                      onChange={(e) => setItem(i, { quantity: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label className="text-base font-medium sm:text-sm">Mô tả</Label>
                    <Input
                      value={it.damageDetail}
                      onChange={(e) => setItem(i, { damageDetail: e.target.value })}
                      placeholder="Nứt, gãy, thủng…"
                      className={fieldClass}
                    />
                  </div>
                </div>

                {/* Ghi chú tuỳ chọn */}
                <div className="space-y-2">
                  <Label className="text-base font-medium sm:text-sm">Ghi chú</Label>
                  <Input
                    value={it.note}
                    onChange={(e) => setItem(i, { note: e.target.value })}
                    placeholder="Ghi chú thêm (tuỳ chọn)…"
                    className={fieldClass}
                  />
                </div>

                {/* Ảnh */}
                <div className="space-y-2.5">
                  <Label className="text-base font-medium sm:text-sm">
                    Ảnh{" "}
                    <span className={cn("text-sm", it.images.length === 0 ? "font-semibold text-red-600" : "text-muted-foreground")}>
                      (bắt buộc ≥1)
                    </span>
                  </Label>
                  {it.images.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {it.images.map((url) => (
                        <div key={url} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={appAssetUrl(url)}
                            alt="Ảnh hàng hỏng"
                            className="size-24 rounded-lg border object-cover sm:size-28"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setItems((a) =>
                                a.map((r, idx) =>
                                  idx === i ? { ...r, images: r.images.filter((u) => u !== url) } : r,
                                ),
                              )
                            }
                            className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-red-600 text-white"
                            aria-label="Bỏ ảnh này"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label
                    className={cn(
                      "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-5 py-6 text-center transition-colors hover:bg-accent",
                      it.images.length === 0 ? "border-red-300 dark:border-red-800" : "border-muted-foreground/40",
                    )}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={it.uploading}
                      onChange={(e) => uploadRowImages(i, e.target.files)}
                    />
                    <ImagePlus className="size-8 text-muted-foreground" aria-hidden />
                    <span className="text-base font-semibold">
                      {it.uploading ? "Đang tải lên…" : "Bấm để thêm ảnh"}
                    </span>
                    <span className="text-sm text-muted-foreground">Có thể chọn nhiều ảnh một lúc</span>
                  </label>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending} className="h-14 w-full text-base sm:h-12 sm:w-auto">
        {pending
          ? "Đang xử lý…"
          : intent === "exchange"
            ? "Ghi nhận và tạo phiếu đổi mới"
            : intent === "repair"
              ? "Ghi nhận và đề nghị sửa"
              : "Ghi nhận hỏng"}
      </Button>
    </form>
  );
}