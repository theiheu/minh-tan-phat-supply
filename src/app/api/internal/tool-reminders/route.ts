import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processToolReminders } from "@/features/notifications/server/reminders";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const expectedSecret = process.env.INTERNAL_CRON_SECRET;

    if (!expectedSecret || token !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const result = await processToolReminders({ supabase });

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/internal/tool-reminders] Lỗi xử lý:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
