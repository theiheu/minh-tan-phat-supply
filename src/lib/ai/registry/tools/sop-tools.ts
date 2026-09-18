import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanSearchQuery } from "./query-cleaner";

interface KnowledgeRow {
  chunk_id: string;
  document_id: string;
  title: string;
  category: string;
  content: string;
  rank: number;
}

export const sopTools = {
  search_sop_knowledge: tool({
    description: "Tra cứu quy trình chuẩn (SOP), hướng dẫn sử dụng phần mềm, quy định đổi trả, nhập xuất kho, kiểm kê.",
    parameters: z.object({
      query: z.string().optional().describe("Từ khóa hoặc câu hỏi về quy trình (ví dụ: 'quy trình đổi 1-1', 'kiểm kê', 'nhập kho')"),
      searchTerm: z.string().optional().describe("Từ khóa thay thế"),
      topic: z.string().optional().describe("Chủ đề cần tra cứu"),
    }).passthrough(),
    execute: async (rawArgs: { query?: string; searchTerm?: string; topic?: string; keyword?: string; reason?: string }) => {
      try {
        const rawQuery = rawArgs.query || rawArgs.searchTerm || rawArgs.topic || rawArgs.keyword || rawArgs.reason || "";
        const cleaned = cleanSearchQuery(rawQuery);
        const supabase = createAdminClient();
        const rpcClient = supabase as unknown as {
          rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: KnowledgeRow[] | null; error: Error | null }>;
        };

        const { data, error } = await rpcClient.rpc("search_ai_knowledge", {
          p_query: cleaned || "hướng dẫn quy trình",
          p_category: null,
          p_limit: 3,
        });

        if (error) {
          return { error: error.message };
        }

        const rows = data || [];
        if (rows.length === 0) {
          return {
            found: false,
            message: "Chưa tìm thấy hướng dẫn khớp trực tiếp trong tài liệu SOP. Hãy thử tìm kiếm cụ thể hơn.",
          };
        }

        return {
          found: true,
          results: rows.map((item) => ({
            title: item.title,
            category: item.category,
            content: item.content,
          })),
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Lỗi tra cứu SOP" };
      }
    },
  }),
};
