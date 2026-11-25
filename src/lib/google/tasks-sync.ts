import "server-only";
/**
 * Google Tasks + alarmes no Google Agenda.
 *
 * Para o Google Tasks (lista "Vilma") vão: tarefas (pessoal, trabalho, estudos, casa),
 * hábitos do dia, provas/trabalhos de estudo, etapas de projeto, rotinas de casa e manutenções.
 *
 * Sincronização bidirecional:
 *  - Concluir no Google conclui no app (tarefa, hábito do dia, prova, etapa, rotina).
 *  - Editar título/data de uma tarefa no Google altera no app (se o app não mudou depois).
 *  - Tarefa criada direto na lista "Vilma" do Google entra no app.
 *  - Apagar no Google não apaga nada no app: o item só deixa de ser enviado.
 *  - Apagar no app remove do Google.
 *
 * A API do Google Tasks guarda só a DATA (sem horário). Por isso, itens com horário
 * ganham também um "alarme" no Google Agenda (evento curto com aviso), marcado para
 * não ser importado de volta como compromisso.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { accessToken, CALENDAR_API, TASKS_SCOPE, type Integration } from "@/lib/google/calendar";
import { addDays, formatDateBR, zonedToUtc } from "@/lib/domain/dates";
import { isCompleted, isScheduledOn, type HabitFrequency } from "@/lib/domain/habits";

const TASKS_API = process.env.GOOGLE_TASKS_API_BASE || "https://tasks.googleapis.com/tasks/v1";
export const VILMA_LIST_TITLE = "Vilma";
const CHORE_DAYS: Record<string, number> = { diaria: 1, semanal: 7, quinzenal: 15, mensal: 30, unica: 0 };
const AREA_PREFIX: Record<string, string> = { pessoal: "", trabalho: "💼 ", estudos: "📚 ", casa: "🏠 " };
const PREFIX_RE = /^(?:💼|📚|🏠|🔁|🔧)\s*(?:(?:Prova|Trabalho|Revisão|Aula|Etapa):\s*)?/u;

export type LinkSource = "task" | "habit" | "assessment" | "stage" | "chore" | "maintenance";

export interface DesiredItem {
  source: LinkSource;
  sourceId: string;
  occurrence: string;
  title: string;
  notes: string;
  due: string | null;
  completed: boolean;
}
export interface DesiredAlarm {
  source: "task" | "habit";
  sourceId: string;
  occurrence: string;
  title: string;
  date: string;
  time: string;
  minutesBefore: number;
}

export interface SyncData {
  tasks: { id: string; title: string; description: string | null; area: string; due_date: string | null; due_time: string | null; deadline: string | null; status: string; reminder_minutes: number | null }[];
  habits: { id: string; name: string; kind: string; frequency: HabitFrequency; target_value: number | string; started_on: string; time_of_day: string | null; reminder: boolean; archived: boolean; unit: string }[];
  habitLogs: { habit_id: string; log_date: string; value: number | string; completed: boolean }[];
  assessments: { id: string; title: string; type: string; due_date: string | null; done: boolean; course_id: string | null }[];
  courses: { id: string; name: string }[];
  stages: { id: string; title: string; due_date: string | null; done: boolean; project_id: string }[];
  projects: { id: string; name: string }[];
  chores: { id: string; title: string; frequency: string; next_due_on: string | null }[];
  maintenance: { id: string; title: string; next_due_on: string | null }[];
}

const ASSESSMENT_LABEL: Record<string, string> = { prova: "Prova", trabalho: "Trabalho", revisao: "Revisão", aula: "Aula" };
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

/** O que deve existir no Google Tasks agora (função pura). */
export function buildDesired(d: SyncData, today: string): DesiredItem[] {
  const out: DesiredItem[] = [];
  for (const t of d.tasks) {
    if (t.status === "cancelada") continue;
    const notes = [t.description?.trim(), t.due_time ? `⏰ ${hhmm(t.due_time)}` : null, t.deadline && t.deadline !== t.due_date ? `Prazo final: ${formatDateBR(t.deadline)}` : null].filter(Boolean).join("\n");
    out.push({ source: "task", sourceId: t.id, occurrence: "", title: `${AREA_PREFIX[t.area] ?? ""}${t.title}`, notes, due: t.due_date ?? t.deadline, completed: t.status === "concluida" });
  }
  for (const h of d.habits) {
    if (h.archived || h.kind === "largar") continue;
    const habit = { id: h.id, frequency: h.frequency, target_value: h.target_value, started_on: h.started_on };
    if (!isScheduledOn(habit, today)) continue;
    const log = d.habitLogs.find((l) => l.habit_id === h.id && l.log_date === today);
    const target = Number(h.target_value);
    const notes = [target > 1 ? `Meta: ${target} ${h.unit}` : null, h.time_of_day ? `⏰ ${hhmm(h.time_of_day)}` : null].filter(Boolean).join("\n");
    out.push({ source: "habit", sourceId: h.id, occurrence: today, title: `🔁 ${h.name}`, notes, due: today, completed: isCompleted(habit, log) });
  }
  for (const a of d.assessments) {
    if (!a.due_date) continue;
    const course = d.courses.find((c) => c.id === a.course_id)?.name;
    out.push({ source: "assessment", sourceId: a.id, occurrence: "", title: `📚 ${ASSESSMENT_LABEL[a.type] ?? "Estudo"}: ${a.title}`, notes: course ? `Curso: ${course}` : "", due: a.due_date, completed: a.done });
  }
  for (const s of d.stages) {
    if (!s.due_date) continue;
    const project = d.projects.find((p) => p.id === s.project_id)?.name;
    out.push({ source: "stage", sourceId: s.id, occurrence: "", title: `💼 Etapa: ${s.title}`, notes: project ? `Projeto: ${project}` : "", due: s.due_date, completed: s.done });
  }
  for (const c of d.chores) {
    const due = c.next_due_on ?? today;
    out.push({ source: "chore", sourceId: c.id, occurrence: due, title: `🏠 ${c.title}`, notes: "", due, completed: false });
  }
  for (const m of d.maintenance) {
    if (!m.next_due_on) continue;
    out.push({ source: "maintenance", sourceId: m.id, occurrence: m.next_due_on, title: `🔧 ${m.title}`, notes: "Manutenção da casa", due: m.next_due_on, completed: false });
  }
  for (const i of out) {
    i.title = i.title.slice(0, 1024);
    i.notes = [i.notes, "— criado pela Vilma"].filter(Boolean).join("\n").slice(0, 8000);
  }
  return out;
}

