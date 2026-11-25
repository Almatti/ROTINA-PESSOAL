import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { executeTool } from "@/lib/vilma/tools";
import { localDateISO, DEFAULT_TZ } from "@/lib/domain/dates";

export const runtime = "nodejs";
const schema = z.object({ pendingId: z.string().uuid(), decision: z.enum(["confirmar", "cancelar"]) });

/** Executa (ou cancela) uma ação sensível previamente proposta pela Vilma. */
export async function POST(req: NextRequest) {
  const { supabase: sb, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autenticada." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });

  const { data: action } = await sb.from("pending_actions").select("*").eq("id", parsed.data.pendingId).maybeSingle();
  if (!action) return NextResponse.json({ error: "Ação não encontrada." }, { status: 404 });
  if (action.status !== "pendente") return NextResponse.json({ error: "Esta ação já foi resolvida." }, { status: 409 });
  if (new Date(action.expires_at) < new Date()) {
    await sb.from("pending_actions").update({ status: "expirada" }).eq("id", action.id);
    return NextResponse.json({ error: "A confirmação expirou. Peça novamente à Vilma." }, { status: 410 });
  }

  if (parsed.data.decision === "cancelar") {
    await sb.from("pending_actions").update({ status: "cancelada" }).eq("id", action.id);
    if (action.conversation_id) await sb.from("messages").insert({ conversation_id: action.conversation_id, role: "assistant", content: `Tudo bem, cancelei: ${action.summary}.` });
    return NextResponse.json({ ok: true, status: "cancelada" });
  }

  const { data: profile } = await sb.from("profiles").select("timezone,sleep_goal_minutes,wake_time").eq("id", user.id).single();
  const tz = profile?.timezone || DEFAULT_TZ;
  const out = await executeTool(action.tool_name, action.input, { sb, userId: user.id, tz, today: localDateISO(new Date(), tz), conversationId: action.conversation_id, sleepGoal: profile?.sleep_goal_minutes ?? 480, wakeTime: profile?.wake_time ?? null }, { confirmed: true });
  await sb.from("pending_actions").update({ status: out.ok ? "confirmada" : "falhou", result: out }).eq("id", action.id);
  if (action.conversation_id) await sb.from("messages").insert({ conversation_id: action.conversation_id, role: "assistant", content: out.ok ? `✅ Feito: ${out.summary ?? action.summary}` : `Não consegui concluir: ${out.error}` });
  return NextResponse.json({ ok: out.ok, summary: out.summary, error: out.error }, { status: out.ok ? 200 : 422 });
}
