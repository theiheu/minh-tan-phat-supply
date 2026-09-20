import { describe, it, expect, beforeEach } from "vitest";
import { DifyClient } from "./dify";

describe("Dify Client Provider", () => {
  let client: DifyClient;

  beforeEach(() => {
    client = new DifyClient("http://127.0.0.1:5001/v1", "app-test-key-123");
  });

  it("khởi tạo đúng baseUrl và apiKey", () => {
    expect(client.isConfigured).toBe(true);
  });

  it("tạo đúng ReadableStream data stream response từ SSE stream", async () => {
    const sseContent = [
      'data: {"event": "message", "answer": "Xin chào, "}\n\n',
      'data: {"event": "message", "answer": "tôi là MTP Copilot."}\n\n',
      'data: {"event": "message_end", "metadata": {"usage": {"total_tokens": 25}}}\n\n'
    ].join("");

    const mockResponse = new Response(sseContent, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });

    let finishedText = "";
    const streamRes = client.createDataStreamResponse(mockResponse, {
      onFinish: (text) => {
        finishedText = text;
      },
    });

    expect(streamRes.headers.get("Content-Type")).toContain("text/plain");
    const reader = streamRes.body?.getReader();
    const decoder = new TextDecoder();
    let streamOutput = "";

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      streamOutput += decoder.decode(value);
    }

    expect(streamOutput).toContain('0:"Xin chào, "');
    expect(streamOutput).toContain('0:"tôi là MTP Copilot."');
    expect(finishedText).toBe("Xin chào, tôi là MTP Copilot.");
  });

  it("báo lỗi khi gọi streamChat nếu thiếu apiKey", async () => {
    const unconfigured = new DifyClient("http://127.0.0.1:5001/v1", "");
    await expect(
      unconfigured.streamChat({ query: "Test", user: "u-1" })
    ).rejects.toThrow("Dify API Key chưa được cấu hình");
  });
});
