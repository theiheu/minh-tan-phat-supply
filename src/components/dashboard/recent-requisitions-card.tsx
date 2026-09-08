"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { REQUISITION_STATUS, statusBadgeVariant } from "@/lib/labels";
import { useUIStore } from "@/stores/ui-store";

export interface RecentRequisitionItem {
  id: string;
  code: string;
  purpose: string;
  status: string;
  created_at?: string;
  requester?: { name: string | null } | null;
  zone?: { name: string } | null;
}

interface RecentRequisitionsCardProps {
  items: RecentRequisitionItem[];
  totalCount?: number;
}

export function RecentRequisitionsCard({
  items,
  totalCount,
}: RecentRequisitionsCardProps) {
  const openSlipModal = useUIStore((s) => s.openSlipModal);
  const count = totalCount ?? items.length;

  return (
    <Card className="border-2 border-border shadow-xs rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">Phiếu yêu cầu cần xử lý</CardTitle>
          <Badge variant="neutral" className="ml-1 text-xs">
            {count} phiếu
          </Badge>
        </div>
        <Link
          href="/requisitions?status=pending"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Xem tất cả
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Không có phiếu yêu cầu nào đang chờ xử lý.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px] text-xs">Mã phiếu</TableHead>
                    <TableHead className="w-[180px] text-xs">Người yêu cầu</TableHead>
                    <TableHead className="w-[160px] text-xs">Khu vực</TableHead>
                    <TableHead className="text-xs">Mục đích</TableHead>
                    <TableHead className="w-[150px] text-xs">Thời gian</TableHead>
                    <TableHead className="w-[130px] text-xs">Trạng thái</TableHead>
                    <TableHead className="w-[90px] text-right text-xs">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/50">
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => openSlipModal("requisition", r.id)}
                          className="font-mono text-xs font-semibold text-primary hover:underline text-left cursor-pointer"
                        >
                          {r.code}
                        </button>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-foreground">
                          {r.requester?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {r.zone?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground" title={r.purpose}>
                        {r.purpose || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatDateTime(r.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(r.status)} className="text-xs">
                          {REQUISITION_STATUS[r.status] ?? r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openSlipModal("requisition", r.id)}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Chi tiết
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile List View */}
            <div className="divide-y md:hidden">
              {items.map((r) => (
                <div key={r.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openSlipModal("requisition", r.id)}
                      className="font-mono text-xs font-semibold text-primary hover:underline text-left"
                    >
                      {r.code}
                    </button>
                    <Badge variant={statusBadgeVariant(r.status)} className="text-[11px]">
                      {REQUISITION_STATUS[r.status] ?? r.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {r.requester?.name ?? "—"}
                      {r.zone?.name ? ` · ${r.zone.name}` : ""}
                    </span>
                    <span className="font-mono text-[11px]">{formatDateTime(r.created_at)}</span>
                  </div>
                  {r.purpose && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {r.purpose}
                    </p>
                  )}
                  <div className="flex justify-end pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => openSlipModal("requisition", r.id)}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      Chi tiết
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
