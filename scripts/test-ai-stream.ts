import fs from "fs";
import path from "path";

// Đọc .env.local
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  for (const line of fs.readFileSync(envLocalPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

import { streamText } from "ai";
import { getChatModel } from "../src/lib/ai/providers/omniroute";
import { buildSystemPrompt } from "../src/lib/ai/orchestrator/system-prompt";
import { getRegisteredTools } from "../src/lib/ai/registry";
import { KNOWLEDGE_STANDARDIZER_SYSTEM_PROMPT } from "../src/lib/ai/knowledge/standardizer";

async function testCopilotChat() {
  console.log("=== 1. Testing Copilot Chat Stream ===");
  const userContext = { userId: "test-user-id", userName: "Admin", role: "manager" as const };
  const systemPrompt = buildSystemPrompt(userContext);
  const tools = getRegisteredTools(userContext);

  try {
    const result = streamText({
      model: getChatModel(),
      system: systemPrompt,
      messages: [{ role: "user", content: "Xin chào AI Copilot, bạn có thể tra cứu tồn kho động cơ không?" }],
      tools,
      maxSteps: 3,
      maxTokens: 500,
    });

    let fullText = "";
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }
    console.log("Copilot response:", fullText);
  } catch (err) {
    console.error("Copilot Error:", err);
  }
}

async function testIngestChat() {
  console.log("\n=== 2. Testing Ingest Chat Stream ===");
  try {
    const result = streamText({
      model: getChatModel(),
      system: KNOWLEDGE_STANDARDIZER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: "Chuẩn hóa quy trình: Khi quạt chuồng hỏng, báo cơ điện trong 15p." }],
      temperature: 0.2,
    });

    let fullText = "";
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }
    console.log("Ingest response:\n", fullText);
  } catch (err) {
    console.error("Ingest Error:", err);
  }
}

async function run() {
  await testCopilotChat();
  await testIngestChat();
}

run();
