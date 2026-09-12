"use server";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export async function getUnreadNotificationsCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getRecentNotifications(): Promise<{ items: NotificationRow[]; unread: number }> {
  try {
    const supabase = await createClient();
    const [{ data: rows }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    ]);
    return { items: rows ?? [], unread: count ?? 0 };
  } catch {
    return { items: [], unread: 0 };
  }
}

export async function markNotificationReadAction(id: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    return true;
  } catch {
    return false;
  }
}

export async function markAllNotificationsReadAction(): Promise<boolean> {
  try {
    const supabase = await createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    return true;
  } catch {
    return false;
  }
}
