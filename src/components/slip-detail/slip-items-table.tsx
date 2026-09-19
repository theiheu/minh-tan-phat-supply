"use client";

import { ZoomableImage } from "@/components/image-lightbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatVnd } from "@/lib/format";
import type { SlipDetailPayload } from "@/features/dashboard/actions/get-slip-detail";

interface SlipItemsTableProps {
  detail: SlipDetailPayload;
}

export function SlipItemsTable({ detail }: SlipItemsTableProps) {
  if (!detail.items || detail.items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
        <span className="text-xs font-semibold text-foreground">
          Danh sách vật tư ({detail.items.length} món):
        </span>
      </div>
      <div className="rounded-xl border-2 border-border/80 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-12 text-center text-xs">STT</TableHead>
              <TableHead className="w-16 text-center text-xs">Ảnh</TableHead>
              <TableHead className="min-w-[180px] text-xs">Tên vật tư</TableHead>
              <TableHead className="w-20 text-center text-xs">ĐVT</TableHead>
              <TableHead className="w-16 text-center text-xs">SL</TableHead>
              {detail.items.some((i) => i.unitPrice != null) && (
                <TableHead className="w-28 text-right text-xs">Đơn giá</TableHead>
              )}
              {detail.items.some((i) => i.batchNo || i.expiryDate) && (
                <TableHead className="w-32 text-xs">Lô / HSD</TableHead>
              )}
              {detail.type === "defect" &&
                detail.items.some((i) => i.damageDetail || (i.images && i.images.length > 0)) && (
                  <TableHead className="text-xs">Mô tả hỏng & Ảnh</TableHead>
                )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.items.map((it, idx) => (
              <TableRow key={it.id || idx} className="hover:bg-muted/30">
                <TableCell className="text-center font-mono text-xs text-muted-foreground">
                  {idx + 1}
                </TableCell>
                <TableCell className="w-16 text-center">
                  {it.images && it.images.length > 0 ? (
                    <div className="relative inline-flex shrink-0">
                      <ZoomableImage
                        src={it.images[0]}
                        images={it.images}
                        alt={it.productName ?? "Ảnh vật tư"}
                        title={it.productName ?? "Ảnh vật tư"}
                        className="size-10 shrink-0 rounded-md border object-cover"
                      />
                      {it.images.length > 1 && (
                        <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-black/80 text-[8px] font-bold text-white shadow pointer-events-none">
                          +{it.images.length - 1}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="mx-auto size-10 rounded-md border bg-muted/40 flex items-center justify-center text-muted-foreground/40 text-[10px]">
                      —
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium text-xs text-foreground min-w-[180px]">
                  <div className="font-medium text-foreground">{it.productName}</div>
                  {it.stock !== undefined && it.stock !== null && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                      <span>Tồn kho:</span>
                      <Badge
                        variant={it.stock === 0 ? "danger" : it.stock < it.quantity ? "warning" : "success"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {it.stock}
                      </Badge>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground w-20">
                  {it.unit ?? "—"}
                </TableCell>
                <TableCell className="text-center font-mono text-xs font-semibold w-16">
                  {it.quantity}
                </TableCell>
                {detail.items.some((i) => i.unitPrice != null) && (
                  <TableCell className="text-right font-mono text-xs">
                    {it.unitPrice != null ? formatVnd(it.unitPrice) : "—"}
                  </TableCell>
                )}
                {detail.items.some((i) => i.batchNo || i.expiryDate) && (
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {it.batchNo && <div>Lô: {it.batchNo}</div>}
                    {it.expiryDate && <div>HSD: {formatDate(it.expiryDate)}</div>}
                  </TableCell>
                )}
                {detail.type === "defect" &&
                  detail.items.some((i) => i.damageDetail || (i.images && i.images.length > 0)) && (
                    <TableCell className="text-xs">
                      {it.damageDetail && <div>{it.damageDetail}</div>}
                      {it.images && it.images.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {it.images.map((img) => (
                            <ZoomableImage
                              key={img}
                              src={img}
                              images={it.images}
                              alt="Ảnh hỏng"
                              className="size-10 rounded border object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </TableCell>
                  )}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-muted/30 font-semibold text-xs">
            <TableRow>
              <TableCell colSpan={4} className="text-right">Tổng cộng:</TableCell>
              <TableCell className="text-center font-mono">
                {detail.items.reduce((s, i) => s + (i.quantity ?? 0), 0)}
              </TableCell>
              {detail.items.some((i) => i.unitPrice != null) && (
                <TableCell className="text-right font-mono">
                  {formatVnd(detail.items.reduce((s, i) => s + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0))}
                </TableCell>
              )}
              {detail.items.some((i) => i.batchNo || i.expiryDate) && <TableCell />}
              {detail.type === "defect" &&
                detail.items.some((i) => i.damageDetail || (i.images && i.images.length > 0)) && (
                  <TableCell />
                )}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
