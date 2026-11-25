import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getAdminSupabase, isAdminConfigured } from "@/lib/supabase/admin";
import { runAutomationsForUser } from "@/lib/automation/engine";
import { sendPushToUser } from "@/lib/push/send";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Chamado pelo Vercel Cron (Authorization: Bearer CRON_SECRET). Processa todas as contas com onboarding concluído. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!isAdminConfigured()) return NextResponse.json({ error: "Service role não configurada." }, { status: 503 });
  const admin = getAdminSupabase();
  let processed = 0, failed = 0, created = 0;
  for (let from = 0; ; from += 500) {
    const { data: profiles } = await admin.from("profiles").select("id,timezone,notification_prefs").eq("onboarding_completed", true).range(from, from + 499);
    if (!profiles?.length) break;
    for (const p of profiles) {
      try {
        const r = await runAutomationsForUser(admin, p, new Date(), (n) => sendPushToUser(admin, p.id, n));
        processed++;
        created += r.created;
      } catch {
        failed++;
        await admin.from("automation_runs").insert({ user_id: p.id, automation_key: "todas", status: "erro", details: {} });
      }
    }
    if (profiles.length < 500) break;
  }
  return NextResponse.json({ processed, failed, created });
}
