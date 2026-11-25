import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const VILMA_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export type AIProvider = "anthropic" | "gemini";
/** Anthropic tem prioridade; sem ela, usa o Gemini (gratuito); sem nenhum, a Vilma básica (sem IA). */
export function aiProvider(): AIProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}
export const isAIConfigured = () => aiProvider() !== null;

let client: Anthropic | null = null;
export function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 90_000 });
  return client;
}
