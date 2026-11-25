import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { runAutomationsForUser } from "@/lib/automation/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Executa as automações da usuária logada (respeitando o RLS). */
export async function POST() {
  const { supabase: sb, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autenticada." }, { status: 401 });
  const { data: allowed } = await sb.rpc("consume_rate_limit", { p_bucket: "automations", p_max: 12, p_window_seconds: 3600 });
  if (allowed === false) return NextResponse.json({ error: "Aguarde um pouco antes de executar novamente." }, { status: 429 });
  const { data: profile } = await sb.from("profiles").select("id,timezone,notification_prefs").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  try {
    const r = await runAutomationsForUser(sb, profile);
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ error: "Falha ao executar automações." }, { status: 500 });
  }
}
