import { streamText, Message } from "ai";
import { getChatModel } from "@/lib/ai/providers/omniroute";
import { buildSystemPrompt } from "@/lib/ai/orchestrator/system-prompt";
import { optimizeMessageHistory } from "@/lib/ai/orchestrator/token-optimizer";
import { getRegisteredTools } from "@/lib/ai/registry";
import { aiEnv } from "@/lib/ai/config/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60; // Hỗ trợ timeout 60 giây cho tool calling

interface SettingRow {
  key: string;
  value: unknown;
}

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
    const effectiveMaxTokens = typeof settingsMap["ai_max_tokens"] === "number" ? settingsMap["ai_max_tokens"] : aiEnv.maxTokens;

    // 2. Lấy thông tin Profile và Role của người dùng
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, username, role")
      .eq("id", user.id)
      .single();

    const userContext = {
      userId: user.id,
      userName: profile?.name || profile?.username || "Người dùng",
      role: profile?.role || "requester",
    };

    const { messages }: { messages: Message[] } = await req.json();

    // 3. Tối ưu hoá lịch sử tin nhắn để tiết kiệm token
    const optimizedMessages = optimizeMessageHistory(messages || []);

    // 4. Tạo System Prompt tối ưu theo Role
    const systemPrompt = buildSystemPrompt(userContext);

    // 5. Lấy danh sách Tools được phép theo quyền hạn
    const tools = getRegisteredTools(userContext.role);

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
          const convTitle = lastUserMessage.content.slice(0, 60) || "Cuộc đàm thoại mới";
          const { data: newConv } = await db
            .from("ai_conversations")
            .insert({ user_id: user.id, title: convTitle })
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
          await db.from("ai_messages").insert({
            conversation_id: convId,
            role: "user",
            content: lastUserMessage.content,
          });
        }
      } catch (logErr) {
        console.warn("[AI Audit Log Error]:", logErr);
      }
    }

    // 7. Khởi tạo Stream Text với Tool Calling đa bước
    const result = streamText({
      model: getChatModel(effectiveModel),
      system: systemPrompt,
      messages: optimizedMessages,
      tools,
      maxSteps: 5,
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

          if (latestConv?.id && text) {
            await db.from("ai_messages").insert({
              conversation_id: latestConv.id,
              role: "assistant",
              content: text,
              tool_calls: toolCalls || null,
              tool_results: toolResults || null,
            });
          }
        } catch (saveErr) {
          console.warn("[AI Assistant Message Save Error]:", saveErr);
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Đã xảy ra lỗi khi xử lý câu hỏi với AI Copilot.";
    console.error("[AI Chat API Error]:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
