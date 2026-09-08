"use client";

import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ZoomableImage } from "@/components/image-lightbox";
import { uploadProductImage } from "../upload";
import { toast } from "sonner";

export function MultiImagePicker({
  label = "Ảnh",
  images = [],
  onChange,
  disabled = false,
  helperText,
  onUpload = uploadProductImage,
}: {
  label?: string;
  images?: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
  helperText?: string;
  onUpload?: (file: File) => Promise<string>;
}) {
  const [uploading, setUploading] = useState(false);

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls = await Promise.all(files.map((f) => onUpload(f)));
      onChange([...images, ...uploadedUrls]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải ảnh thất bại");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function onRemove(urlToRemove: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(images.filter((u) => u !== urlToRemove));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold">{label}</Label>
        {images.length > 0 && (
          <span className="text-[11px] font-medium text-muted-foreground">({images.length} ảnh)</span>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-2.5">
        {images.map((url, idx) => (
          <div key={`${url}-${idx}`} className="relative group">
            <ZoomableImage
              src={url}
              images={images}
              alt={`Ảnh ${idx + 1}`}
              title={`Ảnh #${idx + 1}`}
              className="size-20 rounded-lg border-2 object-cover shadow-xs sm:size-24"
            />
            {!disabled && !uploading && (
              <button
                type="button"
                onClick={(e) => onRemove(url, e)}
                className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-colors"
                aria-label="Xóa ảnh này"
                title="Xóa ảnh này"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}

        {!disabled && (
          <label className="flex size-20 sm:size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/40 p-2 text-center transition-colors hover:bg-accent">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
              multiple
              className="hidden"
              onChange={onFilesSelected}
              disabled={disabled || uploading}
            />
            {uploading ? (
              <>
                <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                <span className="text-[10px] font-medium text-muted-foreground">Đang tải…</span>
              </>
            ) : (
              <>
                <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
                <span className="text-[11px] font-medium leading-tight">
                  {images.length === 0 ? "Tải ảnh" : "+ Thêm"}
                </span>
              </>
            )}
          </label>
        )}
      </div>
      {helperText && <p className="text-[11px] text-muted-foreground">{helperText}</p>}
    </div>
  );
}
