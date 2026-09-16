/**
 * Cấu hình biến môi trường cho AI & RAG Engine.
 * Kết nối chuẩn OpenAI-compatible tới Omniroute local server hoặc các provider khác.
 */
export const aiEnv = {
  provider: process.env.AI_PROVIDER || "omniroute",
  baseUrl: process.env.AI_BASE_URL || "http://127.0.0.1:20128/v1",
  apiKey: process.env.AI_API_KEY || "sk-4f9d738f24849b17-b2082b-5e7ca7d6",
  chatModel: process.env.AI_MODEL_CHAT || "auto/fast",
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || "1500", 10),
  maxHistoryMessages: parseInt(process.env.AI_MAX_HISTORY_MESSAGES || "6", 10),
};
