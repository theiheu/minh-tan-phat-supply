import { streamText, Message } from "ai";
import { getChatModel } from "@/lib/ai/providers/omniroute";
import { buildSystemPrompt } from "@/lib/ai/orchestrator/system-prompt";
import { optimizeMessageHistory } from "@/lib/ai/orchestrator/token-optimizer";
import { getRegisteredTools } from "@/lib/ai/registry";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { aiEnv } from "@/lib/ai/config/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const maxDuration = 60; // Hỗ trợ timeout 60 giây cho tool calling

interface SettingRow {
  key: string;
  value: unknown;
}

// 1. Zod request schema (WP-11)
const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system", "tool", "data"]),
    content: z.string().max(20000, "Nội dung tin nhắn quá dài"),
    id: z.string().optional(),
    name: z.string().optional(),
    tool_calls: z.any().optional(),
    tool_call_id: z.any().optional(),
    annotations: z.any().optional(),
    data: z.any().optional()
  })).max(100, "Lịch sử tin nhắn vượt quá giới hạn 100")
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const db = adminClient as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            gte: (col: string, val: string) => {
              order: (col: string, opts?: { ascending: boolean }) => {
                limit: (n: number) => {
                  single: () => Promise<{ data: { id: string } | null; error: Error | null }>;
                };
              };
            };
            order: (col: string, opts?: { ascending: boolean }) => {
              limit: (n: number) => {
                single: () => Promise<{ data: { id: string } | null; error: Error | null }>;
              };
            };
            single: () => Promise<{ data: any; error: Error | null }>;
          };
        } & Promise<{ data: SettingRow[] | null; error: Error | null }>;
        insert: (data: unknown) => {
          select: (col: string) => {
            single: () => Promise<{ data: { id: string } | null; error: Error | null }>;
          };
        } & Promise<{ error: Error | null }>;
        update: (data: unknown) => {
          eq: (col: string, val: string) => Promise<{ error: Error | null }>;
        };
      };
    };

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Yêu cầu đăng nhập để sử dụng AI Copilot." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Per-user Rate limit (WP-11)
    const allowed = await checkRateLimit(user.id);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Bạn đã vượt quá số lượt yêu cầu cho phép, vui lòng thử lại sau một phút." }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Yêu cầu (WP-11) - Parse body with Zod
    const bodyText = await req.text();
    let bodyJson;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      return new Response(JSON.stringify({ error: "Payload không hợp lệ" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const parseResult = chatRequestSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Dữ liệu yêu cầu không hợp lệ: " + parseResult.error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { messages }: { messages: Message[] } = parseResult.data as { messages: Message[] };

    // 1. Kiểm tra Cài đặt Bật / Tắt AI và Model tùy chỉnh từ Database
    const { data: settingsRows } = await db.from("ai_system_settings").select("key, value");
    const settingsMap: Record<string, unknown> = {};
    (settingsRows || []).forEach((row) => {
      settingsMap[row.key] = row.value;
    });

    if (settingsMap["ai_enabled"] === false) {
      return new Response(
        JSON.stringify({ error: "Hệ thống AI Copilot hiện đang được Quản trị viên tạm tắt để bảo trì." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const effectiveModel = typeof settingsMap["ai_model"] === "string" ? settingsMap["ai_model"] : aiEnv.chatModel;
    
    // WP-11: Clamp max tokens and max steps by server policy
    let effectiveMaxTokens = aiEnv.maxTokens;
    if (typeof settingsMap["ai_max_tokens"] === "number") {
      effectiveMaxTokens = Math.min(settingsMap["ai_max_tokens"] as number, 2048); // Ensure it does not exceed hard max (e.g., 2048)
    } else {
      effectiveMaxTokens = Math.min(aiEnv.maxTokens, 2048);
    }

    // 2. Lấy thông tin Profile và Role của người dùng
    const { data: profile } = await db
      .from("profiles")
      .select("id, name, username, role")
      .eq("id", user.id)
      .single();

    const userContext = {
      userId: user.id,
      userName: profile?.name || profile?.username || "Người dùng",
      role: profile?.role || "requester",
    };

    // 3. Tối ưu hoá lịch sử tin nhắn để tiết kiệm token
    const optimizedMessages = optimizeMessageHistory(messages || []);

    // 4. Tạo System Prompt tối ưu theo Role
    const systemPrompt = buildSystemPrompt(userContext);

    // 5. Lấy danh sách Tools được phép theo quyền hạn
    const tools = getRegisteredTools(userContext);

    // 6. Ghi nhận Conversation và Message vào Database cho mục đích Audit
    const lastUserMessage = (messages || []).filter((m) => m.role === "user").slice(-1)[0];
    if (lastUserMessage) {
      try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: recentConv } = await db
          .from("ai_conversations")
          .select("id")
          .eq("user_id", user.id)
          .gte("updated_at", twoHoursAgo)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        let convId = recentConv?.id;
        if (!convId) {
          // Audit Log WP-11: Giới hạn độ dài payload title để không vượt quá mức cho phép
          const convTitle = typeof lastUserMessage.content === 'string' ? lastUserMessage.content.slice(0, 60) : "Cuộc đàm thoại mới";
          const { data: newConv } = await db
            .from("ai_conversations")
            .insert({ user_id: user.id, title: convTitle || "Cuộc đàm thoại mới" })
            .select("id")
            .single();
          convId = newConv?.id;
        } else {
          await db
            .from("ai_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", convId);
        }

        if (convId) {
          // Truncate message payload for audit logging if necessary
          const stringContent = typeof lastUserMessage.content === 'string' ? lastUserMessage.content : JSON.stringify(lastUserMessage.content);
          const truncatedContent = stringContent.length > 5000 
            ? stringContent.slice(0, 5000) + " [TRUNCATED]" 
            : stringContent;
            
          await db.from("ai_messages").insert({
            conversation_id: convId,
            role: "user",
            content: truncatedContent,
          });
        }
      } catch (logErr) {
        console.warn("[AI Audit Log Error]:", logErr);
      }
    }

    const _safeStringifyLimit = (obj: any, limit: number = 5000) => {
      if (!obj) return null;
      try {
        const str = JSON.stringify(obj);
        return str.length > limit ? JSON.parse(str.slice(0, limit) + '"}') : obj; // Might still fail
      } catch {
        return { warning: "Payload truncated" };
      }
    };
    
    // Safer approach to limit object size
    const limitObjDeep = (obj: any, depth = 0, maxDepth = 5): any => {
      if (!obj) return null;
      if (depth >= maxDepth) return "[TRUNCATED_DEPTH]";
      if (typeof obj === 'string') return obj.length > 500 ? obj.slice(0, 500) + "[TRUNC]" : obj;
      if (Array.isArray(obj)) return obj.slice(0, 20).map(v => limitObjDeep(v, depth + 1, maxDepth));
      if (typeof obj === 'object') {
        const res: Record<string, any> = {};
        for (const [k, v] of Object.entries(obj)) res[k] = limitObjDeep(v, depth + 1, maxDepth);
        return res;
      }
      return obj;
    };

    // 7. Khởi tạo Stream Text với Tool Calling đa bước
    const result = streamText({
      model: getChatModel(effectiveModel),
      system: systemPrompt,
      messages: optimizedMessages,
      tools,
      maxSteps: 5, // WP-11 hard limit to 5 steps instead of 10 to avoid abuse
      maxTokens: effectiveMaxTokens,
      onFinish: async ({ text, toolCalls, toolResults }) => {
        try {
          const { data: latestConv } = await db
            .from("ai_conversations")
            .select("id")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();

          if (latestConv?.id && (text || (toolCalls && toolCalls.length > 0))) {
            const stringText = typeof text === 'string' ? text : "";
            const truncatedText = stringText.length > 5000 
              ? stringText.slice(0, 5000) + " [TRUNCATED]" 
              : stringText;

            const cleanToolCalls = limitObjDeep(toolCalls);
            const cleanToolResults = limitObjDeep(toolResults);

            await db.from("ai_messages").insert({
              conversation_id: latestConv.id,
              role: "assistant",
              content: truncatedText || "",
              tool_calls: cleanToolCalls,
              tool_results: cleanToolResults,
            });
          }
        } catch (saveErr) {
          console.warn("[AI Assistant Message Save Error]:", saveErr);
        }
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage: (err) => err instanceof Error ? err.message : String(err),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Đã xảy ra lỗi khi xử lý câu hỏi với AI Copilot.";
    console.error("[AI Chat API Error]:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
