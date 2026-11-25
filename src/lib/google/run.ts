import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncGoogle } from "@/lib/google/calendar";
import { syncGoogleTasks, type TasksSyncResult } from "@/lib/google/tasks-sync";
import { localDateISO, DEFAULT_TZ } from "@/lib/domain/dates";

/** Agenda (compromissos) + Tasks (tarefas, hábitos, rotinas) + alarmes com horário. */
export async function syncAllGoogle(admin: SupabaseClient, userId: string) {
  const { data: p } = await admin.from("profiles").select("timezone,google_alarms").eq("id", userId).single();
  const tz = (p?.timezone as string) || DEFAULT_TZ;
  const out: { calendar?: { imported: number; exported: number }; tasks?: TasksSyncResult; errors: string[] } = { errors: [] };
  try {
    out.calendar = await syncGoogle(admin, userId, tz);
  } catch (e) {
    out.errors.push(`Agenda: ${(e as Error).message}`);
  }
  try {
    out.tasks = await syncGoogleTasks(admin, userId, tz, localDateISO(new Date(), tz), { alarms: p?.google_alarms !== false });
  } catch (e) {
    out.errors.push(`Tasks: ${(e as Error).message}`);
  }
  return out;
}
