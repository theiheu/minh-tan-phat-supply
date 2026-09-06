"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { STOCKTAKE_STATUS, statusBadgeVariant } from "@/lib/labels";
import type { StocktakeSessionView } from "../types";
import { createStocktake, deleteStocktake, reopenStocktake } from "../actions";
import { StocktakeItemsView } from "./stocktake-items-view";

/** Tên hiển thị của phiếu: ưu tiên tên người dùng đặt; phiếu cũ không tên → mã phiếu. */
function sessionTitle(s: StocktakeSessionView): string {
  return s.name && s.name.trim() ? s.name.trim() : s.code;
}

export function StocktakeManager({
  sessions,
  locations,
  isDev = false,
}: {
  sessions: StocktakeSessionView[];
  locations: { id: string; name: string }[];
  /** Chỉ superuser (dev) mới thấy nút Mở lại sửa / Xoá phiếu. */
  isDev?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState("");
  // Một phiếu (draft: bảng nhập; posted: bảng chi tiết) mở tại một thời điểm.
  const [openId, setOpenId] = useState<string | null>(null);

  const canCreate = locationId !== "" && name.trim() !== "";

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    startTransition(async () => {
      try {
        await createStocktake(locationId, name);
        toast.success("Đã tạo phiếu kiểm kê");
        setName("");
        setLocationId("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
      }
    });
  }

  /** Dev: mở lại phiếu đã chốt về nháp (đảo bút toán) để sửa số liệu. */
  function reopen(session: StocktakeSessionView) {
    const ok = window.confirm(
      `Mở lại phiếu "${sessionTitle(session)}" về trạng thái nháp?\n\nToàn bộ bút toán tồn kho của phiếu sẽ bị đảo ngược (hoàn lại kho). Sau khi sửa, phải bấm "Chốt kiểm kê" để ghi sổ lại.`,
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await reopenStocktake(session.id);
        toast.success(`Đã mở lại phiếu "${sessionTitle(session)}" — hãy sửa rồi chốt lại`);
        setOpenId(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
      }
    });
  }

  /** Dev: xoá phiếu (đã chốt sẽ đảo bút toán trước khi xoá). */
  function remove(session: StocktakeSessionView) {
    const ok = window.confirm(
      session.status === "posted"
        ? `Xoá phiếu "${sessionTitle(session)}"?\n\nPhiếu ĐÃ CHỐT: toàn bộ bút toán tồn kho sẽ bị đảo ngược trước khi xoá. Hành động không thể hoàn tác.`
        : `Xoá phiếu "${sessionTitle(session)}"? Hành động không thể hoàn tác.`,
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteStocktake(session.id);
        toast.success("Đã xoá phiếu kiểm kê");
        setOpenId(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Tạo phiếu kiểm kê: tên phiếu bắt buộc + chọn kho */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tạo phiếu kiểm kê</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-1.5 sm:max-w-sm">
              <Label htmlFor="stocktake-name">
                Tên phiếu <span className="text-destructive">*</span>
              </Label>
              <Input
                id="stocktake-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Kiểm kê cuối tháng 9"
                maxLength={200}
                disabled={pending}
              />
            </div>
            <div className="w-full space-y-1.5 sm:w-56">
              <Label htmlFor="stocktake-location">Vị trí kho</Label>
              <Select value={locationId} onValueChange={setLocationId} disabled={pending}>
                <SelectTrigger id="stocktake-location" className="w-full"><SelectValue placeholder="Chọn kho" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={pending || !canCreate} className="w-full sm:w-auto">
              {pending ? "Đang tạo…" : "Tạo phiếu"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {sessions.length === 0 && <p className="text-sm text-muted-foreground">Chưa có phiếu kiểm kê.</p>}
        {sessions.map((s) => {
          const isOpen = openId === s.id;
          const isDraft = s.status === "draft";
          const checkedCount = s.items.filter((i) => i.checked).length;
          const canOpen = (isDraft || s.status === "posted") && s.items.length > 0;
          return (
            <Card
              key={s.id}
              className={cn(
                // Highlight nhẹ: phiếu nháp (đang xử lý) có viền trái màu; phiếu đang mở có vòng sáng.
                isDraft && "border-l-[3px] border-l-amber-400",
                isOpen && "ring-2 ring-primary/15",
              )}
            >
              <CardHeader className="space-y-2">
                {/* Dòng 1: tên phiếu — bấm vào để mở/đóng chi tiết; tag trạng thái góc trên phải. */}
                <div className="flex items-start justify-between gap-x-3">
                  <button
                    type="button"
                    disabled={!canOpen}
                    onClick={() => setOpenId(isOpen ? null : s.id)}
                    title={
                      canOpen
                        ? isOpen
                          ? "Đóng bảng"
                          : isDraft
                            ? "Mở bảng nhập kiểm"
                            : "Xem chi tiết phiếu"
                        : undefined
                    }
                    className={cn(
                      "group min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      canOpen ? "cursor-pointer" : "cursor-default",
                    )}
                  >
                    <h3
                      className={cn(
                        "text-base leading-snug font-semibold break-words",
                        canOpen && "underline-offset-4 group-hover:underline group-hover:decoration-primary/50",
                      )}
                    >
                      {sessionTitle(s)}
                    </h3>
                  </button>
                  <Badge variant={statusBadgeVariant(s.status)} className="shrink-0">
                    {STOCKTAKE_STATUS[s.status] ?? s.status}
                  </Badge>
                </div>

                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{s.code}</span> · {s.locationName} ·{" "}
                  {formatDate(s.postedAt ?? s.createdAt)}
                  {canOpen && (
                    <span className="ml-1.5">
                      {isDraft ? `· đã kiểm ${checkedCount}/${s.items.length} dòng` : `· ${checkedCount} dòng đã kiểm`}
                    </span>
                  )}
                </p>

                {(isDraft || s.items.length > 0 || isDev) && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {isDraft && canOpen && (
                      <Button
                        size="sm"
                        variant={isOpen ? "outline" : "default"}
                        onClick={() => setOpenId(isOpen ? null : s.id)}
                      >
                        {isOpen ? "Đóng" : "Nhập số thực tế"}
                      </Button>
                    )}
                    {s.items.length > 0 && (
                      <Link
                        href={`/api/stocktake/${s.id}/pdf`}
                        target="_blank"
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium hover:bg-accent"
                      >
                        <Printer className="size-3.5" aria-hidden />
                        In
                      </Link>
                    )}

                    {/* Công cụ dev — tách riêng khỏi nút nghiệp vụ để khỏi lẫn */}
                    {isDev && (
                      <span
                        className="flex items-center gap-0.5 rounded-md border border-destructive/30 px-0.5 py-0.5"
                        title="Công cụ dev (superuser)"
                      >
                        {s.status === "posted" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={pending}
                            onClick={() => reopen(s)}
                            title="Dev: đảo bút toán và mở lại về nháp để sửa số liệu"
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          disabled={pending}
                          onClick={() => remove(s)}
                          title="Dev: xoá phiếu (đã chốt sẽ đảo bút toán trước khi xoá)"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </span>
                    )}
                  </div>
                )}
              </CardHeader>

              {isOpen && canOpen && (
                <CardContent className="border-t pt-3">
                  <StocktakeItemsView
                    mode={isDraft ? "entry" : "view"}
                    sessionId={isDraft ? s.id : undefined}
                    items={s.items}
                    onDone={() => setOpenId(null)}
                  />
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
