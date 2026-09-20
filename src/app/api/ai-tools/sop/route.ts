import { NextRequest, NextResponse } from "next/server";
import { verifyToolsAuth } from "@/lib/ai/tools-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  if (!verifyToolsAuth(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing X-MTP-AI-SECRET header." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") || searchParams.get("keyword") || "").trim();
  const category = searchParams.get("category") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "5", 10), 20);

  try {
    const supabase = createAdminClient();

    let dbQuery = supabase
      .from("ai_knowledge_documents")
      .select("id, title, category, source_key, metadata, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (category) {
      dbQuery = dbQuery.eq("category", category);
    }

    if (query) {
      dbQuery = dbQuery.ilike("title", `%${query}%`);
    }

    const { data: docs, error } = await dbQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      total_found: docs?.length || 0,
      documents: (docs || []).map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        source: d.source_key,
        metadata: d.metadata || {},
        updated_at: d.updated_at,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
