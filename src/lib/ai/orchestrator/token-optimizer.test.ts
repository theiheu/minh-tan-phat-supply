import { describe, it, expect } from "vitest";
import { optimizeMessageHistory, trimToolOutput } from "./token-optimizer";
import type { Message } from "ai";

describe("tokenOptimizer", () => {
  it("should limit message history to max allowed messages", () => {
    const messages: Message[] = Array.from({ length: 15 }, (_, i) => ({
      id: `msg-${i + 1}`,
      role: "user",
      content: `Message ${i + 1}`,
    }));

    const optimized = optimizeMessageHistory(messages);
    expect(optimized.length).toBeLessThanOrEqual(6);
    expect(optimized[optimized.length - 1].content).toBe("Message 15");
  });

  it("should trim tool outputs if too long", () => {
    const largeList = Array.from({ length: 50 }, (_, i) => ({ id: i, item: `Item ${i}` }));
    const trimmed = trimToolOutput(largeList, 5);
    expect(trimmed.length).toBe(5);
  });
});
