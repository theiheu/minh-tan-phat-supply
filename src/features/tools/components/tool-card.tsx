"use client";

import { AlertTriangle, ArrowDownLeft, Calendar, CheckCircle2, MapPin, Printer, User, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { ToolReturnDialog } from "./tool-return-dialog";
import { cn } from "@/lib/utils";

export interface ToolCardProps {
  borrowingId: string;
  code?: string;
  variantId?: string;
  productName: string;
  variantLabel?: string | null;
  unit?: string | null;
  imageUrl?: string | null;
  quantity: number;
  returnedQuantity?: number;
  borrowedAt: string;
  expectedReturnDate?: string | null;
  returnedAt?: string | null;
  purpose: string;
  borrowerName?: string | null;
  borrowerUsername?: string | null;
  zoneName?: string | null;
  issuedByName?: string | null;
  isManager?: boolean;
  status?: string;
  onReturnSuccess?: () => void;
  onCancelSuccess?: () => void;
}

function getOverdueDays(expectedReturnDate?: string | null): number {
  if (!expectedReturnDate) return 0;
  const exp = new Date(expectedReturnDate);
  if (Number.isNaN(exp.getTime())) return 0;

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expMidnight = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());

  const diffTime = todayMidnight.getTime() - expMidnight.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

export function ToolCard({
  borrowingId,
  code,
  variantId,
  productName,
  variantLabel,
  unit,
  imageUrl,
  quantity,
  returnedQuantity = 0,
  borrowedAt,
  expectedReturnDate,
  returnedAt,
  purpose,
  borrowerName,
  borrowerUsername,
  zoneName,
  issuedByName,
  isManager = false,
  status = "borrowed",
  onReturnSuccess,
}: ToolCardProps) {
  const remaining = Math.max(0, quantity - (returnedQuantity ?? 0));
  const isFullyReturned = remaining === 0 || status === "returned";
  const overdueDays = !isFullyReturned ? getOverdueDays(expectedReturnDate) : 0;

  return (
    <Card
      className={cn(
        "flex flex-col justify-between transition-all border",
        overdueDays > 0
          ? "border-amber-300 dark:border-amber-700/50 bg-amber-50/30 dark:bg-amber-950/10 shadow-sm"
          : isFullyReturned
            ? "border-border/60 bg-card/60 opacity-80"
            : "border-border bg-card",
      )}
    >
      <CardHeader className="p-4 pb-2 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={productName}
                className="size-8 rounded-lg object-cover shrink-0 mt-0.5 border"
              />
            ) : (
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary mt-0.5">
                <Wrench className="size-4" />
              </div>
            )}
            <div>
              <div className="font-semibold text-base leading-snug line-clamp-1">{productName}</div>
              {variantLabel && (
                <div className="text-xs text-muted-foreground">{variantLabel}</div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {isFullyReturned ? (
              <Badge variant="success" className="gap-1 font-medium">
                <CheckCircle2 className="size-3" />
                Đã trả đủ
              </Badge>
            ) : (
              <Badge variant="secondary" className="font-semibold">
                Đang giữ: {remaining} {unit || ""}
              </Badge>
            )}

            {overdueDays > 0 && (
              <Badge variant="danger" className="animate-pulse gap-1 font-medium">
                <AlertTriangle className="size-3" />
                ⚠️ Quá hạn {overdueDays} ngày
              </Badge>
            )}
          </div>
        </div>

        {code && (
          <div className="text-xs text-muted-foreground font-mono">
            Mã: <span className="font-medium text-foreground">{code}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 pt-1 pb-3 space-y-2.5 text-xs">
        {/* Purpose */}
        <div className="p-2 rounded bg-muted/40 border border-muted-foreground/10">
          <div className="font-medium text-muted-foreground mb-0.5">Mục đích:</div>
          <div className="text-foreground font-normal line-clamp-2">{purpose}</div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
          {/* Borrower */}
          {(borrowerName || borrowerUsername) && (
            <div className="flex items-center gap-1.5 truncate">
              <User className="size-3.5 shrink-0 text-muted-foreground/80" />
              <span className="truncate">
                {borrowerName || borrowerUsername}
              </span>
            </div>
          )}

          {/* Zone */}
          {zoneName && (
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="size-3.5 shrink-0 text-muted-foreground/80" />
              <span className="truncate">{zoneName}</span>
            </div>
          )}

          {/* Borrowed Date */}
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 shrink-0 text-muted-foreground/80" />
            <span>Mượn: {formatDate(borrowedAt)}</span>
          </div>

          {/* Expected Return Date or Returned Date */}
          {isFullyReturned && returnedAt ? (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5 shrink-0" />
              <span>Đã trả: {formatDate(returnedAt)}</span>
            </div>
          ) : expectedReturnDate ? (
            <div
              className={cn(
                "flex items-center gap-1.5",
                overdueDays > 0 ? "text-destructive font-medium" : "",
              )}
            >
              <Calendar className="size-3.5 shrink-0" />
              <span>Hẹn trả: {formatDate(expectedReturnDate)}</span>
            </div>
          ) : issuedByName ? (
            <div className="flex items-center gap-1.5 truncate">
              <User className="size-3.5 shrink-0 text-muted-foreground/80" />
              <span className="truncate">Cấp: {issuedByName}</span>
            </div>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-2 border-t border-border/40 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          asChild
        >
          <a href={`/api/tools/${borrowingId}/pdf`} target="_blank" rel="noopener noreferrer">
            <Printer className="size-3.5" />
            In phiếu
          </a>
        </Button>

        {!isFullyReturned && (
          isManager ? (
            <ToolReturnDialog
              borrowingId={borrowingId}
              code={code}
              variantId={variantId}
              productName={productName}
              variantLabel={variantLabel}
              unit={unit}
              quantity={quantity}
              returnedQuantity={returnedQuantity}
              isManager={isManager}
              triggerLabel="Xác nhận nhận lại"
              onSuccess={onReturnSuccess}
            />
          ) : (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <ArrowDownLeft className="size-3.5 text-primary shrink-0" />
              <span>Mang dụng cụ về Kho chính để thủ kho nhận lại</span>
            </div>
          )
        )}
      </CardFooter>
    </Card>
  );
}
