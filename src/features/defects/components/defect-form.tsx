"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Trash2, X } from "lucide-react";
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
  images: string[];
  uploading: boolean;
}

const EMPTY: ItemDraft = {
  variantId: "",
  quantity: "1",
  damageDetail: "",
  images: [],
  uploading: false,
};

const INTENTS: { key: Intent; label: string }[] = [
  { key: "record", label: "Chỉ ghi nhận" },
  { key: "exchange", label: "Đổi mới ngay" },
  { key: "repair", label: "Gửi đi sửa" },
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
      return toast.error("Mỗi dòng cần đủ: vật tư, số lượng, chi tiết hỏng và ≥1 ảnh");

    startTransition(async () => {
      try {
        const noteId = await recordDefect({
          sourceLocationId,
          items: valid.map((i) => ({
            variantId: i.variantId,
            quantity: Number(i.quantity),
            damageDetail: i.damageDetail.trim(),
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
        toast.success("Đã ghi nhận vật tư hỏng");
        router.push("/defects");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ghi nhận thất bại");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Card>
        <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
          <CardTitle className="text-sm sm:text-base">Báo hỏng — chọn cách xử lý</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-4">
          {/* Mobile: 3 nút xếp dọc full-width (tránh cuộn ngang); ≥sm: 3 ô cạnh nhau. */}
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {INTENTS.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={() => setIntent(it.key)}
                aria-pressed={intent === it.key}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors",
                  intent === it.key
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    intent === it.key ? "bg-primary" : "bg-muted-foreground/40",
                  )}
                />
                {it.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Đồ hỏng chuyển về <span className="font-medium">Kho hỏng</span> · nguồn lấy từ Kho chính.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4">
          <CardTitle className="text-sm sm:text-base">Vật tư hỏng</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((a) => [...a, EMPTY])}>
            + Thêm dòng
          </Button>
        </CardHeader>
        <CardContent className="space-y-2.5 px-3 pb-3 sm:px-6 sm:pb-4">
          {items.map((it, i) => (
            <fieldset
              key={i}
              className={cn(
                "space-y-2.5 rounded-xl border p-3 sm:p-4",
                it.variantId && it.damageDetail.trim() && it.images.length >= 1
                  ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/10"
                  : "border-input",
              )}
            >
              {/* Tiêu đề dòng: chỉ báo số thứ tự + có đủ thông tin chưa */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Vật tư {i + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}
                  disabled={items.length <= 1}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Xóa
                </Button>
              </div>

              {/* Chọn vật tư — gõ để tìm nhanh */}
              <div className="space-y-1">
                <Label className="text-xs">Vật tư bị hỏng</Label>
                <ComboboxInput
                  value={it.variantId}
                  onChange={(v) => setItem(i, { variantId: v })}
                  options={variantOptions}
                  placeholder="Gõ tên để tìm, chọn vật tư…"
                  emptyText="Không tìm thấy vật tư."
                />
              </div>

              {/* Số lượng + mô tả cùng 1 hàng trên mobile */}
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Số lượng</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={it.quantity}
                    onChange={(e) => setItem(i, { quantity: e.target.value })}
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <Label className="text-xs">Chi tiết hỏng</Label>
                  <Input
                    value={it.damageDetail}
                    onChange={(e) => setItem(i, { damageDetail: e.target.value })}
                    placeholder="VD: nứt, gãy, thủng bao…"
                  />
                </div>
              </div>

              {/* Ảnh chứng cứ — vùng thêm ảnh to, bắt buộc ≥1 */}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Ảnh chứng cứ{" "}
                  <span className={cn(it.images.length === 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    (bắt buộc ≥1 ảnh)
                  </span>
                </Label>
                {it.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {it.images.map((url) => (
                      <div key={url} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={appAssetUrl(url)}
                          alt="Ảnh vật tư hỏng"
                          className="size-20 rounded-lg border object-cover sm:size-24"
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
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-white"
                          aria-label="Xóa ảnh"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label
                  className={cn(
                    "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-3 text-center transition-colors hover:bg-accent",
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
                  <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
                  <span className="text-sm font-medium">Chụp / chọn ảnh từ máy</span>
                  <span className="text-xs text-muted-foreground">
                    {it.uploading ? "Đang tải lên…" : "Mỗi dòng tối thiểu 1 ảnh — bấm để thêm nhiều"}
                  </span>
                </label>
              </div>
            </fieldset>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending
            ? "Đang xử lý…"
            : intent === "exchange"
              ? "Ghi nhận & tạo phiếu đổi mới"
              : intent === "repair"
                ? "Ghi nhận & đề nghị sửa"
                : "Ghi nhận hỏng"}
        </Button>
      </div>
    </form>
  );
}
