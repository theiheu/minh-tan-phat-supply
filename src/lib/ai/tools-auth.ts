import { aiEnv } from "@/lib/ai/config/env";

/**
 * Xác thực API request từ Dify Agent hoặc external tool runner.
 * Chấp nhận Header:
 * - X-MTP-AI-SECRET: <secret>
 * - Authorization: Bearer <secret>
 */
export function verifyToolsAuth(req: Request): boolean {
  const secret = aiEnv.difyToolsSecret || "mtp-dify-secret-2026";
  
  const customHeader = req.headers.get("x-mtp-ai-secret");
  if (customHeader && customHeader === secret) {
    return true;
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token === secret || token === aiEnv.apiKey) {
      return true;
    }
  }

  return false;
}
