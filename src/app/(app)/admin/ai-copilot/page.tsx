import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { AICopilotManager } from "@/features/ai-admin/components/ai-copilot-manager";
import { requireSuperuser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface SettingRow {
  key: string;
  value: unknown;
}

interface QuickPromptRow {
  id: string;
  label: string;
  prompt: string;
  icon: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  conversation_id: string;
}

interface DocRow {
  id: string;
  source_key: string;
  title: string;
  category: string;
  content_hash: string;
  updated_at: string;
}

interface ChunkRow {
  document_id: string;
}

export default async function AdminAICopilotPage() {
  const current = await requireSuperuser();
  const supabase = createAdminClient();
  const db = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        order: (col: string, opts?: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
        } & Promise<{ data: unknown[] | null; error: unknown }>;
      } & Promise<{ data: unknown[] | null; error: unknown }>;
    };
  };

  // 1. Lấy cài đặt hệ thống
  const { data: settingsRows } = await db.from("ai_system_settings").select("*");
  const settingsMap: Record<string, unknown> = {};
  ((settingsRows as SettingRow[]) || []).forEach((row) => {
    settingsMap[row.key] = row.value;
  });

  const initialSettings = {
    ai_enabled: settingsMap["ai_enabled"] !== false,
    ai_model: typeof settingsMap["ai_model"] === "string" ? settingsMap["ai_model"] : "auto/fast",
    ai_max_tokens: typeof settingsMap["ai_max_tokens"] === "number" ? settingsMap["ai_max_tokens"] : 1500,
  };

  // 2. Lấy danh sách Quick Prompts
  const { data: prompts } = await db
    .from("ai_quick_prompts")
    .select("*")
    .order("display_order", { ascending: true });

  // 3. Lấy danh sách Phiên đàm thoại (kèm thông tin Profile và đếm tin nhắn)
  const [{ data: conversations }, { data: profiles }, { data: messagesCount }] = await Promise.all([
    db.from("ai_conversations").select("*").order("updated_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id, name, role, username"),
    db.from("ai_messages").select("conversation_id"),
  ]);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  const countMap: Record<string, number> = {};
  ((messagesCount as MessageRow[]) || []).forEach((m) => {
    countMap[m.conversation_id] = (countMap[m.conversation_id] || 0) + 1;
  });

  const formattedConversations = ((conversations as ConversationRow[]) || []).map((c) => {
    const prof = profileMap.get(c.user_id);
    return {
      id: c.id,
      user_id: c.user_id,
      title: c.title || "Cuộc trò chuyện",
      created_at: c.created_at,
      updated_at: c.updated_at,
      user_name: prof?.name || prof?.username || "Nhân viên trang trại",
      user_role: prof?.role || "requester",
      message_count: countMap[c.id] || 0,
    };
  });

  // 4. Lấy danh sách tài liệu SOP đã index
  const [{ data: docs }, { data: chunks }] = await Promise.all([
    db.from("ai_knowledge_documents").select("*").order("created_at", { ascending: false }),
    db.from("ai_knowledge_chunks").select("document_id"),
  ]);

  const chunkCountMap: Record<string, number> = {};
  ((chunks as ChunkRow[]) || []).forEach((ch) => {
    chunkCountMap[ch.document_id] = (chunkCountMap[ch.document_id] || 0) + 1;
  });

  const formattedDocs = ((docs as DocRow[]) || []).map((d) => ({
    id: d.id,
    source_key: d.source_key,
    title: d.title,
    category: d.category,
    content_hash: d.content_hash,
    chunk_count: chunkCountMap[d.id] || 0,
    updated_at: d.updated_at,
  }));

  return (
    <div className="space-y-4">
      <SubnavTabs group="admin" userRole={current.role} />
      <AICopilotManager
        initialSettings={initialSettings}
        initialQuickPrompts={(prompts as QuickPromptRow[]) || []}
        initialConversations={formattedConversations}
        initialKnowledgeDocs={formattedDocs}
      />
    </div>
  );
}
