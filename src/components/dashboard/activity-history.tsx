"use client";

import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  DEFECT_STATUS,
  EXCHANGE_STATUS,
  ISSUE_STATUS,
  LIQUIDATION_STATUS,
  RECEIPT_STATUS,
  REPAIR_STATUS,
  REQUISITION_STATUS,
  roleLabel,
  StatusBadgeVariant,
  STOCKTAKE_STATUS,
} from "@/lib/labels";
import { useUIStore } from "@/stores/ui-store";

export interface ActivityItem {
  id: string;
  action: string;
  actionLabel: string;
  actionTone: StatusBadgeVariant;
  entityType: string;
  entityTypeLabel: string;
  entityId: string | null;
  entityCode: string | null;
  entityHref: string | null;
  actorName: string;
  actorRole: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

interface ActivityHistoryProps {
  activities: ActivityItem[];
  isManager?: boolean;
}

function getStatusLabel(status: unknown, entityType: string): string {
  if (typeof status !== "string" || !status) return "";
  const t = entityType.toLowerCase();
  if (t === "receipt" || t === "receipts") return RECEIPT_STATUS[status] ?? status;
  if (t === "issue" || t === "issues") return ISSUE_STATUS[status] ?? status;
  if (t.startsWith("defect")) return DEFECT_STATUS[status] ?? status;
  if (t.startsWith("repair")) return REPAIR_STATUS[status] ?? status;
  if (t.startsWith("liquidation")) return LIQUIDATION_STATUS[status] ?? status;
  if (t.startsWith("stocktake")) return STOCKTAKE_STATUS[status] ?? status;
  if (t.startsWith("exchange")) return EXCHANGE_STATUS[status] ?? status;
  return REQUISITION_STATUS[status] ?? status;
}

function renderActivityChange(item: ActivityItem) {
  const beforeStatus = item.before?.status;
  const afterStatus = item.after?.status;

  if (beforeStatus && afterStatus && beforeStatus !== afterStatus) {
    const fromLabel = getStatusLabel(beforeStatus, item.entityType);
    const toLabel = getStatusLabel(afterStatus, item.entityType);
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="line-through opacity-75">{fromLabel}</span>
        <span>→</span>
        <span className="font-medium text-foreground">{toLabel}</span>
      </span>
    );
  }

  if (afterStatus && !beforeStatus) {
    const toLabel = getStatusLabel(afterStatus, item.entityType);
    return <span className="text-xs text-muted-foreground">Khởi tạo: {toLabel}</span>;
  }

  if (item.after?.items && Array.isArray(item.after.items)) {
    return (
      <span className="text-xs text-muted-foreground">
        {item.after.items.length} mặt hàng
      </span>
    );
  }

  return <span className="text-xs text-muted-foreground">—</span>;
}

export function ActivityHistory({ activities, isManager = false }: ActivityHistoryProps) {
  const openSlipModal = useUIStore((s) => s.openSlipModal);

  function handleEntityClick(item: ActivityItem) {
    if (!item.entityId) return;
    openSlipModal(item.entityType, item.entityId);
  }

  return (
    <Card className="border-2 border-border shadow-xs rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">Lịch sử hoạt động</CardTitle>
        </div>
        {isManager && (
          <Link
            href="/reports?audit_page=1"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Xem tất cả trong Báo cáo
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Chưa có lịch sử hoạt động nào được ghi nhận.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px] text-xs">Thời gian</TableHead>
                    <TableHead className="w-[180px] text-xs">Người thực hiện</TableHead>
                    <TableHead className="w-[190px] text-xs">Hành động</TableHead>
                    <TableHead className="text-xs">Chứng từ / Đối tượng</TableHead>
                    <TableHead className="w-[220px] text-xs">Trạng thái / Chi tiết</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatDateTime(item.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-foreground">
                            {item.actorName}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {roleLabel(item.actorRole)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.actionTone} className="text-xs">{item.actionLabel}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {item.entityTypeLabel}
                          </span>
                          {item.entityCode && (
                            item.entityId ? (
                              <button
                                type="button"
                                onClick={() => handleEntityClick(item)}
                                className="font-mono text-xs font-semibold text-primary hover:underline text-left"
                              >
                                {item.entityCode}
                              </button>
                            ) : (
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {item.entityCode}
                              </span>
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{renderActivityChange(item)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile List View */}
            <div className="divide-y md:hidden">
              {activities.map((item) => (
                <div key={item.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={item.actionTone} className="text-[11px]">{item.actionLabel}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        {item.entityTypeLabel}
                      </span>
                      {item.entityCode && (
                        item.entityId ? (
                          <button
                            type="button"
                            onClick={() => handleEntityClick(item)}
                            className="font-mono text-xs font-semibold text-primary hover:underline text-left"
                          >
                            {item.entityCode}
                          </button>
                        ) : (
                          <span className="font-mono text-xs font-semibold">
                            {item.entityCode}
                          </span>
                        )
                      )}
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {item.actorName}
                    </span>
                  </div>
                  <div className="pt-0.5">{renderActivityChange(item)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
