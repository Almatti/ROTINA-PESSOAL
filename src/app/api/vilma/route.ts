import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getUser } from "@/lib/supabase/server";
import { anthropic, aiProvider, VILMA_MODEL } from "@/lib/vilma/client";
import { runGemini, GeminiError } from "@/lib/vilma/gemini";
import { VILMA_SYSTEM, dayContext } from "@/lib/vilma/prompt";
import { toolDefinitions, executeTool, type ToolContext } from "@/lib/vilma/tools";
import { localDateISO, localTimeHHMM, zonedParts, DEFAULT_TZ } from "@/lib/domain/dates";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({ conversationId: z.string().uuid().nullable().optional(), message: z.string().trim().min(1).max(4000) });
type BetaParam = Anthropic.Beta.Messages.BetaMessageParam;

export async function POST(req: NextRequest) {
  const { supabase: sb, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Faça login para conversar com a Vilma." }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });

  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  const provider = aiProvider();
  if (!provider) return NextResponse.json({ error: "A IA da Vilma não está ligada no servidor.", code: "not_configured" }, { status: 503 });
  // o consentimento é específico do provedor (Anthropic ou Google)
  if (!profile?.ai_consent_at || (profile.ai_consent_provider ?? "anthropic") !== provider) return NextResponse.json({ error: "Para usar a IA da Vilma, autorize a assistente em Configurações › Privacidade.", code: "consent", provider }, { status: 403 });

  const { data: allowed } = await sb.rpc("consume_rate_limit", { p_bucket: "vilma", p_max: 40, p_window_seconds: 3600 });
  if (allowed === false) return NextResponse.json({ error: "Você atingiu o limite de mensagens por hora. Tente novamente mais tarde." }, { status: 429 });

  // Conversa
  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const { data } = await sb.from("conversations").select("id").eq("id", conversationId).maybeSingle();
    if (!data) conversationId = null;
  }
  if (!conversationId) {
    const { data, error } = await sb.from("conversations").insert({ title: parsed.data.message.slice(0, 60) }).select("id").single();
    if (error) return NextResponse.json({ error: "Não foi possível iniciar a conversa." }, { status: 500 });
    conversationId = data.id;
  }
  const { data: history } = await sb.from("messages").select("role,content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(20);
  await sb.from("messages").insert({ conversation_id: conversationId, role: "user", content: parsed.data.message });

  const tz = profile.timezone || DEFAULT_TZ;
  const now = new Date();
  const today = localDateISO(now, tz);
  const ctx: ToolContext = { sb, userId: user.id, tz, today, conversationId: conversationId!, sleepGoal: profile.sleep_goal_minutes, wakeTime: profile.wake_time };

  const messages: BetaParam[] = [...(history ?? [])].reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  // Garante alternância começando por "user"
  while (messages.length && messages[0].role !== "user") messages.shift();
  const context = dayContext({ now, tz, today, hhmm: localTimeHHMM(now, tz), weekday: zonedParts(now, tz).weekday, name: profile.nickname || profile.full_name || "", goals: profile.goals ?? [], sleepGoal: profile.sleep_goal_minutes, waterGoal: profile.water_goal_ml });
  messages.push({ role: "user", content: `${context}\n\nMensagem da usuária: ${parsed.data.message}` });
  // Une mensagens consecutivas do mesmo papel (ex.: confirmações registradas pelo sistema).
  for (let i = messages.length - 1; i > 0; i--) {
    if (messages[i].role === messages[i - 1].role && typeof messages[i].content === "string" && typeof messages[i - 1].content === "string") {
      messages[i - 1] = { role: messages[i].role, content: `${messages[i - 1].content}\n\n${messages[i].content}` };
      messages.splice(i, 1);
    }
  }

  const actions: { tool: string; ok: boolean; summary?: string; error?: string }[] = [];
  const pendingList: { id: string; summary: string }[] = [];
  let reply = "";

  const runTool = async (name: string, input: unknown) => {
    const out = await executeTool(name, input, ctx);
    if (out.pendingId) pendingList.push({ id: out.pendingId, summary: out.summary ?? name });
    else if (out.summary || out.error) actions.push({ tool: name, ok: out.ok, summary: out.summary, error: out.error });
    return out;
  };
  const REFUSAL = "Desculpe, não posso ajudar com esse pedido. Posso te ajudar com sua organização de outra forma? 💜";

  if (provider === "gemini") {
    try {
      const history = messages.map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: String(m.content) }));
      const r = await runGemini({
        system: VILMA_SYSTEM,
        history,
        tools: toolDefinitions(),
        onToolCall: async (name, args) => {
          const out = await runTool(name, args);
          return out.ok ? out.data ?? { ok: true, resumo: out.summary } : { erro: out.error };
        },
      });
      reply = r.refused ? REFUSAL : r.reply || (r.truncated ? "A resposta ficou longa demais. Pode reformular de forma mais específica?" : "");
    } catch (e) {
      const status = e instanceof GeminiError ? e.status : 500;
      if (e instanceof GeminiError) console.error("gemini", status, e.message.slice(0, 200));
      if (actions.length || pendingList.length) reply = "Tive um problema para concluir a resposta, mas estas ações foram processadas:";
      else if (status === 429) return NextResponse.json({ error: "A IA gratuita atingiu o limite por agora.", code: "quota", conversationId }, { status: 429 });
      else if (status === 400 || status === 401 || status === 403) return NextResponse.json({ error: "A chave do Gemini é inválida ou não tem acesso a este modelo.", code: "provider_error", conversationId }, { status: 502 });
      else return NextResponse.json({ error: "A IA não respondeu agora.", code: "provider_error", conversationId }, { status: 502 });
    }
  } else try {
    const tools = toolDefinitions();
    for (let step = 0; step < 8; step++) {
      const res = await anthropic().beta.messages.create({
        model: VILMA_MODEL,
        max_tokens: 4096,
        system: [{ type: "text", text: VILMA_SYSTEM, cache_control: { type: "ephemeral" } }],
        tools,
        messages,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);

      if (res.stop_reason === "refusal") {
        reply = REFUSAL;
        break;
      }
      const text = res.content.filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      const toolUses = res.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use");
      if (res.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: res.content as never });
        continue;
      }
      if (res.stop_reason !== "tool_use" || !toolUses.length) {
        reply = text || (res.stop_reason === "max_tokens" ? "A resposta ficou longa demais. Pode reformular de forma mais específica?" : "");
        break;
      }
      messages.push({ role: "assistant", content: res.content as never });
      const results: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const out = await runTool(tu.name, tu.input);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out.ok ? out.data ?? { ok: true, resumo: out.summary } : { erro: out.error }), is_error: !out.ok });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : 500;
    const msg = status === 429 ? "A Vilma está com muitas solicitações agora. Tente em instantes." : status === 401 ? "A chave da API da Vilma é inválida. Verifique a configuração do servidor." : "Não consegui responder agora. Tente novamente em instantes.";
    if (actions.length || pendingList.length) reply = "Tive um problema para concluir a resposta, mas estas ações foram processadas:";
    else return NextResponse.json({ error: msg, code: status === 429 ? "quota" : "provider_error", conversationId }, { status: status === 429 ? 429 : 502 });
  }

  if (!reply) reply = actions.length ? "Pronto!" : "Não entendi muito bem. Pode me contar de outro jeito?";
  await sb.from("messages").insert({ conversation_id: conversationId, role: "assistant", content: reply.slice(0, 20000), actions: [...actions, ...pendingList.map((p) => ({ tool: "pending", pending_id: p.id, summary: p.summary }))] });
  await sb.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  // conquista "Prazer, Vilma"
  await sb.from("user_achievements").insert({ achievement_key: "vilma_conversa" }).then(() => undefined, () => undefined);

  return NextResponse.json({ conversationId, reply, actions, pending: pendingList });
}
