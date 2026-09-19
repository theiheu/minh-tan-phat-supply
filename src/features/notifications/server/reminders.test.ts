import { describe, it, expect, vi } from "vitest";
import { processToolReminders } from "./reminders";

describe("processToolReminders", () => {
  it("claims tool reminders atomically and dispatches appropriate business events", async () => {
    const mockClaims = [
      {
        borrowing_id: "tb-1",
        reminder_type: "due_soon",
        code: "PM-001",
        borrower_id: "usr-borrower-1",
        tool_names: "Máy khoan bê tông",
        expected_return_date: "2026-09-20T10:00:00Z",
        overdue_days: 0,
      },
      {
        borrowing_id: "tb-2",
        reminder_type: "overdue",
        code: "PM-002",
        borrower_id: "usr-borrower-2",
        tool_names: "Máy hàn Jasic",
        expected_return_date: "2026-09-18T10:00:00Z",
        overdue_days: 2,
      },
    ];

    const dispatchedEvents: any[] = [];

    const mockSupabase = {
      rpc: vi.fn((name: string) => {
        if (name === "claim_tool_reminders") {
          return Promise.resolve({ data: mockClaims, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({
            data: [
              { id: "usr-borrower-1", name: "Người Mượn 1", email: "b1@mtp.vn", role: "requester", is_active: true },
              { id: "usr-borrower-2", name: "Người Mượn 2", email: "b2@mtp.vn", role: "requester", is_active: true },
              { id: "usr-wh", name: "Thủ Kho", email: "wh@mtp.vn", role: "warehouse", is_active: true },
            ],
            error: null
          })),
          or: vi.fn(() => Promise.resolve({
            data: [
              { id: "usr-borrower-1", name: "Người Mượn 1", email: "b1@mtp.vn", role: "requester", is_active: true },
              { id: "usr-borrower-2", name: "Người Mượn 2", email: "b2@mtp.vn", role: "requester", is_active: true },
              { id: "usr-wh", name: "Thủ Kho", email: "wh@mtp.vn", role: "warehouse", is_active: true },
            ],
            error: null
          }))
        })),
        insert: vi.fn(() => Promise.resolve({ error: null })),
        update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
      })),
    } as any;

    const result = await processToolReminders({
      supabase: mockSupabase,
      now: new Date("2026-09-19T10:00:00Z"),
      dispatchFn: async (opts) => {
        dispatchedEvents.push(opts.input);
        return { inAppCount: 1, emailAttemptCount: 1, emailSuccessCount: 1, emailFailureCount: 0 };
      }
    });

    expect(result.claimedCount).toBe(2);
    expect(result.dueSoonCount).toBe(1);
    expect(result.overdueCount).toBe(1);

    expect(dispatchedEvents).toHaveLength(2);
    expect(dispatchedEvents[0].event).toBe("tool.due_soon");
    expect(dispatchedEvents[0].participants.borrowerId).toBe("usr-borrower-1");
    expect(dispatchedEvents[1].event).toBe("tool.overdue_started");
    expect(dispatchedEvents[1].participants.borrowerId).toBe("usr-borrower-2");
  });
});
