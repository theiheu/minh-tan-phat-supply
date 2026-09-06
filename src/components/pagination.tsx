import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  /** Đường dẫn gốc của trang (VD "/requisitions"). */
  basePath: string;
  page: number;
  totalPages: number;
  /** Các filter hiện tại cần giữ khi chuyển trang (giá trị trống bị bỏ qua). */
  params?: Record<string, string | null | undefined>;
  /** Tên query param lưu số trang (mặc định "page") — cho trang có nhiều bảng phân trang. */
  param?: string;
  /** Class thêm vào khung phân trang (VD căn lề trên dưới). */
  className?: string;
}

/**
 * Phân trang dùng chung cho các trang danh sách.
 * Không render gì khi chỉ có 1 trang.
 */
export function Pagination({ basePath, page, totalPages, params = {}, param = "page", className }: PaginationProps) {
  if (totalPages <= 1) return null;

  function href(p: number): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    if (p > 1) sp.set(param, String(p));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  }

  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <Button asChild variant="outline" size="sm" disabled={page <= 1}>
        <Link href={href(page - 1)}>← Trước</Link>
      </Button>
      <span className="text-sm text-muted-foreground">
        Trang {page} / {totalPages}
      </span>
      <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
        <Link href={href(page + 1)}>Sau →</Link>
      </Button>
    </div>
  );
}
