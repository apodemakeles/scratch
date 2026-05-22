import { Anthropic } from "@anthropic-ai/sdk";

export const anthropicClient = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL,
  apiKey: process.env.ANTHROPIC_API_KEY,
});
