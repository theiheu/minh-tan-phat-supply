import { aiEnv } from "../config/env";
import type { Message } from "ai";

/**
 * Tối ưu hoá lịch sử tin nhắn: Chỉ giữ lại N tin nhắn gần nhất để tiết kiệm token.
 */
export function optimizeMessageHistory(messages: Message[]): Message[] {
  const maxHistory = aiEnv.maxHistoryMessages;
  if (!messages || messages.length <= maxHistory) {
    return messages;
  }

  return messages.slice(-maxHistory);
}

/**
 * Cắt tỉa kết quả tool output nếu quá lớn để bảo vệ context window.
 */
export function trimToolOutput<T>(output: T[], maxItems = 8): T[] {
  if (Array.isArray(output)) {
    return output.slice(0, maxItems);
  }
  return output;
}
