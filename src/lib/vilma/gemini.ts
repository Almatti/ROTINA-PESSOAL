import "server-only";
/**
 * Provedor gratuito da Vilma: Google Gemini (API REST generateContent).
 * Usa as mesmas ferramentas validadas da Vilma (tools.ts); só traduz o formato.
 */

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
/** Modelo reserva (mais leve e com menos fila) quando o principal está sobrecarregado. */
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest";
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

export interface GeminiRunResult { reply: string; refused?: boolean; truncated?: boolean; timedOut?: boolean }

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
  /** Instante (ms) em que precisamos parar para responder a tempo. */
  deadline?: number;
  retryDelayMs?: number;
}): Promise<GeminiRunResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError(503, "GEMINI_API_KEY ausente");
  const doFetch = opts.fetchImpl ?? fetch;
  const contents: Content[] = opts.history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const declarations = geminiFunctionDeclarations(opts.tools);

  const deadline = opts.deadline ?? Date.now() + 100_000;
  const retryDelay = opts.retryDelayMs ?? 1500;
  let useThinkingLow = true;

  /** Uma chamada ao Gemini com novas tentativas: sobrecarga (503/429/500) troca para o modelo reserva. */
  const generate = async (): Promise<Response> => {
    const models = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL, GEMINI_FALLBACK_MODEL];
    let last: Response | null = null;
    for (let attempt = 0; attempt < models.length; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 6_000) break;
      const model = models[attempt];
      const generationConfig: Json = { maxOutputTokens: 8192 };
      // respostas mais rápidas: raciocínio curto (só nos modelos que aceitam a opção)
      if (useThinkingLow && !/2\.[05]/.test(model)) generationConfig.thinkingConfig = { thinkingLevel: "low" };
      const res = await doFetch(ENDPOINT(model), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents,
          tools: [{ functionDeclarations: declarations }],
          toolConfig: { functionCallingConfig: { mode: "AUTO" } },
          generationConfig,
        }),
        signal: AbortSignal.timeout(Math.min(35_000, remaining - 3_000)),
      }).catch((e: unknown) => {
        // tempo esgotado nesta chamada: trata como sobrecarga e tenta o reserva
        if ((e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError") return new Response("timeout", { status: 504 });
        throw e;
      });
      if (res.ok) return res;
      const body = await res.clone().text().catch(() => "");
      if (res.status === 400 && useThinkingLow && /thinking/i.test(body)) {
        useThinkingLow = false; // modelo não aceita a opção: tenta de novo sem ela
        attempt--;
        continue;
      }
      last = res;
      if (![429, 500, 503, 504].includes(res.status)) break;
      if (attempt < models.length - 1) await new Promise((r) => setTimeout(r, retryDelay));
    }
    if (!last) throw new GeminiError(504, "sem tempo para chamar a IA");
    throw new GeminiError(last.status, (await last.text().catch(() => "")).slice(0, 500));
  };

  for (let step = 0; step < (opts.maxSteps ?? 8); step++) {
    if (deadline - Date.now() < 8_000) return { reply: "", truncated: true, timedOut: true };
    const res = await generate();
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
