"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { STOCKTAKE_STATUS, statusBadgeClass } from "@/lib/labels";
import type { StocktakeSessionView } from "../types";
import { createStocktake, deleteStocktake, reopenStocktake } from "../actions";
import { StocktakeItemsView } from "./stocktake-items-view";

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
  const [locationId, setLocationId] = useState("");
  // Một phiếu (draft: bảng nhập; posted: bảng chi tiết) mở tại một thời điểm.
  const [openId, setOpenId] = useState<string | null>(null);

  function create() {
    startTransition(async () => {
      try {
        await createStocktake(locationId);
        toast.success("Đã tạo phiếu kiểm kê");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  /** Dev: mở lại phiếu đã chốt về nháp (đảo bút toán) để sửa số liệu. */
  function reopen(session: StocktakeSessionView) {
    const ok = window.confirm(
      `Mở lại phiếu ${session.code} về trạng thái nháp?\n\nToàn bộ bút toán tồn kho của phiếu sẽ bị đảo ngược (hoàn lại kho). Sau khi sửa, phải bấm "Chốt kiểm kê" để ghi sổ lại.`,
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await reopenStocktake(session.id);
        toast.success(`Đã mở lại phiếu ${session.code} — hãy sửa rồi chốt lại`);
        setOpenId(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  /** Dev: xoá phiếu (đã chốt sẽ đảo bút toán trước khi xoá). */
  function remove(session: StocktakeSessionView) {
    const ok = window.confirm(
      session.status === "posted"
        ? `Xoá phiếu ${session.code}?\n\nPhiếu ĐÃ CHỐT: toàn bộ bút toán tồn kho sẽ bị đảo ngược trước khi xoá. Hành động không thể hoàn tác.`
        : `Xoá phiếu ${session.code}? Hành động không thể hoàn tác.`,
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteStocktake(session.id);
        toast.success("Đã xoá phiếu kiểm kê");
        setOpenId(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Tạo phiếu kiểm kê</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div className="w-64 space-y-1.5">
            <Label>Vị trí kho</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn kho" /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={create} disabled={pending || !locationId}>
            Tạo phiếu
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {sessions.length === 0 && <p className="text-sm text-muted-foreground">Chưa có phiếu kiểm kê.</p>}
        {sessions.map((s) => {
          const isOpen = openId === s.id;
          const checkedCount = s.items.filter((i) => i.checked).length;
          return (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{s.code}</span>
                  <Badge variant="outline" className={statusBadgeClass(s.status)}>{STOCKTAKE_STATUS[s.status] ?? s.status}</Badge>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-sm text-muted-foreground">
                    {s.locationName} · {formatDate(s.postedAt ?? s.createdAt)}
                  </span>
                  {s.items.length > 0 && (
                    <Link
                      href={`/api/stocktake/${s.id}/pdf`}
                      target="_blank"
                      className="rounded-md px-2 py-1 text-sm text-primary hover:bg-accent"
                    >
                      In
                    </Link>
                  )}
                  {isDev && s.status === "posted" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => reopen(s)}
                      title="Dev: đảo bút toán và mở lại về nháp để sửa số liệu"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Mở lại sửa
                    </Button>
                  )}
                  {isDev && (s.status === "draft" || s.status === "posted" || s.status === "cancelled") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={pending}
                      onClick={() => remove(s)}
                      title="Dev: xoá phiếu (đã chốt sẽ đảo bút toán trước khi xoá)"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Xoá
                    </Button>
                  )}
                </div>
              </CardHeader>

              {(s.status === "draft" || s.status === "posted") && s.items.length > 0 && (
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {s.status === "draft"
                        ? `Nhập số thực tế — đã kiểm ${checkedCount}/${s.items.length} dòng`
                        : `Kết quả kiểm kê — ${checkedCount} dòng đã kiểm`}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOpenId(isOpen ? null : s.id)}
                    >
                      {isOpen ? "Đóng" : s.status === "draft" ? "Nhập số thực tế" : "Xem chi tiết"}
                    </Button>
                  </div>

                  {isOpen && (
                    <StocktakeItemsView
                      mode={s.status === "draft" ? "entry" : "view"}
                      sessionId={s.status === "draft" ? s.id : undefined}
                      items={s.items}
                      onDone={() => setOpenId(null)}
                    />
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
