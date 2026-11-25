import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";

// localStorage mínimo para o cliente local (banco em memória com o mesmo esquema do Supabase)
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;
process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");

import { buildDesired, buildAlarms, stripPrefix, syncGoogleTasks, type SyncData } from "@/lib/google/tasks-sync";
import { createLocalClient } from "@/lib/local/client";
import { encrypt } from "@/lib/crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const TODAY = "2026-11-25"; // quarta-feira
const empty: SyncData = { tasks: [], habits: [], habitLogs: [], assessments: [], courses: [], stages: [], projects: [], chores: [], maintenance: [] };

describe("Google Tasks: o que vai para o Google", () => {
  it("tarefas de todas as áreas, com prefixo, horário nas notas e prazo", () => {
    const d = buildDesired({ ...empty, tasks: [
      { id: "1", title: "Relatório", description: null, area: "trabalho", due_date: "2026-11-26", due_time: "14:30:00", deadline: "2026-11-28", status: "pendente", reminder_minutes: 10 },
      { id: "2", title: "Mercado", description: "leite", area: "pessoal", due_date: null, due_time: null, deadline: null, status: "concluida", reminder_minutes: null },
      { id: "3", title: "Cancelada", description: null, area: "estudos", due_date: TODAY, due_time: null, deadline: null, status: "cancelada", reminder_minutes: null },
    ] }, TODAY);
    expect(d.map((x) => x.title)).toEqual(["💼 Relatório", "Mercado"]);
    expect(d[0].due).toBe("2026-11-26");
    expect(d[0].notes).toContain("⏰ 14:30");
    expect(d[0].notes).toContain("Prazo final: 28/11/2026");
    expect(d[1].completed).toBe(true);
  });
  it("hábitos só no dia agendado; concluído pelo registro do dia; 'largar' não vai", () => {
    const habits: SyncData["habits"] = [
      { id: "h1", name: "Beber água", kind: "construir", frequency: { type: "daily" }, target_value: 8, started_on: "2026-01-01", time_of_day: "08:00:00", reminder: true, archived: false, unit: "copos" },
      { id: "h2", name: "Inglês", kind: "construir", frequency: { type: "weekdays", days: [1, 5] }, target_value: 1, started_on: "2026-01-01", time_of_day: null, reminder: false, archived: false, unit: "vez" },
      { id: "h3", name: "Fumar", kind: "largar", frequency: { type: "daily" }, target_value: 1, started_on: "2026-01-01", time_of_day: null, reminder: false, archived: false, unit: "vez" },
    ];
    const d = buildDesired({ ...empty, habits, habitLogs: [{ habit_id: "h1", log_date: TODAY, value: 8, completed: false }] }, TODAY);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ source: "habit", occurrence: TODAY, title: "🔁 Beber água", completed: true });
    expect(d[0].notes).toContain("Meta: 8 copos");
  });
  it("provas, etapas, rotinas e manutenções", () => {
    const d = buildDesired({ ...empty,
      assessments: [{ id: "a", title: "Cálculo", type: "prova", due_date: "2026-12-01", done: false, course_id: "c" }],
      courses: [{ id: "c", name: "Engenharia" }],
      stages: [{ id: "s", title: "Protótipo", due_date: "2026-12-02", done: false, project_id: "p" }],
      projects: [{ id: "p", name: "App" }],
      chores: [{ id: "ch", title: "Limpar banheiro", frequency: "semanal", next_due_on: null }],
      maintenance: [{ id: "m", title: "Filtro do ar", next_due_on: "2027-01-10" }, { id: "m2", title: "Sem data", next_due_on: null }],
    }, TODAY);
    expect(d.map((x) => x.title)).toEqual(["📚 Prova: Cálculo", "💼 Etapa: Protótipo", "🏠 Limpar banheiro", "🔧 Filtro do ar"]);
    expect(d[2].due).toBe(TODAY);
  });
  it("alarmes só para itens com horário, de hoje em diante e não concluídos", () => {
    const a = buildAlarms({ ...empty,
      tasks: [
        { id: "1", title: "Dentista", description: null, area: "pessoal", due_date: TODAY, due_time: "15:00:00", deadline: null, status: "pendente", reminder_minutes: 30 },
        { id: "2", title: "Ontem", description: null, area: "pessoal", due_date: "2026-11-24", due_time: "15:00:00", deadline: null, status: "pendente", reminder_minutes: null },
        { id: "3", title: "Sem hora", description: null, area: "pessoal", due_date: TODAY, due_time: null, deadline: null, status: "pendente", reminder_minutes: null },
      ],
      habits: [{ id: "h", name: "Remédio", kind: "construir", frequency: { type: "daily" }, target_value: 1, started_on: "2026-01-01", time_of_day: "21:00:00", reminder: true, archived: false, unit: "vez" }],
    }, TODAY);
    expect(a.map((x) => [x.title, x.time, x.minutesBefore])).toEqual([["Dentista", "15:00", 30], ["🔁 Remédio", "21:00", 0]]);
  });
  it("remove prefixos ao trazer títulos do Google", () => {
    expect(stripPrefix("💼 Relatório")).toBe("Relatório");
    expect(stripPrefix("📚 Prova: Cálculo")).toBe("Cálculo");
    expect(stripPrefix("Mercado")).toBe("Mercado");
  });
});