/** Itens com horário que ganham alarme no Google Agenda (hoje em diante, não concluídos). */
export function buildAlarms(d: SyncData, today: string): DesiredAlarm[] {
  const out: DesiredAlarm[] = [];
  for (const t of d.tasks) {
    if (!t.due_date || !t.due_time || t.due_date < today || t.status === "concluida" || t.status === "cancelada") continue;
    out.push({ source: "task", sourceId: t.id, occurrence: "", title: `${AREA_PREFIX[t.area] ?? ""}${t.title}`, date: t.due_date, time: hhmm(t.due_time)!, minutesBefore: t.reminder_minutes ?? 0 });
  }
  for (const h of d.habits) {
    if (h.archived || h.kind === "largar" || !h.reminder || !h.time_of_day) continue;
    const habit = { id: h.id, frequency: h.frequency, target_value: h.target_value, started_on: h.started_on };
    if (!isScheduledOn(habit, today)) continue;
    if (isCompleted(habit, d.habitLogs.find((l) => l.habit_id === h.id && l.log_date === today))) continue;
    out.push({ source: "habit", sourceId: h.id, occurrence: today, title: `🔁 ${h.name}`, date: today, time: hhmm(h.time_of_day)!, minutesBefore: 0 });
  }
  return out;
}

export const hashOf = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 32);
const keyOf = (target: string, source: string, sourceId: string, occurrence: string) => `${target}|${source}|${sourceId}|${occurrence}`;
export const stripPrefix = (title: string) => title.replace(PREFIX_RE, "").trim();

interface Link { id: string; target: "tasks" | "calendar"; source: LinkSource; source_id: string; occurrence: string; remote_id: string; remote_updated_at: string | null; pushed_hash: string | null; dismissed: boolean; synced_at: string }
interface GTask { id: string; title?: string; notes?: string; status?: "needsAction" | "completed"; due?: string; updated: string; deleted?: boolean; hidden?: boolean; completed?: string }

export interface TasksSyncResult { imported: number; exported: number; completedFromGoogle: number; alarms: number; needsReconnect?: boolean }

