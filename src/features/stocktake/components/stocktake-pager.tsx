"use client";

import { Button } from "@/components/ui/button";

interface StocktakePagerProps {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}

/**
 * Phân trang client cho bảng vật tư trong một phiếu kiểm kê.
 * Không render gì khi chỉ có 1 trang. Dòng 0-based: trang 1 = dòng 1.
 */
export function StocktakePager({ page, totalPages, onPage }: StocktakePagerProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Trước
      </Button>
      <span className="text-sm text-muted-foreground">
        Trang {page} / {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Sau →
      </Button>
    </div>
  );
}
