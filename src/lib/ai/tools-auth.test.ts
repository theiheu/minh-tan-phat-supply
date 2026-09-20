import { describe, it, expect } from "vitest";
import { verifyToolsAuth } from "./tools-auth";

describe("AI Tools Authentication", () => {
  it("chấp nhận header X-MTP-AI-SECRET hợp lệ", () => {
    const req = new Request("http://localhost:3000/api/ai-tools/stock", {
      headers: { "x-mtp-ai-secret": "mtp-dify-secret-2026" }
    });
    expect(verifyToolsAuth(req)).toBe(true);
  });

  it("chấp nhận header Authorization Bearer token hợp lệ", () => {
    const req = new Request("http://localhost:3000/api/ai-tools/stock", {
      headers: { "authorization": "Bearer mtp-dify-secret-2026" }
    });
    expect(verifyToolsAuth(req)).toBe(true);
  });

  it("từ chối khi thiếu hoặc sai secret key", () => {
    const req = new Request("http://localhost:3000/api/ai-tools/stock", {
      headers: { "x-mtp-ai-secret": "wrong-secret" }
    });
    expect(verifyToolsAuth(req)).toBe(false);

    const emptyReq = new Request("http://localhost:3000/api/ai-tools/stock");
    expect(verifyToolsAuth(emptyReq)).toBe(false);
  });
});
