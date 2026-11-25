import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { isGoogleConfigured, syncGoogle } from "@/lib/google/calendar";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const { supabase: sb, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autenticada." }, { status: 401 });
  if (!isGoogleConfigured()) return NextResponse.json({ error: "Integração com Google não configurada no servidor." }, { status: 503 });
  const { data: allowed } = await sb.rpc("consume_rate_limit", { p_bucket: "google_sync", p_max: 20, p_window_seconds: 3600 });
  if (allowed === false) return NextResponse.json({ error: "Muitas sincronizações. Aguarde um pouco." }, { status: 429 });
  const { data: profile } = await sb.from("profiles").select("timezone").eq("id", user.id).single();
  try {
    const r = await syncGoogle(getAdminSupabase(), user.id, profile?.timezone ?? "America/Sao_Paulo");
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