async function loadData(admin: SupabaseClient, userId: string, today: string): Promise<SyncData> {
  const since = addDays(today, -7);
  const q = <T,>(p: PromiseLike<{ data: T[] | null }>) => p.then((r) => r.data ?? []);
  const [tasks, habits, habitLogs, assessments, courses, stages, projects, chores, maintenance] = await Promise.all([
    q(admin.from("tasks").select("id,title,description,area,due_date,due_time,deadline,status,reminder_minutes,completed_at").eq("user_id", userId).limit(3000)),
    q(admin.from("habits").select("id,name,kind,frequency,target_value,started_on,time_of_day,reminder,archived,unit").eq("user_id", userId)),
    q(admin.from("habit_logs").select("habit_id,log_date,value,completed").eq("user_id", userId).gte("log_date", since)),
    q(admin.from("assessments").select("id,title,type,due_date,done,course_id").eq("user_id", userId)),
    q(admin.from("courses").select("id,name").eq("user_id", userId)),
    q(admin.from("project_stages").select("id,title,due_date,done,project_id").eq("user_id", userId)),
    q(admin.from("projects").select("id,name").eq("user_id", userId)),
    q(admin.from("chores").select("id,title,frequency,next_due_on").eq("user_id", userId)),
    q(admin.from("maintenance_items").select("id,title,next_due_on").eq("user_id", userId)),
  ]);
  // tarefas concluídas há mais de 7 dias não precisam mais ir ao Google
  const recentTasks = (tasks as (SyncData["tasks"][number] & { completed_at: string | null })[]).filter((t) => t.status !== "concluida" || !t.completed_at || t.completed_at.slice(0, 10) >= since);
  return { tasks: recentTasks, habits, habitLogs, assessments, courses, stages, projects, chores, maintenance } as SyncData;
}

