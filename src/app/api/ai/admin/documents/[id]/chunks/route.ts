import { NextRequest } from "next/server";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireManager();
    const { id } = await params;
    const supabase = createAdminClient();
    const db = supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            order: (col: string, opts?: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: Error | null }>;
          };
        };
      };
    };

    const { data: chunks, error } = await db
      .from("ai_knowledge_chunks")
      .select("id, chunk_index, content, metadata")
      .eq("document_id", id)
      .order("chunk_index", { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ chunks: chunks || [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unauthorized" }),
      { status: 401 }
    );
  }
}
