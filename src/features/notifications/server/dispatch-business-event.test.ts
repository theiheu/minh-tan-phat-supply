import { describe, it, expect, vi } from "vitest";
import { dispatchBusinessEvent } from "./dispatch-business-event";
import type { BusinessEventInput } from "./event-types";

describe("dispatchBusinessEvent", () => {
  it("orchestrates in-app notifications and email dispatch without throwing on SMTP failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const insertedAttempts: any[] = [];
    const insertedNotifications: any[] = [];
    const sendEmailMock = vi.fn().mockRejectedValueOnce(new Error("SMTP connection timeout"));

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => {
              const res = {
                data: [
                  { id: "usr-req1", name: "Nguyễn Văn A", email: "a@mtp.vn", role: "requester", is_active: true }
                ],
                error: null
              };
              return {
                or: vi.fn(() => Promise.resolve(res)),
                in: vi.fn(() => Promise.resolve(res)),
              };
            })
          };
        }
        if (table === "notifications") {
          return {
            insert: vi.fn((rows: any[]) => {
              insertedNotifications.push(...rows);
              return Promise.resolve({ error: null });
            })
          };
        }
        if (table === "email_delivery_attempts") {
          return {
            insert: vi.fn((row: any) => {
              insertedAttempts.push({ ...row });
              return Promise.resolve({ error: null });
            }),
            update: vi.fn((updates: any) => ({
              eq: vi.fn((field: string, val: string) => {
                const found = insertedAttempts.find((a) => a[field] === val);
                if (found) Object.assign(found, updates);
                return Promise.resolve({ error: null });
              })
            }))
          };
        }
        return { select: vi.fn() };
      })
    } as any;

    const eventInput: BusinessEventInput<"requisition.approved"> = {
      event: "requisition.approved",
      actorId: "usr-owner",
      subject: { type: "requisition", id: "req-123" },
      participants: { requesterId: "usr-req1" },
      payload: {
        code: "YC-2026-001",
        requesterName: "Nguyễn Văn A",
        zoneName: "Trại Bò 1",
      }
    };

    const result = await dispatchBusinessEvent({
      supabase: mockSupabase,
      input: eventInput,
      sendEmailTransport: sendEmailMock,
    });

    expect(result.inAppCount).toBeGreaterThanOrEqual(1);
    expect(result.emailAttemptCount).toBe(1);
    expect(result.emailSuccessCount).toBe(0);
    expect(result.emailFailureCount).toBe(1);

    // Verify delivery ledger records the failure
    expect(insertedAttempts.length).toBe(1);
    expect(insertedAttempts[0].status).toBe("failed");
    expect(insertedAttempts[0].error_message).toContain("SMTP connection timeout");

    // Clear expected console.error mock calls for vitest setup check
    if ((console.error as any).mockClear) {
      (console.error as any).mockClear();
    }
  });
});
