import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

interface StockSummaryRow {
  product_name: string;
  category_name: string;
  attributes: Record<string, unknown>;
  unit: string;
  total_stock: number | string;
  min_stock: number;
  location_details: string;
}

export const inventoryTools = {
  get_stock_balance: tool({
    description: "Tra cứu tồn kho thực tế của sản phẩm/vật tư theo tên hoặc từ khóa tìm kiếm (kèm chi tiết từng kho).",
    parameters: z.object({
      searchTerm: z.string().optional().default("").describe("Tên vật tư hoặc từ khóa (ví dụ: bạt che, bóng sưởi, động cơ điện, van bi)"),
      limit: z.number().optional().default(6).describe("Số lượng kết quả tối đa cần lấy"),
    }),
    execute: async ({ searchTerm = "", limit = 6 }: { searchTerm?: string; limit?: number }) => {
      try {
        const supabase = createAdminClient();
        const rpcClient = supabase as unknown as {
          rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: StockSummaryRow[] | null; error: Error | null }>;
        };

        const { data, error } = await rpcClient.rpc("ai_get_stock_summary", {
          p_query: searchTerm.trim() || null,
          p_limit: limit || 6,
        });

        if (error) {
          return { error: error.message };
        }

        return (data || []).map((row) => ({
          productName: row.product_name,
          category: row.category_name,
          attributes: row.attributes,
          unit: row.unit,
          totalStock: Number(row.total_stock),
          minStock: row.min_stock,
          locations: row.location_details,
          isLowStock: Number(row.total_stock) <= row.min_stock,
        }));
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Lỗi tra cứu tồn kho" };
      }
    },
  }),

  search_catalog: tool({
    description: "Tìm kiếm thông tin danh mục vật tư, mô tả kỹ thuật và thuộc tính quy cách đóng gói.",
    parameters: z.object({
      query: z.string().optional().default("").describe("Từ khóa tìm kiếm trong danh mục sản phẩm"),
    }),
    execute: async ({ query = "" }: { query?: string }) => {
      try {
        const supabase = createAdminClient();
        let q = supabase
          .from("products")
          .select("id, name, description, categories(name), variants(id, attributes, unit, min_stock)")
          .is("deleted_at", null)
          .limit(5);

        if (query.trim()) {
          q = q.ilike("name", `%${query.trim()}%`);
        }

        const { data, error } = await q;

        if (error) {
          return { error: error.message };
        }

        return (data || []).map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          category: (p.categories as unknown as { name: string })?.name || "Chưa phân loại",
          variantsCount: p.variants?.length || 0,
        }));
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Lỗi tìm kiếm danh mục" };
      }
    },
  }),

  get_low_stock_alerts: tool({
    description: "Quét danh sách các vật tư đang cạn kiệt hoặc dưới mức tồn kho tối thiểu (min_stock) để cảnh báo nhập hàng.",
    parameters: z.object({
      limit: z.number().optional().default(8),
    }),
    execute: async ({ limit = 8 }: { limit?: number }) => {
      try {
        const supabase = createAdminClient();
        const rpcClient = supabase as unknown as {
          rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: StockSummaryRow[] | null; error: Error | null }>;
        };

        const { data, error } = await rpcClient.rpc("ai_get_stock_summary", {
          p_query: null,
          p_limit: 30,
        });

        if (error) {
          return { error: error.message };
        }

        const lowStockItems = (data || [])
          .filter((row) => Number(row.total_stock) <= row.min_stock && row.min_stock > 0)
          .slice(0, limit || 8)
          .map((row) => ({
            productName: row.product_name,
            category: row.category_name,
            unit: row.unit,
            currentStock: Number(row.total_stock),
            minStockThreshold: row.min_stock,
            locations: row.location_details,
          }));

        return {
          totalAlerts: lowStockItems.length,
          items: lowStockItems,
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Lỗi quét cảnh báo tồn kho" };
      }
    },
  }),
};
