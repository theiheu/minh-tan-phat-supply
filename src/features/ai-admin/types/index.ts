export interface ConversationSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_role: string;
  user_avatar?: string;
  message_count: number;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: unknown;
  tool_results?: unknown;
  created_at: string;
}

export interface QuickPromptItem {
  id: string;
  label: string;
  prompt: string;
  icon: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface KnowledgeDocItem {
  id: string;
  source_key: string;
  title: string;
  category: string;
  content_hash: string;
  chunk_count: number;
  updated_at: string;
}

export interface KnowledgeChunkItem {
  id: string;
  chunk_index: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface StandardizedKnowledgeDraft {
  title: string;
  category: "sop" | "user_guide" | "catalog" | "policy" | "general";
  summary: string;
  content: string;
  keywords?: string[];
}
