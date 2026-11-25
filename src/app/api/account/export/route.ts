import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TABLES = [
  "consents", "categories", "projects", "project_stages", "tasks", "subtasks", "events", "habits", "habit_logs",
  "financial_accounts", "credit_cards", "recurring_transactions", "transactions", "invoices", "budgets", "goals", "goal_steps",
  "sleep_logs", "mood_logs", "cycle_periods", "cycle_symptoms", "water_logs", "workout_plans", "workout_exercises",
  "workout_sessions", "workout_sets", "time_entries", "courses", "study_sessions", "assessments", "rooms", "chores",
  "shopping_lists", "shopping_items", "household_products", "meals", "maintenance_items", "note_folders", "notes",
  "note_attachments", "focus_sessions", "notifications", "conversations", "messages", "automations", "automation_runs",
  "user_achievements", "point_events",
];

/** Portabilidade (LGPD art. 18, V): exporta todos os dados da usuária em JSON. */
export async function GET() {
  const { supabase: sb, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Não autenticada." }, { status: 401 });
  const { data: allowed } = await sb.rpc("consume_rate_limit", { p_bucket: "export", p_max: 5, p_window_seconds: 3600 });
  if (allowed === false) return NextResponse.json({ error: "Limite de exportações por hora atingido." }, { status: 429 });
  const out: Record<string, unknown> = {
    exportado_em: new Date().toISOString(),
    conta: { id: user.id, email: user.email, criada_em: user.created_at },
  };
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  out.perfil = profile;
  for (const t of TABLES) {
    const { data } = await sb.from(t).select("*").limit(50000);
    out[t] = data ?? [];
  }
  const { data: integ } = await sb.from("integrations").select("id,provider,calendar_id,status,last_synced_at,created_at");
  out.integracoes = integ ?? [];
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="vilma-meus-dados.json"`, "Cache-Control": "no-store" },
  });
}