// ------------------------------------------------------------------ Google falso
class FakeGoogle {
  lists: { id: string; title: string }[] = [];
  tasks = new Map<string, { id: string; title: string; notes?: string; status: string; due?: string; updated: string; deleted?: boolean; listId: string }>();
  events = new Map<string, Record<string, unknown> & { id: string; updated: string }>();
  clock = Date.now();
  seq = 0;
  calls: string[] = [];
  tick() { this.clock += 1000; return new Date(this.clock).toISOString(); }
  fetch = async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    this.calls.push(`${method} ${url.pathname}`);
    const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } });
    const p = url.pathname;
    let m: RegExpMatchArray | null;
    if (p.endsWith("/users/@me/lists") && method === "GET") return json({ items: this.lists });
    if (p.endsWith("/users/@me/lists") && method === "POST") { const l = { id: `list${++this.seq}`, title: body.title }; this.lists.push(l); return json(l); }
    if ((m = p.match(/\/users\/@me\/lists\/([^/]+)$/))) return this.lists.some((l) => l.id === decodeURIComponent(m![1])) ? json({}) : json({}, 404);
    if ((m = p.match(/\/lists\/([^/]+)\/tasks$/)) && method === "GET") {
      const since = url.searchParams.get("updatedMin");
      return json({ items: [...this.tasks.values()].filter((t) => t.listId === decodeURIComponent(m![1]) && (!since || t.updated >= since)) });
    }
    if ((m = p.match(/\/lists\/([^/]+)\/tasks$/)) && method === "POST") { const t = { ...body, id: `t${++this.seq}`, updated: this.tick(), listId: decodeURIComponent(m[1]) }; this.tasks.set(t.id, t); return json(t); }
    if ((m = p.match(/\/lists\/[^/]+\/tasks\/([^/]+)$/))) {
      const t = this.tasks.get(decodeURIComponent(m[1]));
      if (!t) return json({}, 404);
      if (method === "PATCH") { Object.assign(t, body, { updated: this.tick() }); return json(t); }
      if (method === "DELETE") { this.tasks.delete(t.id); return new Response(null, { status: 204 }); }
    }
    if (p.endsWith("/events") && method === "POST") { const e = { ...body, id: `e${++this.seq}`, updated: this.tick() }; this.events.set(e.id, e); return json(e); }
    if ((m = p.match(/\/events\/([^/]+)$/))) {
      const e = this.events.get(decodeURIComponent(m[1]));
      if (!e) return json({}, 404);
      if (method === "PATCH") { Object.assign(e, body, { updated: this.tick() }); return json(e); }
      if (method === "DELETE") { this.events.delete(e.id); return new Response(null, { status: 204 }); }
    }
    return json({ error: `rota não simulada: ${method} ${p}` }, 500);
  };
  /** a usuária mexe direto no app do Google */
  userEdits(id: string, patch: Record<string, unknown>) { Object.assign(this.tasks.get(id)!, patch, { updated: this.tick() }); }
}

