"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { ImagePlus, X } from "lucide-react";
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
  variants: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [intent, setIntent] = useState<Intent>("record");
  const [items, setItems] = useState<ItemDraft[]>([EMPTY]);
  const [pending, startTransition] = useTransition();

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
          {/* Mobile: cuộn ngang 1 hàng gọn; ≥sm: đủ chỗ 3 ô cạnh nhau. */}
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
            {INTENTS.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={() => setIntent(it.key)}
                aria-pressed={intent === it.key}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors sm:w-full sm:justify-center",
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
        <CardContent className="space-y-2 px-3 pb-3 sm:px-6 sm:pb-4">
          {items.map((it, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-2.5 sm:p-3">
              {/* Dòng 1: nhãn + chọn vật tư + xoá */}
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground sm:w-20">
                  Vật tư {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Select value={it.variantId} onValueChange={(v) => setItem(i, { variantId: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn vật tư" />
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}
                  aria-label={`Xóa vật tư ${i + 1}`}
                  disabled={items.length <= 1}
                >
                  <X aria-hidden />
                </Button>
              </div>

              {/* Dòng 2: số lượng (ngắn) + chi tiết hỏng (dài) — cùng hàng trên mobile */}
              <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2">
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
                    placeholder="VD: nứt, gãy…"
                  />
                </div>
              </div>

              {/* Ảnh: gọn, cuộn ngang khi nhiều */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5">
                {it.images.map((url) => (
                  <div key={url} className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={appAssetUrl(url)} alt="" className="size-12 rounded-md border object-cover sm:size-14" />
                    <button
                      type="button"
                      onClick={() =>
                        setItems((a) =>
                          a.map((r, idx) => (idx === i ? { ...r, images: r.images.filter((u) => u !== url) } : r)),
                        )
                      }
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-white"
                      aria-label="Xóa ảnh"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                <label
                  className={cn(
                    "flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-accent sm:size-14",
                    it.images.length === 0 ? "border-red-400" : "",
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
                  <ImagePlus className="size-5" />
                </label>
                {it.uploading ? <span className="shrink-0 text-xs text-muted-foreground">Đang tải…</span> : null}
              </div>
            </div>
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
