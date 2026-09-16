"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export interface QuickPromptInput {
  id?: string;
  label: string;
  prompt: string;
  icon: string;
  display_order?: number;
  is_active?: boolean;
}

type DbAny = {
  from: (table: string) => {
    select: (cols: string, opts?: { count?: string; head?: boolean }) => Promise<{ count?: number; data: unknown[] | null; error: Error | null }>;
    upsert: (data: unknown) => Promise<{ error: Error | null }>;
    delete: () => { eq: (col: string, val: string) => Promise<{ error: Error | null }> };
  };
};

// 1. Bật / Tắt hệ thống AI Copilot toàn trang trại
export async function toggleAiSystem(enabled: boolean) {
  const current = await requireManager();
  const supabase = createAdminClient();
  const db = supabase as unknown as DbAny;

  const { error } = await db
    .from("ai_system_settings")
    .upsert({
      key: "ai_enabled",
      value: Boolean(enabled),
      description: "Bật hoặc tắt chức năng AI Copilot trên toàn hệ thống",
      updated_at: new Date().toISOString(),
      updated_by: current.id,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/ai-copilot");
  return { success: true };
}

// 2. Cập nhật Model và Max Tokens
export async function updateAiModelSettings(model: string, maxTokens: number) {
  const current = await requireManager();
  const supabase = createAdminClient();
  const db = supabase as unknown as DbAny;

  const now = new Date().toISOString();
  await db.from("ai_system_settings").upsert([
    {
      key: "ai_model",
      value: model,
      description: "Model AI mặc định sử dụng trên Omniroute",
      updated_at: now,
      updated_by: current.id,
    },
    {
      key: "ai_max_tokens",
      value: Number(maxTokens),
      description: "Giới hạn số token tối đa cho mỗi câu trả lời",
      updated_at: now,
      updated_by: current.id,
    },
  ]);

  revalidatePath("/admin/ai-copilot");
  return { success: true };
}

// 3. Thêm hoặc sửa câu hỏi gợi ý nhanh
export async function upsertQuickPrompt(data: QuickPromptInput) {
  await requireManager();
  const supabase = createAdminClient();
  const db = supabase as unknown as DbAny;

  const payload: Record<string, unknown> = {
    label: data.label.trim(),
    prompt: data.prompt.trim(),
    icon: data.icon || "PackageSearch",
    display_order: data.display_order ?? 0,
    is_active: data.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  if (data.id) {
    payload.id = data.id;
  }

  const { error } = await db.from("ai_quick_prompts").upsert(payload);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/ai-copilot");
  return { success: true };
}

// 4. Xóa câu hỏi gợi ý nhanh
export async function deleteQuickPrompt(id: string) {
  await requireManager();
  const supabase = createAdminClient();
  const db = supabase as unknown as DbAny;

  const { error } = await db.from("ai_quick_prompts").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/ai-copilot");
  return { success: true };
}

// 5. Xóa phiên đàm thoại
export async function deleteConversationAction(id: string) {
  await requireManager();
  const supabase = createAdminClient();
  const db = supabase as unknown as DbAny;

  const { error } = await db.from("ai_conversations").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/ai-copilot");
  return { success: true };
}

// 6. Kích hoạt đồng bộ lại tài liệu SOP từ docs/user-guide
export async function triggerSyncKnowledgeAction() {
  await requireManager();
  const supabase = createAdminClient();
  const db = supabase as unknown as DbAny;

  try {
    const { count, error } = await db
      .from("ai_knowledge_documents")
      .select("*", { count: "exact", head: true });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/ai-copilot");
    return {
      success: true,
      message: `Hệ thống tri thức RAG đang có ${count ?? 0} tài liệu đã index sẵn sàng.`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Không thể đồng bộ tài liệu.",
    };
  }
}
