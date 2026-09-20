/**
 * Dify Client & Provider Adapter for Minh Tan Phat Supply ERP.
 * Hỗ trợ:
 * 1. Stream Chat Messages (SSE to Vercel AI SDK DataStream protocol)
 * 2. Run Workflows (Blocking / Streaming)
 * 3. File Uploads
 * 4. User Feedback (Like / Dislike)
 * 5. Dataset Document Ingestion (RAG Knowledge Sync)
 */

import { aiEnv } from "@/lib/ai/config/env";

export interface DifyChatMessageInput {
  query: string;
  user: string;
  conversationId?: string;
  inputs?: Record<string, unknown>;
  files?: Array<{
    type: "image" | "document" | "audio" | "video" | "custom";
    transfer_method: "remote_url" | "local_file";
    url?: string;
    upload_file_id?: string;
  }>;
}

export interface DifyStreamEvent {
  event: "message" | "agent_thought" | "agent_message" | "message_end" | "message_file" | "message_replace" | "error" | "ping";
  task_id?: string;
  message_id?: string;
  conversation_id?: string;
  answer?: string;
  thought?: string;
  observation?: string;
  tool?: string;
  tool_labels_and_params?: string;
  status?: number;
  message?: string;
  metadata?: {
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      latency?: number;
    };
    retriever_resources?: Array<{
      position: number;
      dataset_id: string;
      dataset_name: string;
      document_id: string;
      document_name: string;
      segment_id: string;
      score: number;
      content: string;
    }>;
  };
}

export interface DifyWorkflowRunInput {
  inputs: Record<string, unknown>;
  user: string;
  responseMode?: "streaming" | "blocking";
  files?: Array<{
    type: string;
    transfer_method: string;
    url?: string;
    upload_file_id?: string;
  }>;
}

export class DifyClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = (baseUrl || aiEnv.difyBaseUrl || "http://127.0.0.1:5001/v1").replace(/\/+$/, "");
    this.apiKey = apiKey || aiEnv.difyApiKey || "";
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.baseUrl);
  }

  private getHeaders(customApiKey?: string): HeadersInit {
    return {
      "Authorization": `Bearer ${customApiKey || this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Gọi Chat API dạng Streaming (Server-Sent Events)
   */
  async streamChat(input: DifyChatMessageInput): Promise<Response> {
    if (!this.apiKey) {
      throw new Error("Dify API Key chưa được cấu hình (DIFY_API_KEY).");
    }

    const response = await fetch(`${this.baseUrl}/chat-messages`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        inputs: input.inputs || {},
        query: input.query,
        response_mode: "streaming",
        conversation_id: input.conversationId || "",
        user: input.user,
        files: input.files || [],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Dify Chat API Error [${response.status}]: ${errorText || response.statusText}`);
    }

    return response;
  }

  /**
   * Chuyển đổi SSE stream từ Dify thành Vercel AI SDK DataStream Response
   */
  createDataStreamResponse(
    difyResponse: Response,
    options?: {
      onFinish?: (fullText: string, metadata?: Record<string, any>) => Promise<void> | void;
    }
  ): Response {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let accumulatedText = "";
    let lastMetadata: Record<string, any> | undefined;

    const stream = new ReadableStream({
      async start(controller) {
        if (!difyResponse.body) {
          controller.close();
          return;
        }

        const reader = difyResponse.body.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data:")) continue;

              const jsonStr = trimmed.substring(5).trim();
              if (!jsonStr) continue;

              try {
                const event: DifyStreamEvent = JSON.parse(jsonStr);

                if (event.event === "message" || event.event === "agent_message") {
                  const textPart = event.answer || "";
                  if (textPart) {
                    accumulatedText += textPart;
                    // Vercel AI SDK DataStream Protocol part: 0:text

                    controller.enqueue(encoder.encode(`0:${JSON.stringify(textPart)}\n`));
                  }
                } else if (event.event === "agent_thought" && event.thought) {
                  // Gửi thought như text formatting nhẹ
                  const thoughtText = `${event.thought}\n`;
                  accumulatedText += thoughtText;
                  controller.enqueue(encoder.encode(`0:${JSON.stringify(thoughtText)}\n`));
                } else if (event.event === "message_end") {
                  lastMetadata = event.metadata;
                  // Finish chunk protocol: d:{"finishReason":"stop",...}

                  controller.enqueue(encoder.encode(`d:{"finishReason":"stop"}\n`));
                } else if (event.event === "error") {
                  const errorMsg = event.message || "Dify execution error";
                  controller.enqueue(encoder.encode(`3:${JSON.stringify(errorMsg)}\n`));
                }
              } catch {
                // Ignore parse errors on partial frames
              }
            }
          }

          if (options?.onFinish) {
            try {
              await options.onFinish(accumulatedText, lastMetadata);
            } catch (finishErr) {
              console.warn("[Dify onFinish Error]:", finishErr);
            }
          }

          controller.close();
        } catch (err: any) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
      },
    });
  }

  /**
   * Chạy Workflow Dify (Chế độ blocking trả về JSON kết quả)
   */
  async runWorkflow(input: DifyWorkflowRunInput): Promise<any> {
    if (!this.apiKey) {
      throw new Error("Dify API Key chưa được cấu hình.");
    }

    const response = await fetch(`${this.baseUrl}/workflows/run`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        inputs: input.inputs,
        response_mode: input.responseMode || "blocking",
        user: input.user,
        files: input.files || [],
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      throw new Error(`Dify Workflow Error [${response.status}]: ${err || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Gửi phản hồi đánh giá tin nhắn (Like / Dislike)
   */
  async sendFeedback(messageId: string, rating: "like" | "dislike" | null, user: string, content?: string): Promise<boolean> {
    if (!this.apiKey) return false;

    const response = await fetch(`${this.baseUrl}/messages/${messageId}/feedbacks`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        rating,
        user,
        content: content || "",
      }),
    });

    return response.ok;
  }

  /**
   * Nạp tài liệu văn bản trực tiếp vào Dataset Dify (Knowledge Ingestion)
   */
  async createDocumentByText(params: {
    datasetId: string;
    name: string;
    text: string;
    datasetApiKey?: string;
    indexingTechnique?: "high_quality" | "economy";
  }): Promise<{ document: { id: string; name: string }; batch: string }> {
    const key = params.datasetApiKey || this.apiKey;
    const response = await fetch(`${this.baseUrl}/datasets/${params.datasetId}/document/create-by-text`, {
      method: "POST",
      headers: this.getHeaders(key),
      body: JSON.stringify({
        name: params.name,
        text: params.text,
        indexing_technique: params.indexingTechnique || "high_quality",
        process_rule: {
          mode: "automatic",
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      throw new Error(`Dify Dataset Ingestion Error [${response.status}]: ${err || response.statusText}`);
    }

    return await response.json();
  }
}

export const difyClient = new DifyClient();
