import "server-only";
/**
 * Provedor gratuito da Vilma: Google Gemini (API REST generateContent).
 * Usa as mesmas ferramentas validadas da Vilma (tools.ts); só traduz o formato.
 */

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const ENDPOINT = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

export class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Json = Record<string, unknown>;
const ALLOWED = new Set(["type", "format", "description", "nullable", "enum", "properties", "required", "items", "minimum", "maximum", "minItems", "maxItems", "minLength", "maxLength", "pattern"]);

/** Converte um JSON Schema das ferramentas para o subconjunto OpenAPI aceito pelo Gemini. */
export function toGeminiSchema(schema: unknown): Json | undefined {
  if (!schema || typeof schema !== "object") return undefined;
  const s = schema as Json;
  const out: Json = {};
  let type = s.type;
  if (Array.isArray(type)) {
    const real = type.filter((t) => t !== "null");
    if (real.length !== type.length) out.nullable = true;
    type = real[0] ?? "string";
  }
  if (typeof type === "string") out.type = type.toUpperCase();
  for (const [k, v] of Object.entries(s)) {
    if (k === "type" || !ALLOWED.has(k)) continue;
    if (k === "properties" && v && typeof v === "object") {
      out.properties = Object.fromEntries(Object.entries(v as Json).map(([pk, pv]) => [pk, toGeminiSchema(pv) ?? { type: "STRING" }]));
    } else if (k === "items") {
      out.items = toGeminiSchema(v) ?? { type: "STRING" };
    } else if (k === "enum" && Array.isArray(v)) {
      // o Gemini só aceita enum em campos de texto
      if (out.type === "STRING" || out.type === undefined) out.enum = v.map(String);
      else out.description = `${(s.description as string | undefined) ?? ""} Valores possíveis: ${v.join(", ")}.`.trim();
    } else {
      out[k] = v;
    }
  }
  if (out.type === "OBJECT" && out.properties && Object.keys(out.properties as Json).length === 0) delete out.properties;
  if (Array.isArray(out.required) && out.properties) out.required = (out.required as string[]).filter((r) => r in (out.properties as Json));
  return out;
}

export interface GeminiTool { name: string; description?: string; input_schema: unknown }

export function geminiFunctionDeclarations(tools: GeminiTool[]) {
  return tools.map((t) => {
    const params = toGeminiSchema(t.input_schema);
    const hasParams = params && params.properties && Object.keys(params.properties as Json).length > 0;
    return { name: t.name, description: t.description ?? "", ...(hasParams ? { parameters: params } : {}) };
  });
}

type Part = { text?: string; thought?: boolean; functionCall?: { id?: string; name: string; args?: Json }; functionResponse?: unknown; [k: string]: unknown };
type Content = { role: "user" | "model"; parts: Part[] };

export interface GeminiRunResult { reply: string; refused?: boolean; truncated?: boolean }

/**
 * Laço de chamadas de ferramenta com o Gemini.
 * `history` vem em ordem cronológica, começando por "user".
 */
export async function runGemini(opts: {
  system: string;
  history: { role: "user" | "assistant"; content: string }[];
  tools: GeminiTool[];
  onToolCall: (name: string, args: unknown) => Promise<unknown>;
  maxSteps?: number;
  fetchImpl?: typeof fetch;
}): Promise<GeminiRunResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError(503, "GEMINI_API_KEY ausente");
  const doFetch = opts.fetchImpl ?? fetch;
  const contents: Content[] = opts.history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const declarations = geminiFunctionDeclarations(opts.tools);

  for (let step = 0; step < (opts.maxSteps ?? 8); step++) {
    const res = await doFetch(ENDPOINT(GEMINI_MODEL), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents,
        tools: [{ functionDeclarations: declarations }],
        toolConfig: { functionCallingConfig: { mode: "AUTO" } },
        generationConfig: { maxOutputTokens: 8192 },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new GeminiError(res.status, body.slice(0, 500));
    }
    const j = (await res.json()) as { candidates?: { content?: Content; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
    const cand = j.candidates?.[0];
    if (!cand) return { reply: "", refused: Boolean(j.promptFeedback?.blockReason) };
    const parts = cand.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    const text = parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("\n").trim();
    if (!calls.length) {
      if (cand.finishReason === "SAFETY" || cand.finishReason === "PROHIBITED_CONTENT" || cand.finishReason === "BLOCKLIST") return { reply: "", refused: true };
      return { reply: text, truncated: cand.finishReason === "MAX_TOKENS" };
    }
    // mantém a resposta do modelo como veio (inclui assinaturas de raciocínio exigidas pelo Gemini)
    contents.push({ role: "model", parts });
    const responses: Part[] = [];
    for (const p of calls) {
      const fc = p.functionCall!;
      const result = await opts.onToolCall(fc.name, fc.args ?? {});
      responses.push({ functionResponse: { ...(fc.id ? { id: fc.id } : {}), name: fc.name, response: { result } } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return { reply: "", truncated: true };
}
