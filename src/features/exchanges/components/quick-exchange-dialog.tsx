"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, Minus, Plus, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ComboboxInput, type ComboboxInputOption } from "@/components/combobox-input";
import { ZoomableImage } from "@/components/image-lightbox";
import { uploadDefectImage } from "@/features/defects/upload";
import { quickEmergencyExchange } from "../actions";
import { cn } from "cn";

export interface QuickExchangeVariantOption {
  id: string;
  name: string;
  detail?: string;
}

export function QuickExchangeDialog({
  variants,
  defaultVariantId,
  trigger,
  triggerLabel = "Đổi khẩn cấp 1-1",
  triggerClassName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSuccess,
}: {
  variants: QuickExchangeVariantOption[];
  defaultVariantId?: string;
  trigger?: React.ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: (res: { defect_id: string; exchange_id: string; exchange_code: string }) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? controlledOnOpenChange ?? (() => {}) : setInternalOpen;

  const [variantId, setVariantId] = useState(defaultVariantId ?? "");
  const [quantity, setQuantity] = useState("1");
  const [damageDetail, setDamageDetail] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const variantOptions: ComboboxInputOption[] = variants.map((v) => ({
    value: v.id,
    label: v.name,
    detail: v.detail,
    text: v.detail ? `${v.name} — ${v.detail}` : v.name,
  }));

  const numQty = Math.max(1, parseInt(quantity, 10) || 1);

  function resetForm() {
    setVariantId(defaultVariantId ?? (variants.length === 1 ? variants[0].id : ""));
    setQuantity("1");
    setDamageDetail("");
    setImages([]);
    setUploading(false);
  }

  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadDefectImage(file);
        urls.push(url);
      }
      setImages((prev) => [...prev, ...urls]);
      toast.success(`Đã tải lên ${urls.length} ảnh`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải ảnh thất bại");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const targetVariantId = variantId || (variants.length === 1 ? variants[0].id : "");
    if (!targetVariantId) {
      return toast.error("Vui lòng chọn vật tư cần đổi");
    }
    if (numQty <= 0) {
      return toast.error("Số lượng phải lớn hơn 0");
    }
    if (!damageDetail.trim()) {
      return toast.error("Vui lòng nhập mô tả lý do hư hỏng");
    }
    if (images.length === 0) {
      return toast.error("Bắt buộc phải có ít nhất 1 ảnh hiện trường hư hỏng");
    }

    startTransition(async () => {
      try {
        const res = await quickEmergencyExchange({
          variantId: targetVariantId,
          quantity: numQty,
          damageDetail: damageDetail.trim(),
          images,
        });

        toast.success(`Đã tạo phiếu đổi khẩn cấp: ${res.exchange_code}`);
        setIsOpen(false);
        resetForm();

        if (onSuccess) {
          onSuccess(res);
        } else {
          router.push(`/defects/exchange/${res.exchange_id}`);
          router.refresh();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Đổi mới thất bại");
      }
    });
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (v && defaultVariantId) {
          setVariantId(defaultVariantId);
        }
        setIsOpen(v);
      }}
    >
      {trigger !== undefined ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button
            variant="destructive"
            className={cn(
              "bg-red-600 font-medium text-white shadow-xs hover:bg-red-700 active:bg-red-800 dark:bg-red-700 dark:hover:bg-red-600",
              triggerClassName,
            )}
          >
            <Zap className="mr-1.5 size-4 fill-white" aria-hidden />
            {triggerLabel}
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="w-[calc(100%-1.5rem)] sm:w-full sm:max-w-lg max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden border-2 border-red-200 dark:border-red-950/80 shadow-2xl rounded-2xl min-w-0">
        <DialogHeader className="shrink-0 pb-3 border-b border-border/70 pr-8 min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
              <Zap className="size-4 fill-current" />
            </span>
            <DialogTitle className="text-base font-bold text-red-600 dark:text-red-400">
              Đổi mới 1-1 khẩn cấp
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Dành cho sự cố khẩn cấp: Tự động lập biên bản hỏng, kích hoạt duyệt đổi mới tức thì và
            thông báo khẩn tới thủ kho.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-3 space-y-4 pr-1">
          {/* Chọn vật tư */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Tên vật tư <span className="text-red-500">*</span>
            </Label>
            {variants.length === 1 ? (
              <div className="rounded-lg border bg-muted/50 p-2.5 text-sm font-medium">
                <div>{variants[0].name}</div>
                {variants[0].detail ? (
                  <div className="text-xs text-muted-foreground">{variants[0].detail}</div>
                ) : null}
              </div>
            ) : (
              <ComboboxInput
                value={variantId}
                onChange={setVariantId}
                options={variantOptions}
                placeholder="Tìm hoặc chọn vật tư cần đổi…"
                emptyText="Không tìm thấy vật tư."
                inputClassName="h-10 text-sm"
              />
            )}
          </div>

          {/* Số lượng */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Số lượng cần đổi <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 shrink-0"
                onClick={() => setQuantity(String(Math.max(1, numQty - 1)))}
                aria-label="Giảm số lượng"
                disabled={pending}
              >
                <Minus className="size-4" />
              </Button>
              <Input
                type="number"
                min="1"
                className="h-9 w-24 text-center font-semibold tabular-nums"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onBlur={() => {
                  if (!quantity || parseInt(quantity, 10) < 1) setQuantity("1");
                }}
                disabled={pending}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 shrink-0"
                onClick={() => setQuantity(String(numQty + 1))}
                aria-label="Tăng số lượng"
                disabled={pending}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          {/* Lý do hư hỏng */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Mô tả lý do hỏng <span className="text-red-500">*</span>
            </Label>
            <Input
              value={damageDetail}
              onChange={(e) => setDamageDetail(e.target.value)}
              placeholder="VD: Cháy bóng đèn úm do chập điện, vỡ máng..."
              className="h-10 text-sm"
              disabled={pending}
            />
          </div>

          {/* Chụp ảnh chứng cứ */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>
                Ảnh hiện trường hư hỏng <span className="text-red-500">*</span>
              </span>
              <span
                className={cn(
                  "text-[11px]",
                  images.length === 0 ? "font-semibold text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {images.length === 0 ? "(Bắt buộc ít nhất 1 ảnh)" : `(Đã có ${images.length} ảnh)`}
              </span>
            </Label>

            {images.length > 0 && (
              <div className="flex flex-wrap gap-2.5 pt-1">
                {images.map((url) => (
                  <div key={url} className="relative group">
                    <ZoomableImage
                      src={url}
                      images={images}
                      alt="Ảnh hỏng khẩn cấp"
                      title="Ảnh hỏng khẩn cấp"
                      className="size-20 rounded-lg border-2 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                      className="absolute -right-2 -top-2 z-10 flex size-5 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700"
                      aria-label="Bỏ ảnh này"
                      disabled={pending}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Nút chụp camera trực tiếp trên mobile */}
              <label
                className={cn(
                  "flex h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-2 text-center transition-colors hover:bg-accent",
                  images.length === 0 ? "border-red-300 dark:border-red-900 bg-red-50/40 dark:bg-red-950/10" : "border-muted-foreground/30",
                )}
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={uploading || pending}
                  onChange={(e) => handleImageUpload(e.target.files)}
                />
                <Camera className="size-5 text-red-600 dark:text-red-400" aria-hidden />
                <span className="text-[11px] font-semibold text-foreground">
                  {uploading ? "Đang tải…" : "Chụp ảnh ngay"}
                </span>
              </label>

              {/* Nút chọn ảnh từ thư viện */}
              <label
                className={cn(
                  "flex h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-2 text-center transition-colors hover:bg-accent",
                  images.length === 0 ? "border-red-300 dark:border-red-900 bg-red-50/40 dark:bg-red-950/10" : "border-muted-foreground/30",
                )}
              >
                <input
                  type="file"
                  accept="image/*,image/heic,image/heif,.heic,.heif"
                  multiple
                  className="hidden"
                  disabled={uploading || pending}
                  onChange={(e) => handleImageUpload(e.target.files)}
                />
                <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
                <span className="text-[11px] font-semibold text-foreground">
                  {uploading ? "Đang tải…" : "Tải từ thư viện"}
                </span>
              </label>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={pending || uploading}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="bg-red-600 text-white hover:bg-red-700 active:bg-red-800 dark:bg-red-700"
              disabled={pending || uploading || images.length === 0}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Đang kích hoạt đổi mới…
                </>
              ) : (
                <>
                  <Zap className="mr-1.5 size-4 fill-white" />
                  Xác nhận Đổi khẩn cấp 1-1
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
