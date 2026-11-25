import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getAdminSupabase, isAdminConfigured } from "@/lib/supabase/admin";
import { revokeGoogle } from "@/lib/google/calendar";

export const runtime = "nodejs";

export async function POST() {
  const { supabase: sb, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autenticada." }, { status: 401 });
  if (isAdminConfigured()) await revokeGoogle(getAdminSupabase(), user.id).catch(() => undefined);
  else await sb.from("integrations").delete().eq("provider", "google_calendar");
  await sb.from("consents").insert({ kind: "google_agenda", granted: false });
  return NextResponse.json({ ok: true });
}
