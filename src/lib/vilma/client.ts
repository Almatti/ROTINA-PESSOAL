import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const VILMA_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
export const isAIConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
export function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 90_000 });
  return client;
}
