"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatNumber, formatVnd } from "@/lib/format";
import type { ZoneCostRow } from "../types";

export interface ZoneCostDetailDialogProps {
  zone: ZoneCostRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ZoneCostDetailDialog({
  zone,
  open,
  onOpenChange,
}: ZoneCostDetailDialogProps) {
  if (!zone) return null;

  const totalItemQty = (zone.items || []).reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Chi tiết vật tư đã cấp cho: {zone.zoneName}
          </DialogTitle>
          <DialogDescription>
            Danh sách chi tiết các mặt hàng vật tư đã xuất cấp cho khu vực này trong kỳ
          </DialogDescription>
        </DialogHeader>

        {/* 1. Summary Mini Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">Tổng chi phí cấp</div>
            <div className="mt-1 text-base font-bold text-amber-600 dark:text-amber-400 font-mono">
              {formatVnd(zone.totalCost)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Chiếm {zone.percentage}% tổng chi phí toàn trại
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">Số phiếu xuất cấp</div>
            <div className="mt-1 text-base font-bold text-foreground font-mono">
              {formatNumber(zone.issueCount)}{" "}
              <span className="text-xs font-normal text-muted-foreground">phiếu</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              lượt xuất cấp vật tư
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">Số lần đổi 1-1 (báo hỏng)</div>
            <div className="mt-1 text-base font-bold text-foreground font-mono">
              {formatNumber(zone.defectCount)}{" "}
              <span className="text-xs font-normal text-muted-foreground">lần</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              phiếu sự cố thiết bị
            </div>
          </div>
        </div>

        {/* 2. Items Breakdown Table */}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Tên vật tư & Biến thể</TableHead>
                <TableHead className="w-[80px]">ĐVT</TableHead>
                <TableHead className="w-[100px] text-right">Số lượng</TableHead>
                <TableHead className="w-[120px] text-right">Đơn giá</TableHead>
                <TableHead className="w-[130px] text-right">Thành tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!zone.items || zone.items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-xs text-muted-foreground"
                  >
                    Chưa có danh sách vật tư chi tiết.
                  </TableCell>
                </TableRow>
              ) : (
                zone.items.map((item, idx) => (
                  <TableRow key={`${item.productName}-${item.variantLabel}-${idx}`}>
                    <TableCell className="py-2.5">
                      <div className="font-medium text-foreground">
                        {item.productName}
                      </div>
                      {item.variantLabel && (
                        <div className="text-xs text-muted-foreground">
                          {item.variantLabel}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.unit}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium">
                      {formatNumber(item.quantity)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatVnd(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                      {formatVnd(item.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {zone.items && zone.items.length > 0 && (
              <TableFooter>
                <TableRow className="border-t bg-muted/50 font-bold hover:bg-muted/50">
                  <TableCell colSpan={2} className="text-left font-semibold">
                    Tổng cộng ({formatNumber(zone.items.length)} mặt hàng):
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatNumber(totalItemQty)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    —
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                    {formatVnd(zone.totalCost)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>

        {/* 3. Dialog Footer */}
        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            Tổng giá trị:{" "}
            <span className="font-semibold text-foreground font-mono">
              {formatVnd(zone.totalCost)}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
