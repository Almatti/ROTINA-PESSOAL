import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
import { toGeminiSchema, geminiFunctionDeclarations, runGemini, GeminiError } from "@/lib/vilma/gemini";
import { toolDefinitions } from "@/lib/vilma/tools";

describe("Gemini: conversão das ferramentas", () => {
  it("converte JSON Schema para o formato do Gemini", () => {
    const g = toGeminiSchema({ type: "object", additionalProperties: false, properties: { a: { type: ["string", "null"], description: "x" }, n: { type: "integer", enum: [1, 2] }, l: { type: "array", items: { type: "string", enum: ["x", "y"] } } }, required: ["a", "zz"] })!;
    expect(g.type).toBe("OBJECT");
    expect(g).not.toHaveProperty("additionalProperties");
    const p = g.properties as Record<string, Record<string, unknown>>;
    expect(p.a).toEqual({ type: "STRING", nullable: true, description: "x" });
    expect(p.n.type).toBe("INTEGER");
    expect(p.n).not.toHaveProperty("enum");
    expect((p.l.items as Record<string, unknown>).enum).toEqual(["x", "y"]);
    expect(g.required).toEqual(["a"]);
  });
  it("todas as 25 ferramentas da Vilma viram declarações válidas", () => {
    const decl = geminiFunctionDeclarations(toolDefinitions());
    expect(decl.length).toBe(toolDefinitions().length);
    const json = JSON.stringify(decl);
    for (const bad of ["additionalProperties", "\"$schema\"", "oneOf", "allOf", "\"const\""]) expect(json).not.toContain(bad);
    for (const d of decl) expect(d.name).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/);
  });
});

describe("Gemini: laço de ferramentas", () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = "teste"; });
  const reply = (parts: unknown[], finishReason = "STOP") => new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts }, finishReason }] }), { status: 200 });

  it("executa a ferramenta pedida e devolve a resposta final", async () => {
    const bodies: { contents: { role: string; parts: Record<string, unknown>[] }[] }[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return bodies.length === 1
        ? reply([{ functionCall: { id: "c1", name: "list_tasks", args: { status: "pendente" } }, thoughtSignature: "sig" }])
        : reply([{ text: "pensando", thought: true }, { text: "Você tem 1 tarefa." }]);
    });
    const calls: unknown[] = [];
    const r = await runGemini({ system: "s", history: [{ role: "user", content: "oi" }], tools: [], onToolCall: async (n, a) => { calls.push([n, a]); return [{ title: "X" }]; }, fetchImpl: fetchImpl as never });
    expect(calls).toEqual([["list_tasks", { status: "pendente" }]]);
    expect(r.reply).toBe("Você tem 1 tarefa.");
    // a assinatura de raciocínio é devolvida intacta e a resposta da ferramenta vai com o mesmo id
    const second = bodies[1].contents;
    expect(second[1].parts[0].thoughtSignature).toBe("sig");
    expect(second[2].parts[0]).toEqual({ functionResponse: { id: "c1", name: "list_tasks", response: { result: [{ title: "X" }] } } });
    expect((fetchImpl.mock.calls[0][1] as RequestInit).headers).toMatchObject({ "x-goog-api-key": "teste" });
  });

  it("limite gratuito (429) vira erro tratável", async () => {
    const fetchImpl = vi.fn(async () => new Response("quota", { status: 429 }));
    await expect(runGemini({ system: "s", history: [{ role: "user", content: "oi" }], tools: [], onToolCall: async () => null, fetchImpl: fetchImpl as never, retryDelayMs: 0 })).rejects.toMatchObject({ status: 429 });
    expect(new GeminiError(429, "x")).toBeInstanceOf(Error);
  });

  it("bloqueio de segurança é tratado como recusa", async () => {
    const fetchImpl = vi.fn(async () => reply([], "SAFETY"));
    const r = await runGemini({ system: "s", history: [{ role: "user", content: "oi" }], tools: [], onToolCall: async () => null, fetchImpl: fetchImpl as never });
    expect(r.refused).toBe(true);
  });

  it("histórico usa o papel 'model' para respostas da Vilma", async () => {
    let body: { contents: { role: string }[] } | null = null;
    const fetchImpl = vi.fn(async (_u: string, init: RequestInit) => { body = JSON.parse(String(init.body)); return reply([{ text: "ok" }]); });
    await runGemini({ system: "s", history: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" }], tools: [], onToolCall: async () => null, fetchImpl: fetchImpl as never });
    expect(body!.contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
  });

  it("Google sobrecarregado (503): tenta de novo no modelo reserva e responde", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      return urls.length === 1 ? new Response("high demand", { status: 503 }) : reply([{ text: "Feito!" }]);
    });
    const r = await runGemini({ system: "s", history: [{ role: "user", content: "oi" }], tools: [], onToolCall: async () => null, fetchImpl: fetchImpl as never, retryDelayMs: 0 });
    expect(r.reply).toBe("Feito!");
    expect(urls[0]).toContain("gemini-flash-latest");
    expect(urls[1]).toContain("gemini-flash-lite-latest");
  });

  it("modelo que não aceita 'thinkingLevel' é chamado de novo sem a opção", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return bodies.length === 1 ? new Response("Unknown name thinkingLevel", { status: 400 }) : reply([{ text: "ok" }]);
    });
    const r = await runGemini({ system: "s", history: [{ role: "user", content: "oi" }], tools: [], onToolCall: async () => null, fetchImpl: fetchImpl as never, retryDelayMs: 0 });
    expect(r.reply).toBe("ok");
    expect((bodies[0].generationConfig as Record<string, unknown>).thinkingConfig).toBeDefined();
    expect((bodies[1].generationConfig as Record<string, unknown>).thinkingConfig).toBeUndefined();
  });

  it("respeita o limite de tempo: para antes e avisa (sem deixar a tela carregando)", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => { calls++; return reply([{ functionCall: { name: "list_tasks", args: {} } }]); });
    const r = await runGemini({ system: "s", history: [{ role: "user", content: "oi" }], tools: [], onToolCall: async () => [], fetchImpl: fetchImpl as never, deadline: Date.now() + 5_000 });
    expect(r.timedOut).toBe(true);
    expect(calls).toBe(0);
  });

  it("sobrecarga persistente vira erro tratável (a tela responde no modo básico)", async () => {
    const fetchImpl = vi.fn(async () => new Response("high demand", { status: 503 }));
    await expect(runGemini({ system: "s", history: [{ role: "user", content: "oi" }], tools: [], onToolCall: async () => null, fetchImpl: fetchImpl as never, retryDelayMs: 0 })).rejects.toMatchObject({ status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
