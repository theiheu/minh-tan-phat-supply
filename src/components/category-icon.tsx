import { categoryIcon } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { appAssetUrl } from "@/lib/images";

const IMAGE_ICON_PATTERN = /^(https?:\/\/|data:image\/|\/)/i;

/** Giá trị icon là ảnh (URL public / data-URL) hay key lucide? */
export function isImageIcon(value?: string | null): boolean {
  if (!value) return false;
  return IMAGE_ICON_PATTERN.test(value);
}

/**
 * Hiển thị icon danh mục dùng chung (server + client):
 * - Giá trị là ảnh (URL / data-URL) → render <img>.
 * - Ngược lại → tra key trong map lucide (mặc định Package nếu lạ/rỗng).
 */
export function CategoryIcon({
  value,
  className = "size-6",
  imgClassName,
}: {
  value?: string | null;
  /** Class cho lucide icon (vd "size-6"). */
  className?: string;
  /** Class riêng cho <img> (mặc định = className + object-contain). */
  imgClassName?: string;
}) {
  if (isImageIcon(value)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={appAssetUrl(value)}
        alt=""
        draggable={false}
        className={cn("shrink-0 object-contain", imgClassName ?? className)}
      />
    );
  }
  const Icon = categoryIcon(value);
  return <Icon className={className} aria-hidden />;
}
