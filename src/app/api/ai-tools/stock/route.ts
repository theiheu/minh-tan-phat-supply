import { NextRequest, NextResponse } from "next/server";
import { verifyToolsAuth } from "@/lib/ai/tools-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanSearchQuery } from "@/lib/ai/registry/tools/query-cleaner";

export async function GET(req: NextRequest) {
  if (!verifyToolsAuth(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing X-MTP-AI-SECRET header." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const rawQuery = searchParams.get("query") || searchParams.get("searchTerm") || searchParams.get("keyword") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

  try {
    const cleaned = cleanSearchQuery(rawQuery);
    const supabase = createAdminClient();
    const rpcClient = supabase as unknown as {
      rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: any[] | null; error: Error | null }>;
    };

    let rows: any[] = [];

    if (!cleaned) {
      const { data, error } = await rpcClient.rpc("ai_get_stock_summary", {
        p_query: null,
        p_limit: limit,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      rows = data || [];
    } else {
      const subTerms = cleaned
        .split(/\s+(?:và|&|với|hoặc|kèm)\s+|,\s*/i)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      if (subTerms.length <= 1) {
        const { data, error } = await rpcClient.rpc("ai_get_stock_summary", {
          p_query: cleaned,
          p_limit: limit,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
              const key = row.sku_id || `${row.product_name}_${row.unit}`;
              if (!seenVariantIds.has(key)) {
                seenVariantIds.add(key);
                rows.push(row);
              }
            }
          }
        }
      }
    }

    const items = rows.map((r) => {
      const totalStock = Number(r.total_stock || 0);
      const minStock = Number(r.min_stock || 0);
      let status = "Đủ tồn";
      if (totalStock === 0) status = "Hết hàng";
      else if (totalStock <= minStock) status = "Tồn kho thấp";

      return {
        product_name: r.product_name,
        category: r.category_name,
        unit: r.unit,
        total_stock: totalStock,
        min_stock: minStock,
        status,
        locations: r.location_details || "Chưa có vị trí cụ thể",
        attributes: r.attributes || {},
      };
    });

    return NextResponse.json({
      success: true,
      query: rawQuery,
      total_found: items.length,
      items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
