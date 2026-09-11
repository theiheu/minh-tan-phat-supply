"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "vừa xong";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);

  // Chỉ lấy số lượng chưa đọc khi chưa mở drawer để tiết kiệm tài nguyên
  const refreshCountOnly = useCallback(async () => {
    const supabase = createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    setUnread(count ?? 0);
  }, []);

  // Lấy chi tiết 30 thông báo khi người dùng mở drawer
  const refreshFull = useCallback(async () => {
    const supabase = createClient();
    const [{ data: rows }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    ]);
    if (rows) setItems(rows);
    setUnread(count ?? 0);
  }, []);

  useEffect(() => {
    refreshCountOnly();
    const timer = setInterval(refreshCountOnly, 30000);
    return () => clearInterval(timer);
  }, [refreshCountOnly]);

  useEffect(() => {
    if (open) refreshFull();
  }, [open, refreshFull]);

  async function openItem(n: NotificationRow) {
    const supabase = createClient();
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
      setUnread((u) => Math.max(0, u - 1));
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: x.read_at ?? "" } : x)));
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function markAllRead() {
    const supabase = createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    await refreshFull();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="relative" aria-label="Thông báo">
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-sm">
          <SheetHeader className="flex-row items-center justify-between border-b space-y-0">
            <SheetTitle>Thông báo</SheetTitle>
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead}>
                Đã đọc tất cả
              </Button>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4">
            {items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Chưa có thông báo.</p>
            ) : (
              <ul className="divide-y">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className="w-full py-3 text-left"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-primary"}`} />
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm ${n.read_at ? "text-muted-foreground" : "font-medium"}`}>{n.title}</div>
                          {n.body ? <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div> : null}
                          <div className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
