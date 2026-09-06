"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { CategoryIcon, isImageIcon } from "@/components/category-icon";
import { cn } from "@/lib/utils";
import { uploadCategoryIcon } from "../upload";

export interface IconOption {
  value: string;
  label: string;
}

/**
 * Ô chọn icon danh mục (client):
 * - Hàng ô preset (icon lucide theo key) để bấm chọn nhanh.
 * - Nút "Tải ảnh lên" upload file ảnh lên bucket category-icons, lưu URL.
 * - Hiển thị preview icon hiện tại (ảnh hoặc lucide).
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
  const fileRef = useRef<HTMLInputElement>(null);
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
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
        <label
          title="Tải ảnh icon lên"
          className={cn(
            "flex size-9 cursor-pointer items-center justify-center rounded-md border border-dashed text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            isImageIcon(value) && "border-primary bg-primary/10 text-primary",
          )}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={onFile}
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-md border bg-muted/40">
          <CategoryIcon value={value} className="size-6" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {value
            ? isImageIcon(value)
              ? "Icon đã tải lên"
              : options.find((o) => o.value === value)?.label ?? "Icon tùy chỉnh"
            : "Chọn icon hoặc tải ảnh lên"}
        </span>
      </div>
    </div>
  );
}
