import { createOpenAI } from "@ai-sdk/openai";
import { aiEnv } from "../config/env";

export const omnirouteProvider = createOpenAI({
  baseURL: aiEnv.baseUrl,
  apiKey: aiEnv.apiKey,
  compatibility: "compatible",
});

export function getChatModel(overrideModel?: string) {
  const modelName = overrideModel || aiEnv.chatModel;
  return omnirouteProvider(modelName);
}
