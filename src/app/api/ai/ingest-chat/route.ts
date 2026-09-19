import { streamText, Message } from "ai";
import { getChatModel } from "@/lib/ai/providers/omniroute";
import { KNOWLEDGE_STANDARDIZER_SYSTEM_PROMPT } from "@/lib/ai/knowledge/standardizer";
import { createClient } from "@/lib/supabase/server";
import { isSuperuser } from "@/lib/types";
import { z } from "zod";

export const maxDuration = 60;

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system", "tool", "data"]),
    content: z.string().max(50000, "Nội dung tin nhắn quá dài"),
    id: z.string().optional(),
    name: z.string().optional(),
    tool_calls: z.any().optional(),
    tool_call_id: z.any().optional(),
    annotations: z.any().optional(),
    data: z.any().optional()
  })).max(50, "Lịch sử tin nhắn vượt quá giới hạn")
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Yêu cầu đăng nhập để sử dụng tính năng nạp tri thức." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Kiểm tra quyền Quản trị hệ thống (superuser)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !isSuperuser(profile.role)) {
      return new Response(JSON.stringify({ error: "Chỉ Quản trị viên (Superuser) mới có quyền nạp tri thức AI." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Định dạng dữ liệu không hợp lệ: " + parsed.error.issues[0]?.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages = parsed.data.messages as Message[];
    const model = getChatModel();

    const result = streamText({
      model,
      system: KNOWLEDGE_STANDARDIZER_SYSTEM_PROMPT,
      messages,
      temperature: 0.2, // Nhiệt độ thấp giúp chuẩn hóa logic, chuẩn xác cấu trúc
    });

    return result.toDataStreamResponse({
      getErrorMessage: (err) => err instanceof Error ? err.message : String(err),
    });
  } catch (err) {
    console.error("AI Ingest Chat API Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Lỗi xử lý yêu cầu nạp tri thức." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
