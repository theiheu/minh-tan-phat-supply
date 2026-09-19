import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
  })),
}));

vi.mock("@/features/notifications/server/reminders", () => ({
  processToolReminders: vi.fn(() => Promise.resolve({
    claimedCount: 2,
    dueSoonCount: 1,
    overdueCount: 1,
    errors: [],
  })),
}));

describe("POST /api/internal/tool-reminders", () => {
  const originalSecret = process.env.INTERNAL_CRON_SECRET;

  beforeEach(() => {
    process.env.INTERNAL_CRON_SECRET = "super-secret-token";
  });

  afterEach(() => {
    process.env.INTERNAL_CRON_SECRET = originalSecret;
  });

  it("returns 401 when Authorization header is missing or incorrect", async () => {
    const reqNoAuth = new NextRequest("http://localhost:3000/api/internal/tool-reminders", {
      method: "POST",
    });
    const resNoAuth = await POST(reqNoAuth);
    expect(resNoAuth.status).toBe(401);

    const reqBadAuth = new NextRequest("http://localhost:3000/api/internal/tool-reminders", {
      method: "POST",
      headers: { authorization: "Bearer wrong-token" },
    });
    const resBadAuth = await POST(reqBadAuth);
    expect(resBadAuth.status).toBe(401);
  });

  it("returns 200 and calls processToolReminders when secret matches", async () => {
    const req = new NextRequest("http://localhost:3000/api/internal/tool-reminders", {
      method: "POST",
      headers: { authorization: "Bearer super-secret-token" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.result.claimedCount).toBe(2);
  });
});
