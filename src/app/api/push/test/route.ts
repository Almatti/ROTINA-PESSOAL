import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { isPushConfigured, sendPushToUser } from "@/lib/push/send";

export const runtime = "nodejs";

/** Envia uma notificação de teste para os dispositivos da usuária. */
export async function POST() {
  const { supabase: sb, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autenticada." }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ error: "Web Push não configurado no servidor (chaves VAPID)." }, { status: 503 });
  const { data: allowed } = await sb.rpc("consume_rate_limit", { p_bucket: "push_test", p_max: 5, p_window_seconds: 3600 });
  if (allowed === false) return NextResponse.json({ error: "Aguarde antes de testar novamente." }, { status: 429 });
  const r = await sendPushToUser(sb, user.id, { title: "Vilma 💜", body: "Notificações ativadas! Você receberá lembretes mesmo com o app fechado.", url: "/notificacoes", tag: "teste" });
  return NextResponse.json(r);
}
