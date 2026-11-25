import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { isGoogleConfigured } from "@/lib/google/calendar";
import { syncAllGoogle } from "@/lib/google/run";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const { supabase: sb, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autenticada." }, { status: 401 });
  if (!isGoogleConfigured()) return NextResponse.json({ error: "Integração com Google não configurada no servidor." }, { status: 503 });
  const { data: integ } = await sb.from("integrations").select("id").eq("provider", "google_calendar").maybeSingle();
  if (!integ) return NextResponse.json({ error: "Google não conectado." }, { status: 404 });
  const { data: allowed } = await sb.rpc("consume_rate_limit", { p_bucket: "google_sync", p_max: 90, p_window_seconds: 3600 });
  if (allowed === false) return NextResponse.json({ error: "Muitas sincronizações. Aguarde um pouco." }, { status: 429 });
  const r = await syncAllGoogle(getAdminSupabase(), user.id);
  if (r.errors.length && !r.calendar && !r.tasks) return NextResponse.json({ error: r.errors.join(" · ") }, { status: 502 });
  return NextResponse.json(r);
}
