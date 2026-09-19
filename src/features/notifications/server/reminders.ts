import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { dispatchBusinessEvent } from "./dispatch-business-event";

export interface ProcessToolRemindersOptions {
  supabase: SupabaseClient<Database>;
  now?: Date;
  dispatchFn?: typeof dispatchBusinessEvent;
}

export interface ProcessToolRemindersResult {
  claimedCount: number;
  dueSoonCount: number;
  overdueCount: number;
  errors: string[];
}

/**
 * Xử lý quét và gửi email nhắc hạn mượn dụng cụ.
 * Gọi RPC claim_tool_reminders để claim nguyên tử và tránh gửi lặp.
 */
export async function processToolReminders({
  supabase,
  now = new Date(),
  dispatchFn = dispatchBusinessEvent,
}: ProcessToolRemindersOptions): Promise<ProcessToolRemindersResult> {
  const result: ProcessToolRemindersResult = {
    claimedCount: 0,
    dueSoonCount: 0,
    overdueCount: 0,
    errors: [],
  };

  const { data: claims, error } = await supabase.rpc("claim_tool_reminders", {
    p_now: now.toISOString(),
  });

  if (error || !claims) {
    const msg = error?.message ?? "Không thể gọi claim_tool_reminders RPC";
    console.error("[processToolReminders] Lỗi:", msg);
    result.errors.push(msg);
    return result;
  }

  result.claimedCount = claims.length;

  for (const item of claims) {
    try {
      if (item.reminder_type === "due_soon") {
        result.dueSoonCount++;
        await dispatchFn({
          supabase,
          input: {
            event: "tool.due_soon",
            actorId: null, // automated system
            subject: { type: "tool_borrowing", id: item.borrowing_id },
            participants: { borrowerId: item.borrower_id },
            payload: {
              code: item.code,
              toolNames: item.tool_names,
              expectedReturnDate: item.expected_return_date,
            },
          },
          occurrenceKey: "due_soon",
        });
      } else if (item.reminder_type === "overdue") {
        result.overdueCount++;
        await dispatchFn({
          supabase,
          input: {
            event: "tool.overdue_started",
            actorId: null, // automated system
            subject: { type: "tool_borrowing", id: item.borrowing_id },
            participants: { borrowerId: item.borrower_id },
            payload: {
              code: item.code,
              toolNames: item.tool_names,
              expectedReturnDate: item.expected_return_date,
              overdueDays: item.overdue_days,
            },
          },
          occurrenceKey: "overdue",
        });
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[processToolReminders] Lỗi dispatch phiếu ${item.code}:`, msg);
      result.errors.push(`Phiếu ${item.code}: ${msg}`);
    }
  }

  return result;
}
