"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2, Clock, Eye } from "lucide-react";
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
import { statusBadgeVariant } from "@/lib/labels";
import { useUIStore } from "@/stores/ui-store";

export interface TaskItem {
  id: string;
  code: string;
  type: "requisition" | "receipt" | "exchange" | "repair" | "liquidation" | "defect" | "stocktake" | "issue" | "tool";
  typeLabel?: string;
  title?: string;
  actorName?: string | null;
  locationOrZone?: string | null;
  description?: string | null;
  status: string;
  statusLabel: string;
  createdAt: string;
  href?: string;
  highlightAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    variant?: "default" | "outline" | "secondary";
  };
}

interface PendingTasksCardProps {
  title: string;
  icon?: LucideIcon;
  badgeCount?: number;
  items: TaskItem[];
  emptyMessage?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}

export function PendingTasksCard({
  title,
  icon: Icon = Clock,
  badgeCount,
  items,
  emptyMessage = "Không có mục nào đang chờ xử lý.",
  viewAllHref,
  viewAllLabel = "Xem tất cả",
  className,
}: PendingTasksCardProps) {
  const openSlipModal = useUIStore((s) => s.openSlipModal);

  const handleOpenDetail = (item: TaskItem) => {
    if (
      item.type === "requisition" ||
      item.type === "receipt" ||
      item.type === "exchange" ||
      item.type === "repair" ||
      item.type === "liquidation" ||
      item.type === "defect" ||
      item.type === "stocktake" ||
      item.type === "issue"
    ) {
      openSlipModal(item.type, item.id);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 sm:pb-4 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm sm:text-base font-semibold">{title}</CardTitle>
          {badgeCount !== undefined && badgeCount > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0.2 text-xs font-bold">
              {badgeCount}
            </Badge>
          )}
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {viewAllLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pt-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="size-8 text-emerald-500/70 mb-2" />
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px] text-xs">Mã phiếu</TableHead>
                    <TableHead className="w-[170px] text-xs">Đối tượng / Khu</TableHead>
                    <TableHead className="text-xs">Nội dung / Mục đích</TableHead>
                    <TableHead className="w-[140px] text-xs">Thời gian</TableHead>
                    <TableHead className="w-[120px] text-xs">Trạng thái</TableHead>
                    <TableHead className="w-[100px] text-right text-xs">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(item)}
                          className="font-mono text-xs font-bold text-primary hover:underline text-left cursor-pointer"
                        >
                          {item.code}
                        </button>
                        {item.typeLabel && (
                          <div className="text-[10px] text-muted-foreground">{item.typeLabel}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-foreground">
                          {item.actorName ?? "—"}
                        </div>
                        {item.locationOrZone && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            {item.locationOrZone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={item.description || ""}>
                        {item.description || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatDateTime(item.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(item.status)} className="text-[11px]">
                          {item.statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.highlightAction ? (
                          item.highlightAction.onClick ? (
                            <Button
                              size="sm"
                              variant={item.highlightAction.variant || "default"}
                              className="h-7 px-2 text-xs"
                              onClick={item.highlightAction.onClick}
                            >
                              {item.highlightAction.label}
                            </Button>
                          ) : (
                            <Button
                              asChild
                              size="sm"
                              variant={item.highlightAction.variant || "default"}
                              className="h-7 px-2 text-xs"
                            >
                              <Link href={item.highlightAction.href || "#"}>
                                {item.highlightAction.label}
                              </Link>
                            </Button>
                          )
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleOpenDetail(item)}
                          >
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            Chi tiết
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile List View */}
            <div className="divide-y md:hidden">
              {items.map((item) => (
                <div key={item.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(item)}
                      className="font-mono text-xs font-bold text-primary hover:underline text-left"
                    >
                      {item.code}
                    </button>
                    <Badge variant={statusBadgeVariant(item.status)} className="text-[10px]">
                      {item.statusLabel}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {item.actorName ?? item.typeLabel ?? "—"}
                      </span>
                      {item.locationOrZone && (
                        <>
                          <span>·</span>
                          <span className="font-medium text-foreground/80">{item.locationOrZone}</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono text-[10px] shrink-0">{formatDateTime(item.createdAt)}</span>
                  </div>
                  {item.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  <div className="flex justify-end pt-1">
                    {item.highlightAction ? (
                      item.highlightAction.onClick ? (
                        <Button
                          size="sm"
                          variant={item.highlightAction.variant || "default"}
                          className="h-7 px-2.5 text-xs"
                          onClick={item.highlightAction.onClick}
                        >
                          {item.highlightAction.label}
                        </Button>
                      ) : (
                        <Button
                          asChild
                          size="sm"
                          variant={item.highlightAction.variant || "default"}
                          className="h-7 px-2.5 text-xs"
                        >
                          <Link href={item.highlightAction.href || "#"}>
                            {item.highlightAction.label}
                          </Link>
                        </Button>
                      )
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => handleOpenDetail(item)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Chi tiết
                      </Button>
                    )}
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
