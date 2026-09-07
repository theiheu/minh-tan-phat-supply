"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { REQUISITION_STATUS, ISSUE_STATUS, statusBadgeVariant, variantLabel } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getProductHistory } from "../actions";
import type { ProductHistoryRow, VariantWithStock } from "../types";

/** Cột có thể sort; giá trị so sánh lấy từ helper sortValue bên dưới. */
type SortKey =
  | "code"
  | "occurredAt"
  | "requesterName"
  | "fulfillerName"
  | "destinationName"
  | "spec"
  | "unit"
  | "quantity"
  | "status";

/** Nhãn trạng thái theo loại phiếu (yêu cầu/cấp phát hay xuất kho). */
function statusLabel(row: ProductHistoryRow): string {
  return row.kind === "issue"
    ? (ISSUE_STATUS[row.status] ?? row.status)
    : (REQUISITION_STATUS[row.status] ?? row.status);
}

/** Nhãn loại phiếu — dòng phụ dưới mã phiếu trong cột Phiếu. */
function kindLabel(kind: ProductHistoryRow["kind"]): string {
  return kind === "issue" ? "Phiếu xuất kho" : "Phiếu yêu cầu";
}

/** Trả giá trị so sánh của 1 dòng theo cột; null/không có → luôn xếp cuối. */
function sortValue(row: ProductHistoryRow, spec: { label: string; unit: string | null } | undefined, key: SortKey): string | number | null {
  switch (key) {
    case "code":
      return row.code;
    case "occurredAt":
      return row.occurredAt;
    case "requesterName":
      return row.requesterName;
    case "fulfillerName":
      return row.fulfillerName;
    case "destinationName":
      return row.destinationName;
    case "spec":
      return spec?.label ?? null;
    case "unit":
      return spec?.unit ?? null;
    case "quantity":
      return row.quantity;
    case "status":
      return statusLabel(row);
  }
}

function compareRows(
  a: ProductHistoryRow,
  b: ProductHistoryRow,
  specA: { label: string; unit: string | null } | undefined,
  specB: { label: string; unit: string | null } | undefined,
  key: SortKey,
  dir: "asc" | "desc",
): number {
  const va = sortValue(a, specA, key);
  const vb = sortValue(b, specB, key);
  // Giá trị trống (chưa cấp / chưa có người) luôn về cuối, không phụ thuộc chiều sort.
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  let r: number;
  if (typeof va === "number" && typeof vb === "number") {
    r = va - vb;
  } else {
    r = String(va).localeCompare(String(vb), "vi", { numeric: true, sensitivity: "base" });
  }
  return dir === "asc" ? r : -r;
}

/**
 * Modal lịch sử cấp phát và xuất kho của 1 vật tư (mở từ nút góc trên phải thẻ vật tư).
 * Gồm các dòng phiếu yêu cầu/cấp phát (requisition) lẫn phiếu xuất kho (issue).
 * Dữ liệu load khi mở; mỗi lần mở là một lần hỏi lại để luôn mới.
 */
/** Tiêu đề cột sort được — bấm để đổi cột/chiều, có mũi tên chỉ hướng đang sort. */
function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" } | null;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort?.key === sortKey;
  return (
    <TableHead
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className="p-0"
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "flex h-10 w-full items-center gap-1 px-2 font-bold whitespace-nowrap text-foreground transition-colors hover:text-primary",
          align === "right" && "justify-end text-right",
          active && "text-primary",
        )}
        title={`Sắp xếp theo ${label.toLowerCase()}`}
      >
        {label}
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5 shrink-0" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="size-3 shrink-0 opacity-40" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}

export function ProductHistoryDialog({
  open,
  onOpenChange,
  productName,
  productId,
  variants,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  productId: string;
  variants: VariantWithStock[];
}) {
  const [rows, setRows] = useState<ProductHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRows(null);
    setError(null);
    getProductHistory(productId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không tải được lịch sử");
      });
    return () => {
      cancelled = true;
    };
  }, [open, productId, attempt]);

  // Thông tin từng quy cách của vật tư → gắn nhãn + đơn vị cho dòng lịch sử.
  const variantInfo = useMemo(() => {
    const map = new Map<string, { label: string; unit: string | null }>();
    for (const v of variants) {
      map.set(v.id, { label: variantLabel(v.attributes, v.unit), unit: v.unit });
    }
    return map;
  }, [variants]);
  const showSpec = variants.length > 1;

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  // Sort client-side trên các dòng đã load; chưa chọn cột → giữ thứ tự server
  // (thời điểm cấp/xuất mới nhất trước, dòng chưa cấp xếp cuối).
  const displayRows = useMemo(() => {
    if (!rows || rows.length === 0 || !sort) return rows;
    const list = [...rows];
    list.sort((a, b) =>
      compareRows(a, b, variantInfo.get(a.variantId), variantInfo.get(b.variantId), sort.key, sort.dir),
    );
    return list;
  }, [rows, sort, variantInfo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="pr-8">{productName}</DialogTitle>
          <DialogDescription>Lịch sử cấp phát và xuất kho vật tư</DialogDescription>
        </DialogHeader>

        {rows === null && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
            <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Đang tải lịch sử…
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-red-600">
            {error}
            <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              Thử lại
            </Button>
          </div>
        )}

        {rows !== null &&
          (rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Vật tư này chưa từng được yêu cầu, cấp phát hay xuất kho.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader label="Phiếu" sortKey="code" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Ngày cấp/xuất" sortKey="occurredAt" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Người yêu cầu" sortKey="requesterName" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Người cấp" sortKey="fulfillerName" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Khu" sortKey="destinationName" sort={sort} onSort={toggleSort} />
                    {showSpec ? <SortHeader label="Quy cách" sortKey="spec" sort={sort} onSort={toggleSort} /> : null}
                    <SortHeader label="Đơn vị tính" sortKey="unit" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Số lượng" sortKey="quantity" sort={sort} onSort={toggleSort} align="right" />
                    <SortHeader label="Trạng thái" sortKey="status" sort={sort} onSort={toggleSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(displayRows ?? []).map((r) => {
                    const spec = variantInfo.get(r.variantId);
                    return (
                      <TableRow key={r.itemId}>
                        <TableCell className="whitespace-nowrap">
                          <div className="font-mono text-sm font-medium">{r.code}</div>
                          <div className="text-[11px] text-muted-foreground">{kindLabel(r.kind)}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(r.occurredAt)}
                        </TableCell>
                        <TableCell>{r.requesterName ?? "—"}</TableCell>
                        <TableCell>{r.fulfillerName ?? "—"}</TableCell>
                        <TableCell>{r.destinationName ?? "—"}</TableCell>
                        {showSpec ? (
                          <TableCell className="text-muted-foreground">{spec?.label ?? "—"}</TableCell>
                        ) : null}
                        <TableCell className="text-muted-foreground">{spec?.unit ?? "—"}</TableCell>
                        <TableCell className="text-right whitespace-nowrap font-medium tabular-nums">
                          {r.quantity}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r)}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ))}
      </DialogContent>
    </Dialog>
  );
}
