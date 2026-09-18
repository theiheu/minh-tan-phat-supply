import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanSearchQuery } from "./query-cleaner";

interface StockSummaryRow {
  product_name: string;
  category_name: string;
  attributes: Record<string, unknown>;
  unit: string;
  total_stock: number | string;
  min_stock: number;
  location_details: string;
  variant_id?: string;
  product_id?: string;
}

export const inventoryTools = {
  get_stock_balance: tool({
    description: "Tra cứu tồn kho thực tế của sản phẩm/vật tư theo từ khóa tên vật tư (ví dụ: 'động cơ', 'van bi', 'bạc đạn', 'bạt che'). Trả về số lượng tồn ở từng kho và cảnh báo min_stock.",
    parameters: z.object({
      searchTerm: z.string().optional().describe("Từ khóa tên vật tư cốt lõi (1-3 từ, ví dụ: 'động cơ', 'van bi', 'bạc đạn')."),
      query: z.string().optional().describe("Từ khóa tra cứu thay thế"),
      keyword: z.string().optional().describe("Từ khóa tìm kiếm"),
      limit: z.number().optional().default(10).describe("Số lượng kết quả tối đa cần lấy"),
    }).passthrough(),
    execute: async (rawArgs: { searchTerm?: string; query?: string; keyword?: string; search?: string; product_name?: string; productName?: string; reason?: string; limit?: number }) => {
      try {
        const rawQuery = rawArgs.searchTerm || rawArgs.query || rawArgs.keyword || rawArgs.search || rawArgs.product_name || rawArgs.productName || rawArgs.reason || "";
        const cleaned = cleanSearchQuery(rawQuery);
        const limit = typeof rawArgs.limit === "number" ? rawArgs.limit : 10;

        const supabase = createAdminClient();
        const rpcClient = supabase as unknown as {
          rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: StockSummaryRow[] | null; error: Error | null }>;
        };

        let rows: StockSummaryRow[] = [];

        if (!cleaned) {
          const { data, error } = await rpcClient.rpc("ai_get_stock_summary", {
            p_query: null,
            p_limit: limit,
          });
          if (error) return { error: error.message };
          rows = data || [];
        } else {
          // Tách các từ khóa khi có từ nối ("và", "&", "với", "hoặc", "kèm", ",")
          const subTerms = cleaned
            .split(/\s+(?:và|&|với|hoặc|kèm)\s+|,\s*/i)
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

          if (subTerms.length <= 1) {
            const { data, error } = await rpcClient.rpc("ai_get_stock_summary", {
              p_query: cleaned,
              p_limit: limit,
            });
            if (error) return { error: error.message };
            rows = data || [];
          } else {
            const perTermLimit = Math.max(3, Math.ceil(limit / subTerms.length));
            const promises = subTerms.map((term) =>
              rpcClient.rpc("ai_get_stock_summary", { p_query: term, p_limit: perTermLimit })
            );
            const results = await Promise.all(promises);
            const seenVariantIds = new Set<string>();

            for (const res of results) {
              if (res.data && Array.isArray(res.data)) {
                for (const row of res.data) {
                  const key = row.variant_id || `${row.product_name}_${row.unit}`;
                  if (!seenVariantIds.has(key)) {
                    seenVariantIds.add(key);
                    rows.push(row);
                  }
                }
              }
            }
          }
        }

        return rows.slice(0, limit).map((row) => ({
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
    description: "Tìm kiếm thông tin danh mục vật tư trong trường hợp cần kiểm tra mô tả kỹ thuật, mã SKU hoặc xem vật tư có tồn tại trong hệ thống danh mục hay không.",
    parameters: z.object({
      query: z.string().optional().describe("Từ khóa tìm kiếm trong danh mục sản phẩm"),
      searchTerm: z.string().optional().describe("Từ khóa thay thế"),
    }).passthrough(),
    execute: async (rawArgs: { query?: string; searchTerm?: string; search?: string; keyword?: string; name?: string; reason?: string }) => {
      try {
        const rawQuery = rawArgs.query || rawArgs.searchTerm || rawArgs.search || rawArgs.keyword || rawArgs.name || rawArgs.reason || "";
        const cleaned = cleanSearchQuery(rawQuery);
        const supabase = createAdminClient();
        let matchedProductIds: string[] | null = null;

        if (cleaned) {
          const rpcClient = supabase as unknown as {
            rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: { id: string }[] | null; error: Error | null }>;
          };
          const { data: matchIds, error: rpcErr } = await rpcClient.rpc("search_catalog", { p_query: cleaned });
          if (!rpcErr && matchIds) {
            matchedProductIds = matchIds.map((r) => r.id);
            if (matchedProductIds.length === 0) {
              return [];
            }
          }
        }

        let q = supabase
          .from("products")
          .select("id, name, description, categories(name), variants(id, min_stock, sku_code)")
          .is("deleted_at", null)
          .limit(10);

        if (matchedProductIds) {
          q = q.in("id", matchedProductIds);
        }

        const { data, error } = await q;

        if (error) {
          return { error: error.message };
        }

        const prods = data || [];
        if (matchedProductIds) {
          const rankMap = new Map(matchedProductIds.map((id, idx) => [id, idx]));
          prods.sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));
        }

        return prods.map((p) => ({
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
      limit: z.number().optional().default(8).describe("Số lượng cảnh báo tối đa cần lấy"),
    }).passthrough(),
    execute: async (rawArgs: { limit?: number }) => {
      try {
        const limit = typeof rawArgs.limit === "number" ? rawArgs.limit : 8;
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
          .slice(0, limit)
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
