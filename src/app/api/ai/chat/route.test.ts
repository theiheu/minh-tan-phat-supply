import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn()
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn()
}));
vi.mock("@/lib/ai/rate-limit", () => ({
  checkRateLimit: vi.fn()
}));
vi.mock("@/lib/ai/registry", () => ({
  getRegisteredTools: vi.fn(() => ({ /* mock tools */ }))
}));

// We'll import dynamically after setting up mocks
let POST: any;

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { getRegisteredTools } from "@/lib/ai/registry";

describe("AI Chat API - Security (WP-11)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import API AFTER mock clear
    const route = await import("@/app/api/ai/chat/route");
    POST = route.POST;
  });

  const mockReq = (body: any) => new Request("http://localhost:3000/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });

  it("ngăn chặn truy cập nếu không có xác thực (401)", async () => {
    (createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("Unauthorized") }) }
    });

    const res = await POST(mockReq({ messages: [] }));
    expect(res.status).toBe(401);
  });

  it("trả về 429 nếu bị rate limit", async () => {
    (createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }) }
    });
    (checkRateLimit as any).mockResolvedValue(false);

    const res = await POST(mockReq({ messages: [] }));
    expect(res.status).toBe(429);
  });

  it("từ chối payload không hợp lệ Zod schema (400)", async () => {
    (createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }) }
    });
    (checkRateLimit as any).mockResolvedValue(true);

    const res = await POST(mockReq({ messages: [{ role: "hacker", content: "foo" }] }));
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("yêu cầu không hợp lệ");
  });

  it("từ chối tin nhắn vượt quá content length (400)", async () => {
    (createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }) }
    });
    (checkRateLimit as any).mockResolvedValue(true);

    const overSizedContent = "a".repeat(25000);
    const res = await POST(mockReq({ messages: [{ role: "user", content: overSizedContent }] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Nội dung tin nhắn quá dài");
  });
});