/** Sincroniza Google Tasks (e alarmes no Agenda) de uma usuária. Usa service_role, sempre com filtro por user_id. */
export async function syncGoogleTasks(admin: SupabaseClient, userId: string, tz: string, today: string, opts: { alarms?: boolean; fetchImpl?: typeof fetch } = {}): Promise<TasksSyncResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const { data: integ } = await admin.from("integrations").select("*").eq("user_id", userId).eq("provider", "google_calendar").maybeSingle();
  if (!integ) throw new Error("Google não conectado.");
  const integration = integ as Integration;
  if (integration.scope && !integration.scope.includes(TASKS_SCOPE)) return { imported: 0, exported: 0, completedFromGoogle: 0, alarms: 0, needsReconnect: true };

  const token = await accessToken(admin, integration);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const call = async (url: string, init: RequestInit = {}) => {
    let res = await doFetch(url, { ...init, headers });
    if (res.status === 429 || res.status === 503) {
      await new Promise((r) => setTimeout(r, 1200));
      res = await doFetch(url, { ...init, headers });
    }
    return res;
  };
  const startedAt = new Date().toISOString();
  const result: TasksSyncResult = { imported: 0, exported: 0, completedFromGoogle: 0, alarms: 0 };

  // ---------- lista "Vilma" ----------
  let listId = integration.tasks_list_id;
  if (listId) {
    const r = await call(`${TASKS_API}/users/@me/lists/${encodeURIComponent(listId)}`);
    if (r.status === 404) listId = null;
  }
  if (!listId) {
    const r = await call(`${TASKS_API}/users/@me/lists?maxResults=100`);
    if (!r.ok) throw new Error(`Google Tasks respondeu ${r.status} ao listar listas.`);
    const found = ((await r.json()) as { items?: { id: string; title: string }[] }).items?.find((l) => l.title === VILMA_LIST_TITLE);
    if (found) listId = found.id;
    else {
      const c = await call(`${TASKS_API}/users/@me/lists`, { method: "POST", body: JSON.stringify({ title: VILMA_LIST_TITLE }) });
      if (!c.ok) throw new Error(`Google Tasks respondeu ${c.status} ao criar a lista.`);
      listId = ((await c.json()) as { id: string }).id;
    }
    // lista nova: vínculos antigos não valem mais
    await admin.from("google_links").delete().eq("user_id", userId).eq("target", "tasks");
    await admin.from("integrations").update({ tasks_list_id: listId, tasks_synced_at: null }).eq("id", integration.id).eq("user_id", userId);
    integration.tasks_synced_at = null;
  }
  const L = encodeURIComponent(listId);

  const loadLinks = async () => ((await admin.from("google_links").select("*").eq("user_id", userId)).data ?? []) as Link[];
  let links = await loadLinks();

  // ---------- 1. Receber do Google ----------
  const lastSync = integration.tasks_synced_at ? new Date(new Date(integration.tasks_synced_at).getTime() - 5 * 60_000).toISOString() : null;
  const remote: GTask[] = [];
  let pageToken: string | undefined;
  do {
    const p = new URLSearchParams({ showCompleted: "true", showHidden: "true", showDeleted: "true", maxResults: "100" });
    if (lastSync) p.set("updatedMin", lastSync);
    if (pageToken) p.set("pageToken", pageToken);
    const r = await call(`${TASKS_API}/lists/${L}/tasks?${p}`);
    if (!r.ok) throw new Error(`Google Tasks respondeu ${r.status} ao listar tarefas.`);
    const j = (await r.json()) as { items?: GTask[]; nextPageToken?: string };
    remote.push(...(j.items ?? []));
    pageToken = j.nextPageToken;
  } while (pageToken && remote.length < 3000);

  const taskLinks = new Map(links.filter((l) => l.target === "tasks").map((l) => [l.remote_id, l]));
  const { data: localTasks } = await admin.from("tasks").select("id,title,status,updated_at,due_date").eq("user_id", userId).limit(5000);
  const taskById = new Map((localTasks ?? []).map((t) => [t.id as string, t]));

  for (const g of remote) {
    const link = taskLinks.get(g.id);
    if (!link) {
      // criada direto na lista "Vilma" do Google → entra no app como tarefa pessoal
      if (g.deleted || g.status === "completed" || !g.title?.trim()) continue;
      const { data: created } = await admin.from("tasks").insert({ user_id: userId, title: stripPrefix(g.title).slice(0, 200) || "Tarefa", description: g.notes?.slice(0, 5000) ?? null, due_date: g.due?.slice(0, 10) ?? null, area: "pessoal" }).select("id").single();
      if (created) {
        await admin.from("google_links").insert({ user_id: userId, target: "tasks", source: "task", source_id: created.id, occurrence: "", remote_id: g.id, remote_updated_at: g.updated });
        result.imported++;
      }
      continue;
    }
    if (link.remote_updated_at && new Date(g.updated) <= new Date(link.remote_updated_at)) continue; // nada novo desde a nossa última escrita
    if (g.deleted) {
      // apagado no Google: o app não apaga nada, só para de enviar este item
      await admin.from("google_links").update({ dismissed: true, remote_updated_at: g.updated }).eq("id", link.id).eq("user_id", userId);
      continue;
    }
    if (g.status === "completed") {
      if (await completeLocal(admin, userId, link, today)) result.completedFromGoogle++;
    } else if (link.source === "task") {
      const t = taskById.get(link.source_id);
      if (t) {
        const localChangedAfter = new Date(t.updated_at as string) > new Date(link.synced_at);
        const patch: Record<string, unknown> = {};
        if (t.status === "concluida" && !localChangedAfter) Object.assign(patch, { status: "pendente", completed_at: null });
        if (!localChangedAfter && g.title && stripPrefix(g.title) && stripPrefix(g.title) !== t.title) patch.title = stripPrefix(g.title).slice(0, 200);
        const gDue = g.due?.slice(0, 10) ?? null;
        if (!localChangedAfter && gDue !== (t.due_date ?? null)) patch.due_date = gDue;
        if (Object.keys(patch).length) {
          await admin.from("tasks").update(patch).eq("id", t.id).eq("user_id", userId);
          result.imported++;
        }
      }
    }
    await admin.from("google_links").update({ remote_updated_at: g.updated, pushed_hash: null, synced_at: new Date().toISOString() }).eq("id", link.id).eq("user_id", userId);
  }

  // ---------- 2. Enviar para o Google ----------
  const data = await loadData(admin, userId, today);
  const desired = buildDesired(data, today);
  links = await loadLinks();
  const byKey = new Map(links.map((l) => [keyOf(l.target, l.source, l.source_id, l.occurrence), l]));
  const desiredKeys = new Set<string>();
  let budget = 150;

  for (const item of desired) {
    const key = keyOf("tasks", item.source, item.sourceId, item.occurrence);
    desiredKeys.add(key);
    const link = byKey.get(key);
    if (link?.dismissed) continue;
    const body = { title: item.title, notes: item.notes, due: item.due ? `${item.due}T00:00:00.000Z` : null, status: item.completed ? "completed" : "needsAction", ...(item.completed ? {} : { completed: null }) };
    const h = hashOf(body);
    if (link && link.pushed_hash === h) continue;
    if (!link && item.completed) continue; // não cria item já concluído
    if (budget-- <= 0) break;
    const res = link
      ? await call(`${TASKS_API}/lists/${L}/tasks/${encodeURIComponent(link.remote_id)}`, { method: "PATCH", body: JSON.stringify(body) })
      : await call(`${TASKS_API}/lists/${L}/tasks`, { method: "POST", body: JSON.stringify(body) });
    if (res.status === 404 && link) {
      await admin.from("google_links").delete().eq("id", link.id).eq("user_id", userId);
      continue;
    }
    if (!res.ok) continue;
    const g = (await res.json()) as GTask;
    const row = { remote_id: g.id, remote_updated_at: g.updated, pushed_hash: h, synced_at: new Date().toISOString() };
    if (link) await admin.from("google_links").update(row).eq("id", link.id).eq("user_id", userId);
    else await admin.from("google_links").insert({ user_id: userId, target: "tasks", source: item.source, source_id: item.sourceId, occurrence: item.occurrence, ...row });
    result.exported++;
  }

  // itens que não existem mais (ou mudaram de ocorrência)
  const existing = await existingSourceIds(admin, userId);
  for (const l of links) {
    if (l.target !== "tasks" || desiredKeys.has(keyOf(l.target, l.source, l.source_id, l.occurrence))) continue;
    const alive = existing[l.source].has(l.source_id);
    if (l.source === "habit" && alive) continue; // hábitos de dias anteriores ficam como histórico
    if (l.source === "task" && alive) continue; // concluída há muito tempo: nada a fazer
    if (!l.dismissed) {
      if (alive) {
        // rotina/manutenção concluída no app: a ocorrência antiga vira concluída no Google
        await call(`${TASKS_API}/lists/${L}/tasks/${encodeURIComponent(l.remote_id)}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
      } else {
        await call(`${TASKS_API}/lists/${L}/tasks/${encodeURIComponent(l.remote_id)}`, { method: "DELETE" });
      }
      result.exported++;
    }
    await admin.from("google_links").delete().eq("id", l.id).eq("user_id", userId);
  }

  // ---------- 3. Alarmes com horário no Google Agenda ----------
  if (opts.alarms !== false) {
    const cal = encodeURIComponent(integration.calendar_id || "primary");
    const alarms = buildAlarms(data, today);
    const alarmKeys = new Set<string>();
    for (const a of alarms) {
      const key = keyOf("calendar", a.source, a.sourceId, a.occurrence);
      alarmKeys.add(key);
      const link = byKey.get(key);
      const start = zonedToUtc(a.date, a.time, tz);
      const body = {
        summary: `⏰ ${a.title}`,
        description: "Lembrete criado pela Vilma.",
        start: { dateTime: start.toISOString(), timeZone: tz },
        end: { dateTime: new Date(start.getTime() + 15 * 60_000).toISOString(), timeZone: tz },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: Math.min(a.minutesBefore, 40320) }] },
        transparency: "transparent",
        extendedProperties: { private: { vilma_alarm: "1", vilma_source: a.source, vilma_id: a.sourceId } },
      };
      const h = hashOf(body);
      if (link && link.pushed_hash === h) continue;
      if (budget-- <= 0) break;
      const res = link
        ? await call(`${CALENDAR_API}/calendars/${cal}/events/${encodeURIComponent(link.remote_id)}`, { method: "PATCH", body: JSON.stringify(body) })
        : await call(`${CALENDAR_API}/calendars/${cal}/events`, { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) continue;
      const g = (await res.json()) as { id: string; updated: string };
      const row = { remote_id: g.id, remote_updated_at: g.updated, pushed_hash: h, synced_at: new Date().toISOString() };
      if (link) await admin.from("google_links").update(row).eq("id", link.id).eq("user_id", userId);
      else await admin.from("google_links").insert({ user_id: userId, target: "calendar", source: a.source, source_id: a.sourceId, occurrence: a.occurrence, ...row });
      result.alarms++;
    }
    for (const l of links) {
      if (l.target !== "calendar" || alarmKeys.has(keyOf(l.target, l.source, l.source_id, l.occurrence))) continue;
      // alarme que não vale mais (concluído, apagado, horário mudou para o passado): remove do Agenda
      const r = await call(`${CALENDAR_API}/calendars/${cal}/events/${encodeURIComponent(l.remote_id)}`, { method: "DELETE" });
      if (r.ok || r.status === 404 || r.status === 410) await admin.from("google_links").delete().eq("id", l.id).eq("user_id", userId);
    }
  } else {
    // alarmes desligados: remove os que existirem
    const cal = encodeURIComponent(integration.calendar_id || "primary");
    for (const l of links.filter((x) => x.target === "calendar")) {
      const r = await call(`${CALENDAR_API}/calendars/${cal}/events/${encodeURIComponent(l.remote_id)}`, { method: "DELETE" });
      if (r.ok || r.status === 404 || r.status === 410) await admin.from("google_links").delete().eq("id", l.id).eq("user_id", userId);
    }
  }

  await admin.from("integrations").update({ tasks_synced_at: startedAt }).eq("id", integration.id).eq("user_id", userId);
  return result;
}

async function existingSourceIds(admin: SupabaseClient, userId: string): Promise<Record<LinkSource, Set<string>>> {
  const ids = async (table: string) => {
    const { data } = await admin.from(table).select("id").eq("user_id", userId).limit(10000);
    return new Set((data ?? []).map((r) => r.id as string));
  };
  const [task, habit, assessment, stage, chore, maintenance] = await Promise.all([ids("tasks"), ids("habits"), ids("assessments"), ids("project_stages"), ids("chores"), ids("maintenance_items")]);
  // tarefas canceladas e hábitos arquivados contam como removidos do Google
  const { data: cancelled } = await admin.from("tasks").select("id").eq("user_id", userId).eq("status", "cancelada");
  for (const r of cancelled ?? []) task.delete(r.id as string);
  const { data: archived } = await admin.from("habits").select("id").eq("user_id", userId).eq("archived", true);
  for (const r of archived ?? []) habit.delete(r.id as string);
  return { task, habit, assessment, stage, chore, maintenance };
}

/** Conclusão vinda do Google → conclui o item correspondente no app. */
async function completeLocal(admin: SupabaseClient, userId: string, link: Link, today: string): Promise<boolean> {
  const now = new Date().toISOString();
  switch (link.source) {
    case "task": {
      const { data } = await admin.from("tasks").update({ status: "concluida", completed_at: now }).eq("id", link.source_id).eq("user_id", userId).neq("status", "concluida").select("id");
      return !!data?.length;
    }
    case "habit": {
      const { data: h } = await admin.from("habits").select("target_value").eq("id", link.source_id).eq("user_id", userId).maybeSingle();
      if (!h) return false;
      const { error } = await admin.from("habit_logs").upsert({ user_id: userId, habit_id: link.source_id, log_date: link.occurrence || today, value: h.target_value, completed: true }, { onConflict: "habit_id,log_date" });
      return !error;
    }
    case "assessment": {
      const { data } = await admin.from("assessments").update({ done: true }).eq("id", link.source_id).eq("user_id", userId).eq("done", false).select("id");
      return !!data?.length;
    }
    case "stage": {
      const { data } = await admin.from("project_stages").update({ done: true }).eq("id", link.source_id).eq("user_id", userId).eq("done", false).select("id");
      return !!data?.length;
    }
    case "chore": {
      const { data: c } = await admin.from("chores").select("frequency,next_due_on").eq("id", link.source_id).eq("user_id", userId).maybeSingle();
      if (!c || (c.next_due_on && c.next_due_on !== link.occurrence)) return false; // já avançou no app
      const days = CHORE_DAYS[c.frequency as string] ?? 0;
      if (!days) await admin.from("chores").delete().eq("id", link.source_id).eq("user_id", userId);
      else await admin.from("chores").update({ last_done_on: today, next_due_on: addDays(today, days) }).eq("id", link.source_id).eq("user_id", userId);
      return true;
    }
    case "maintenance": {
      const { data } = await admin.from("maintenance_items").update({ last_done_on: today, next_due_on: null }).eq("id", link.source_id).eq("user_id", userId).select("id");
      return !!data?.length;
    }
  }
}
