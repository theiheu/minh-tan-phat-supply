/**
 * Cấu hình biến môi trường cho AI & RAG Engine.
 * Hỗ trợ các provider: "omniroute" | "dify" | "openai".
 */
export const aiEnv = {
  provider: (process.env.AI_PROVIDER || "omniroute") as "omniroute" | "dify" | "openai",
  baseUrl: process.env.AI_BASE_URL || "http://127.0.0.1:20128/v1",
  apiKey: process.env.AI_API_KEY || "sk-4f9d738f24849b17-b2082b-5e7ca7d6",
  chatModel: process.env.AI_MODEL_CHAT || "auto/fast",
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || "1500", 10),
  maxHistoryMessages: parseInt(process.env.AI_MAX_HISTORY_MESSAGES || "6", 10),

  // Cấu hình kết nối Dify Platform (Self-hosted hoặc Dify Cloud)
  difyBaseUrl: process.env.DIFY_API_BASE_URL || "http://127.0.0.1:8101/v1",
  difyApiKey: process.env.DIFY_API_KEY || "",
  difyDatasetApiKey: process.env.DIFY_DATASET_API_KEY || process.env.DIFY_API_KEY || "",
  difyDatasetId: process.env.DIFY_DATASET_ID || "",
  difyToolsSecret: process.env.DIFY_TOOLS_SECRET || "mtp-dify-secret-2026",
};