describe("Google Tasks: sincronização nos dois sentidos", () => {
  let sb: SupabaseClient;
  let uid: string;
  let g: FakeGoogle;
  const sync = (alarms = true) => syncGoogleTasks(sb, uid, "America/Sao_Paulo", TODAY, { alarms, fetchImpl: g.fetch as typeof fetch });
  const byTitle = (title: string) => [...g.tasks.values()].find((t) => t.title === title);

  beforeAll(async () => {
    sb = createLocalClient() as unknown as SupabaseClient;
    const { data } = await sb.auth.signUp({ email: "ana@teste.com", password: "senha-forte-123" });
    uid = data.user!.id;
  });
  beforeEach(async () => {
    g = new FakeGoogle();
    for (const t of ["google_links", "tasks", "habits", "habit_logs", "integrations", "chores"]) await sb.from(t).delete().eq("user_id", uid);
    await sb.from("integrations").insert({ user_id: uid, provider: "google_calendar", access_token_enc: encrypt("tok"), refresh_token_enc: encrypt("ref"), token_expires_at: new Date(Date.now() + 3600_000).toISOString(), scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks" });
  });

  it("cria a lista 'Vilma', envia tarefas/hábitos e cria alarme para item com horário", async () => {
    await sb.from("tasks").insert([
      { user_id: uid, title: "Relatório", area: "trabalho", due_date: "2026-11-26", due_time: "14:30" },
      { user_id: uid, title: "Mercado", area: "pessoal" },
    ]);
    await sb.from("habits").insert({ user_id: uid, name: "Ler 10 páginas", started_on: "2026-01-01" });
    const r = await sync();
    expect(g.lists.map((l) => l.title)).toEqual(["Vilma"]);
    expect(r.exported).toBe(3);
    expect(byTitle("💼 Relatório")?.due).toBe("2026-11-26T00:00:00.000Z");
    expect(byTitle("🔁 Ler 10 páginas")?.due).toBe(`${TODAY}T00:00:00.000Z`);
    expect(r.alarms).toBe(1);
    const alarm = [...g.events.values()][0] as { summary: string; start: { dateTime: string }; extendedProperties: { private: Record<string, string> } };
    expect(alarm.summary).toBe("⏰ 💼 Relatório");
    expect(alarm.start.dateTime).toBe("2026-11-26T17:30:00.000Z"); // 14:30 em São Paulo
    expect(alarm.extendedProperties.private.vilma_alarm).toBe("1");
    // segunda sincronização sem mudanças: nenhuma escrita no Google
    g.calls = [];
    const again = await sync();
    expect(again.exported + again.alarms).toBe(0);
    expect(g.calls.filter((c) => !c.startsWith("GET"))).toEqual([]);
  });

  it("concluir no Google conclui no app (tarefa e hábito do dia)", async () => {
    await sb.from("tasks").insert({ user_id: uid, title: "Pagar luz", area: "casa", due_date: TODAY });
    await sb.from("habits").insert({ user_id: uid, name: "Meditar", started_on: "2026-01-01", target_value: 1 });
    await sync();
    g.userEdits(byTitle("🏠 Pagar luz")!.id, { status: "completed" });
    g.userEdits(byTitle("🔁 Meditar")!.id, { status: "completed" });
    const r = await sync();
    expect(r.completedFromGoogle).toBe(2);
    const { data: t } = await sb.from("tasks").select("status,completed_at").eq("title", "Pagar luz").single();
    expect(t!.status).toBe("concluida");
    const { data: logs } = await sb.from("habit_logs").select("log_date,completed").eq("user_id", uid);
    expect(logs).toEqual([expect.objectContaining({ log_date: TODAY, completed: true })]);
  });

  it("concluir no app conclui no Google e remove o alarme", async () => {
    const { data: t } = await sb.from("tasks").insert({ user_id: uid, title: "Dentista", area: "pessoal", due_date: TODAY, due_time: "16:00" }).select("id").single();
    await sync();
    expect(g.events.size).toBe(1);
    await sb.from("tasks").update({ status: "concluida", completed_at: new Date().toISOString() }).eq("id", t!.id);
    await sync();
    expect(byTitle("Dentista")?.status).toBe("completed");
    expect(g.events.size).toBe(0);
  });

  it("tarefa criada direto na lista Vilma do Google entra no app; editar título/data no Google altera no app", async () => {
    await sync(); // cria a lista
    const listId = g.lists[0].id;
    const created = { id: "gx", title: "Comprar presente", status: "needsAction", due: "2026-11-30T00:00:00.000Z", updated: g.tick(), listId };
    g.tasks.set(created.id, created);
    const r = await sync();
    expect(r.imported).toBe(1);
    const { data: t } = await sb.from("tasks").select("id,title,due_date,area").eq("title", "Comprar presente").single();
    expect(t).toMatchObject({ due_date: "2026-11-30", area: "pessoal" });
    g.userEdits("gx", { title: "Comprar presente da mãe", due: "2026-12-01T00:00:00.000Z" });
    await sync();
    const { data: t2 } = await sb.from("tasks").select("title,due_date").eq("id", t!.id).single();
    expect(t2).toEqual({ title: "Comprar presente da mãe", due_date: "2026-12-01" });
  });

  it("apagar no Google não apaga no app (e não recria); apagar no app remove do Google", async () => {
    const { data: a } = await sb.from("tasks").insert({ user_id: uid, title: "Fica no app", area: "pessoal" }).select("id").single();
    const { data: b } = await sb.from("tasks").insert({ user_id: uid, title: "Sai do Google", area: "pessoal" }).select("id").single();
    await sync();
    g.userEdits(byTitle("Fica no app")!.id, { deleted: true });
    await sb.from("tasks").delete().eq("id", b!.id);
    await sync();
    const { data: still } = await sb.from("tasks").select("id").eq("id", a!.id);
    expect(still).toHaveLength(1);
    expect(byTitle("Sai do Google")).toBeUndefined();
    await sync();
    expect([...g.tasks.values()].filter((t) => t.title === "Fica no app" && !t.deleted)).toHaveLength(0);
  });

  it("rotina da casa concluída no Google avança a próxima data no app", async () => {
    const { data: c } = await sb.from("chores").insert({ user_id: uid, title: "Trocar lençóis", frequency: "semanal", next_due_on: TODAY }).select("id").single();
    await sync();
    g.userEdits(byTitle("🏠 Trocar lençóis")!.id, { status: "completed" });
    await sync();
    const { data } = await sb.from("chores").select("last_done_on,next_due_on").eq("id", c!.id).single();
    expect(data).toEqual({ last_done_on: TODAY, next_due_on: "2026-12-02" });
    // a nova ocorrência já foi enviada para o Google
    expect([...g.tasks.values()].filter((t) => t.title === "🏠 Trocar lençóis").map((t) => [t.status, t.due])).toEqual([["completed", `${TODAY}T00:00:00.000Z`], ["needsAction", "2026-12-02T00:00:00.000Z"]]);
  });

  it("conta conectada sem permissão do Tasks pede para reconectar", async () => {
    await sb.from("integrations").update({ scope: "https://www.googleapis.com/auth/calendar.events" }).eq("user_id", uid);
    const r = await sync();
    expect(r.needsReconnect).toBe(true);
    expect(g.calls).toEqual([]);
  });

  it("alarmes desligados: remove os que existiam", async () => {
    await sb.from("tasks").insert({ user_id: uid, title: "Reunião", area: "trabalho", due_date: TODAY, due_time: "18:00" });
    await sync(true);
    expect(g.events.size).toBe(1);
    await sync(false);
    expect(g.events.size).toBe(0);
  });
});
