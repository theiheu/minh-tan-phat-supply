"use client";

import { useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryIcon, isImageIcon } from "@/components/category-icon";
import { cn } from "@/lib/utils";
import { uploadCategoryIcon } from "../upload";

export interface IconOption {
  value: string;
  label: string;
}

/**
 * Ô chọn icon danh mục (client):
 * - Nút chính "Tải icon từ máy" — chọn file ảnh từ máy, upload lên bucket
 *   category-icons, xem trước; khi đã có ảnh cho phép xoá để quay về mặc định.
 * - Hàng phụ "Chọn icon mẫu" — các icon lucide có sẵn để chọn nhanh.
 */
export function CategoryIconPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: IconOption[];
}) {
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCategoryIcon(file);
      onChange(url);
    } catch (err) {
      console.error(err);
      // Không có toast util ở đây — báo lỗi nhẹ qua alert cho gọn form admin.
      window.alert(err instanceof Error ? err.message : "Tải ảnh icon thất bại");
    } finally {
      setUploading(false);
    }
  }

  const isImage = isImageIcon(value);

  return (
    <div className="space-y-3">
      {/* Khối chính: preview + tải ảnh từ máy */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
          <CategoryIcon value={value} className="size-9" />
        </span>

        <label
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm font-medium transition-colors",
            "border-input text-foreground hover:border-primary hover:bg-accent",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploading ? "Đang tải…" : isImage ? "Đổi icon (tải ảnh khác)" : "Tải icon từ máy"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/heic,image/heif,.heic,.heif"
            className="hidden"
            onChange={onFile}
          />
        </label>

        {isImage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("other")}
            title="Bỏ ảnh đã tải, dùng icon mặc định"
          >
            <Trash2 className="size-4" />
            Bỏ ảnh
          </Button>
        )}
      </div>

      {/* Lựa chọn phụ: icon mẫu có sẵn */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-muted-foreground">Hoặc chọn icon mẫu:</span>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              title={o.label}
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex size-9 items-center justify-center rounded-md border text-muted-foreground transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent hover:bg-accent hover:text-foreground",
              )}
            >
              <CategoryIcon value={o.value} className="size-5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
