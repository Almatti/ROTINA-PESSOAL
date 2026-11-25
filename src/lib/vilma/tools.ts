import "server-only";
/**
 * Ferramentas da assistente Vilma.
 * - Cada ferramenta tem um esquema JSON (enviado ao modelo) e um esquema Zod
 *   (validação no servidor antes de executar).
 * - Todas executam com o cliente Supabase da própria usuária: o RLS garante
 *   que nenhuma ferramenta acesse dados de outra pessoa.
 * - Ferramentas sensíveis (exclusões e alterações em massa) NÃO executam:
 *   criam uma ação pendente que a usuária precisa confirmar na interface.
 * - Diário (textos) e ciclo menstrual nunca são lidos por estas ferramentas.
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { isoDate, hhmm, recurrenceSchema } from "@/lib/validation/entities";
import { addDays, monthStart, monthEnd, zonedToUtc, localDateISO, localTimeHHMM, startOfWeek, formatDateBR } from "@/lib/domain/dates";
import { monthSummary, totalBalance, categoryBreakdown, upcomingBills, invoiceMonthFor, buildInstallments, budgetUsage, type Tx } from "@/lib/domain/finance";
import { formatCents, toCents } from "@/lib/domain/money";
import { buildSleepInstants, sleepStats } from "@/lib/domain/sleep";
import { conflictsWith } from "@/lib/domain/conflicts";
import { effectiveStatus } from "@/lib/domain/tasks";
import { isScheduledOn, isCompleted, currentStreak, type HabitLike } from "@/lib/domain/habits";
import { expandEvents } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/types";

export interface ToolContext {
  sb: SupabaseClient;
  userId: string;
  tz: string;
  today: string;
  conversationId: string;
  sleepGoal: number;
  wakeTime: string | null;
}

export interface ToolOutcome {
  ok: boolean;
  data?: unknown;
  error?: string;
  /** Resumo legível do que foi feito (exibido na interface). */
  summary?: string;
  /** Quando a ação exige confirmação, o id da ação pendente. */
  pendingId?: string;
}

type Def = {
  description: string;
  input: z.ZodTypeAny;
  schema: Anthropic.Beta.Messages.BetaTool["input_schema"];
  confirm?: boolean;
  /** Descrição curta da ação pendente para o cartão de confirmação. */
  describe?: (input: never, ctx: ToolContext) => Promise<string> | string;
  run: (input: never, ctx: ToolContext) => Promise<ToolOutcome>;
};

const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra });
const num = (description: string, extra: Record<string, unknown> = {}) => ({ type: "number", description, ...extra });
const DATE = "Data no formato AAAA-MM-DD (calcule a partir da data de hoje informada no sistema).";
const TIME = "Horário HH:MM (24h).";
const recurrenceJson = {
  type: "object",
  description: "Repetição opcional.",
  properties: {
    freq: { type: "string", enum: ["diaria", "semanal", "mensal", "anual"] },
    interval: { type: "integer", minimum: 1 },
    weekdays: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, description: "0=domingo … 6=sábado (para semanal)" },
    until: str(DATE),
  },
  required: ["freq"],
};

async function findCategory(sb: SupabaseClient, scope: string, name?: string | null) {
  if (!name) return null;
  const { data } = await sb.from("categories").select("id,name").eq("scope", scope);
  const n = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return data?.find((c) => norm(c.name) === n)?.id ?? data?.find((c) => norm(c.name).includes(n) || n.includes(norm(c.name)))?.id ?? null;
}

async function findByName<T extends { id: string }>(sb: SupabaseClient, table: string, col: string, name: string): Promise<T | null> {
  const { data } = await sb.from(table).select("*").ilike(col, `%${name.replace(/[%_]/g, "")}%`).limit(5);
  return (data?.[0] as T) ?? null;
}

const pending = async (ctx: ToolContext, tool: string, input: unknown, summary: string): Promise<ToolOutcome> => {
  const { data, error } = await ctx.sb.from("pending_actions").insert({ tool_name: tool, input, summary, conversation_id: ctx.conversationId }).select("id").single();
  if (error) return { ok: false, error: "Não foi possível preparar a confirmação." };
  return { ok: true, pendingId: data.id, summary, data: { status: "aguardando_confirmacao", pending_action_id: data.id, mensagem: "A ação NÃO foi executada. Peça à usuária para confirmar no botão exibido na conversa." } };
};

export const TOOLS: Record<string, Def> = {
  get_overview: {
    description: "Resumo integrado de um período (dia, semana ou mês): compromissos, tarefas (pendentes/atrasadas/concluídas), hábitos, finanças e sono. Use para organizar a semana, resumos e revisões.",
    input: z.object({ period: z.enum(["dia", "semana", "mes"]), date: isoDate.optional() }),
    schema: { type: "object", properties: { period: { type: "string", enum: ["dia", "semana", "mes"] }, date: str(`Data de referência. ${DATE}`) }, required: ["period"] },
    run: async (i: { period: "dia" | "semana" | "mes"; date?: string }, ctx) => {
      const ref = i.date ?? ctx.today;
      const from = i.period === "dia" ? ref : i.period === "semana" ? startOfWeek(ref) : monthStart(ref);
      const to = i.period === "dia" ? ref : i.period === "semana" ? addDays(from, 6) : monthEnd(ref);
      const [ev, tasks, habits, logs, txs, accounts, sleep] = await Promise.all([
        ctx.sb.from("events").select("*").is("deleted_at", null).or(`and(starts_at.lte.${zonedToUtc(addDays(to, 1), "00:00", ctx.tz).toISOString()},ends_at.gte.${zonedToUtc(from, "00:00", ctx.tz).toISOString()}),recurrence.not.is.null`).limit(500),
        ctx.sb.from("tasks").select("id,title,status,due_date,due_time,priority,deadline").or(`and(due_date.gte.${from},due_date.lte.${to}),and(due_date.lt.${from},status.in.(pendente,em_andamento)),and(due_date.is.null,status.in.(pendente,em_andamento))`).limit(300),
        ctx.sb.from("habits").select("*").eq("archived", false),
        ctx.sb.from("habit_logs").select("habit_id,log_date,value,completed").gte("log_date", addDays(from, -60)).lte("log_date", to),
        ctx.sb.from("transactions").select("type,amount,category_id,account_id,to_account_id,card_id,invoice_month,occurred_on,due_date,status,description,id").limit(10000),
        ctx.sb.from("financial_accounts").select("id,name,initial_balance,include_in_total,archived"),
        ctx.sb.from("sleep_logs").select("sleep_date,duration_minutes,bed_at,wake_at").gte("sleep_date", addDays(to, -30)).lte("sleep_date", to),
      ]);
      const occ = expandEvents((ev.data ?? []) as CalendarEvent[], from, to, ctx.tz).map((o) => ({ titulo: o.title, data: localDateISO(new Date(o.occStart), ctx.tz), inicio: o.all_day ? "dia inteiro" : localTimeHHMM(new Date(o.occStart), ctx.tz), fim: o.all_day ? null : localTimeHHMM(new Date(o.occEnd), ctx.tz), id: o.id }));
      const conflicts = expandEvents((ev.data ?? []) as CalendarEvent[], from, to, ctx.tz).filter((o, idx, arr) => arr.some((p, j) => j !== idx && !o.all_day && !p.all_day && new Date(o.occStart) < new Date(p.occEnd) && new Date(p.occStart) < new Date(o.occEnd))).map((o) => o.title);
      const t = (tasks.data ?? []) as { id: string; title: string; status: "pendente" | "em_andamento" | "concluida" | "cancelada"; due_date: string | null; due_time: string | null; priority: "baixa" | "media" | "alta" | "urgente"; deadline: string | null }[];
      const hs = (habits.data ?? []) as (HabitLike & { name: string; kind: string })[];
      const hl = (logs.data ?? []) as { habit_id: string; log_date: string; value: number; completed: boolean }[];
      const s = monthSummary((txs.data ?? []) as Tx[], monthStart(ref));
      const sl = sleepStats((sleep.data ?? []) as never, ctx.sleepGoal, to);
      return {
        ok: true,
        data: {
          periodo: { de: from, ate: to },
          compromissos: occ.slice(0, 60),
          conflitos_de_horario: [...new Set(conflicts)],
          tarefas: {
            atrasadas: t.filter((x) => effectiveStatus(x, ctx.today) === "atrasada").map((x) => ({ id: x.id, titulo: x.title, prazo: x.deadline ?? x.due_date, prioridade: x.priority })),
            pendentes: t.filter((x) => (x.status === "pendente" || x.status === "em_andamento") && effectiveStatus(x, ctx.today) !== "atrasada").map((x) => ({ id: x.id, titulo: x.title, data: x.due_date, hora: x.due_time, prioridade: x.priority })),
            concluidas: t.filter((x) => x.status === "concluida").length,
          },
          habitos: hs.filter((h) => h.kind === "construir").map((h) => ({ nome: h.name, sequencia_dias: currentStreak(h, hl, ctx.today), feito_hoje: isScheduledOn(h, ctx.today) ? isCompleted(h, hl.find((l) => l.habit_id === h.id && l.log_date === ctx.today)) : "não agendado hoje" })),
          financas_mes: { receitas: formatCents(s.income), despesas: formatCents(s.expense), a_pagar: formatCents(s.pendingExpense), a_receber: formatCents(s.pendingIncome), saldo_disponivel: formatCents(totalBalance((accounts.data ?? []) as never, (txs.data ?? []) as Tx[])) },
          sono: { media_semana: sl.weekAvg, ultima_noite_min: sl.last?.duration_minutes ?? null, meta_min: ctx.sleepGoal },
        },
      };
    },
  },

  list_tasks: {
    description: "Lista tarefas da usuária. Use para responder quais tarefas estão pendentes, atrasadas etc.",
    input: z.object({ status: z.enum(["abertas", "concluidas", "todas"]).default("abertas"), from: isoDate.optional(), to: isoDate.optional(), search: z.string().max(100).optional(), limit: z.number().int().min(1).max(100).default(40) }),
    schema: { type: "object", properties: { status: { type: "string", enum: ["abertas", "concluidas", "todas"] }, from: str(DATE), to: str(DATE), search: str("Texto para buscar no título"), limit: { type: "integer", minimum: 1, maximum: 100 } } },
    run: async (i: { status: string; from?: string; to?: string; search?: string; limit: number }, ctx) => {
      let q = ctx.sb.from("tasks").select("id,title,status,due_date,due_time,priority,deadline,area").order("due_date", { ascending: true, nullsFirst: false }).limit(i.limit);
      if (i.status === "abertas") q = q.in("status", ["pendente", "em_andamento"]);
      if (i.status === "concluidas") q = q.eq("status", "concluida");
      if (i.from) q = q.gte("due_date", i.from);
      if (i.to) q = q.lte("due_date", i.to);
      if (i.search) q = q.ilike("title", `%${i.search.replace(/[%_]/g, "")}%`);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: (data ?? []).map((t) => ({ ...t, situacao: effectiveStatus(t as never, ctx.today) })) };
    },
  },

  create_task: {
    description: "Cria uma tarefa. Use para lembretes ('lembre-me de…') e afazeres.",
    input: z.object({ title: z.string().trim().min(1).max(200), due_date: isoDate.optional(), due_time: hhmm.optional(), priority: z.enum(["baixa", "media", "alta", "urgente"]).default("media"), area: z.enum(["pessoal", "trabalho", "estudos", "casa"]).default("pessoal"), description: z.string().max(2000).optional(), recurrence: recurrenceSchema, reminder_minutes: z.number().int().min(0).max(10080).optional(), estimated_minutes: z.number().int().min(1).max(1440).optional() }),
    schema: { type: "object", properties: { title: str("Título"), due_date: str(DATE), due_time: str(TIME), priority: { type: "string", enum: ["baixa", "media", "alta", "urgente"] }, area: { type: "string", enum: ["pessoal", "trabalho", "estudos", "casa"] }, description: str("Descrição"), recurrence: recurrenceJson, reminder_minutes: { type: "integer", description: "Minutos antes para lembrar" }, estimated_minutes: { type: "integer" } }, required: ["title"] },
    run: async (i: Record<string, unknown>, ctx) => {
      const { data, error } = await ctx.sb.from("tasks").insert({ ...i, recurrence: i.recurrence ?? null }).select("id,title,due_date,due_time").single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, data, summary: `Tarefa criada: ${data.title}${data.due_date ? ` (${formatDateBR(data.due_date)}${data.due_time ? ` ${data.due_time.slice(0, 5)}` : ""})` : ""}` };
    },
  },

  update_task: {
    description: "Edita uma tarefa existente (título, data, hora, prioridade, status). Para concluir use status 'concluida'.",
    input: z.object({ task_id: z.string().uuid(), title: z.string().trim().min(1).max(200).optional(), due_date: isoDate.nullable().optional(), due_time: hhmm.nullable().optional(), priority: z.enum(["baixa", "media", "alta", "urgente"]).optional(), status: z.enum(["pendente", "em_andamento", "concluida", "cancelada"]).optional() }),
    schema: { type: "object", properties: { task_id: str("ID da tarefa (obtido em list_tasks)"), title: str("Novo título"), due_date: str(DATE), due_time: str(TIME), priority: { type: "string", enum: ["baixa", "media", "alta", "urgente"] }, status: { type: "string", enum: ["pendente", "em_andamento", "concluida", "cancelada"] } }, required: ["task_id"] },
    run: async (i: { task_id: string; status?: string } & Record<string, unknown>, ctx) => {
      const { task_id, ...rest } = i;
      const values: Record<string, unknown> = { ...rest };
      if (i.status === "concluida") values.completed_at = new Date().toISOString();
      else if (i.status) values.completed_at = null;
      const { data, error } = await ctx.sb.from("tasks").update(values).eq("id", task_id).select("id,title,status,due_date").maybeSingle();
      if (error) return { ok: false, error: error.message };
      if (!data) return { ok: false, error: "Tarefa não encontrada." };
      return { ok: true, data, summary: `Tarefa atualizada: ${data.title}` };
    },
  },

  delete_task: {
    description: "Solicita a exclusão de uma tarefa. EXIGE confirmação da usuária na interface.",
    input: z.object({ task_id: z.string().uuid() }),
    schema: { type: "object", properties: { task_id: str("ID da tarefa") }, required: ["task_id"] },
    confirm: true,
    describe: async (i: { task_id: string }, ctx) => {
      const { data } = await ctx.sb.from("tasks").select("title").eq("id", i.task_id).maybeSingle();
      return `Excluir a tarefa “${data?.title ?? "?"}”`;
    },
    run: async (i: { task_id: string }, ctx) => {
      const { error, count } = await ctx.sb.from("tasks").delete({ count: "exact" }).eq("id", i.task_id);
      if (error || !count) return { ok: false, error: error?.message ?? "Tarefa não encontrada." };
      return { ok: true, summary: "Tarefa excluída." };
    },
  },

  reschedule_tasks: {
    description: "Reagenda várias tarefas de uma vez (alteração em massa). EXIGE confirmação.",
    input: z.object({ moves: z.array(z.object({ task_id: z.string().uuid(), new_date: isoDate })).min(1).max(50) }),
    schema: { type: "object", properties: { moves: { type: "array", items: { type: "object", properties: { task_id: str("ID"), new_date: str(DATE) }, required: ["task_id", "new_date"] } } }, required: ["moves"] },
    confirm: true,
    describe: async (i: { moves: { task_id: string; new_date: string }[] }, ctx) => {
      const { data } = await ctx.sb.from("tasks").select("id,title").in("id", i.moves.map((m) => m.task_id));
      return `Reagendar ${i.moves.length} tarefa(s): ${i.moves.map((m) => `${data?.find((t) => t.id === m.task_id)?.title ?? "?"} → ${formatDateBR(m.new_date)}`).join("; ")}`;
    },
    run: async (i: { moves: { task_id: string; new_date: string }[] }, ctx) => {
      let n = 0;
      for (const m of i.moves) {
        const { count } = await ctx.sb.from("tasks").update({ due_date: m.new_date }, { count: "exact" }).eq("id", m.task_id);
        n += count ?? 0;
      }
      return { ok: true, summary: `${n} tarefa(s) reagendada(s).` };
    },
  },

  list_events: {
    description: "Lista compromissos (inclui recorrentes) em um intervalo de datas e aponta conflitos de horário.",
    input: z.object({ from: isoDate, to: isoDate }),
    schema: { type: "object", properties: { from: str(DATE), to: str(DATE) }, required: ["from", "to"] },
    run: async (i: { from: string; to: string }, ctx) => {
      const { data, error } = await ctx.sb.from("events").select("*").is("deleted_at", null).or(`and(starts_at.lte.${zonedToUtc(addDays(i.to, 1), "00:00", ctx.tz).toISOString()},ends_at.gte.${zonedToUtc(i.from, "00:00", ctx.tz).toISOString()}),recurrence.not.is.null`).limit(500);
      if (error) return { ok: false, error: error.message };
      const occ = expandEvents((data ?? []) as CalendarEvent[], i.from, i.to, ctx.tz);
      return { ok: true, data: occ.slice(0, 100).map((o) => ({ id: o.id, titulo: o.title, data: localDateISO(new Date(o.occStart), ctx.tz), inicio: o.all_day ? null : localTimeHHMM(new Date(o.occStart), ctx.tz), fim: o.all_day ? null : localTimeHHMM(new Date(o.occEnd), ctx.tz), dia_inteiro: o.all_day, local: o.location, recorrente: !!o.recurrence, conflita: occ.some((p) => p !== o && !o.all_day && !p.all_day && new Date(o.occStart) < new Date(p.occEnd) && new Date(p.occStart) < new Date(o.occEnd)) })) };
    },
  },

  create_event: {
    description: "Agenda um compromisso. Se não houver horário de término, use 1 hora de duração. Retorna conflitos de horário, se existirem — informe-os à usuária.",
    input: z.object({ title: z.string().trim().min(1).max(200), date: isoDate, start_time: hhmm.optional(), end_time: hhmm.optional(), all_day: z.boolean().default(false), location: z.string().max(300).optional(), description: z.string().max(2000).optional(), recurrence: recurrenceSchema, reminder_minutes: z.number().int().min(0).max(10080).default(30), area: z.enum(["pessoal", "trabalho", "estudos", "casa"]).default("pessoal") }),
    schema: { type: "object", properties: { title: str("Título"), date: str(DATE), start_time: str(TIME), end_time: str(TIME), all_day: { type: "boolean" }, location: str("Local"), description: str("Descrição"), recurrence: recurrenceJson, reminder_minutes: { type: "integer" }, area: { type: "string", enum: ["pessoal", "trabalho", "estudos", "casa"] } }, required: ["title", "date"] },
    run: async (i: { title: string; date: string; start_time?: string; end_time?: string; all_day: boolean; location?: string; description?: string; recurrence?: unknown; reminder_minutes: number; area: string }, ctx) => {
      const allDay = i.all_day || !i.start_time;
      const start = zonedToUtc(i.date, allDay ? "00:00" : i.start_time!, ctx.tz);
      let end = allDay ? zonedToUtc(addDays(i.date, 1), "00:00", ctx.tz) : i.end_time ? zonedToUtc(i.date, i.end_time, ctx.tz) : new Date(start.getTime() + 3600_000);
      if (end <= start) end = new Date(end.getTime() + 86400_000);
      const { data: day } = await ctx.sb.from("events").select("id,title,starts_at,ends_at,all_day").is("deleted_at", null).lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString());
      const conflicts = allDay ? [] : conflictsWith({ id: "novo", title: i.title, starts_at: start, ends_at: end }, (day ?? []) as never);
      const { data, error } = await ctx.sb.from("events").insert({ title: i.title, starts_at: start.toISOString(), ends_at: end.toISOString(), all_day: allDay, location: i.location ?? null, description: i.description ?? null, recurrence: i.recurrence ?? null, reminder_minutes: i.reminder_minutes, area: i.area }).select("id,title").single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: { ...data, conflitos: conflicts.map((c) => c.title) }, summary: `Compromisso agendado: ${i.title} em ${formatDateBR(i.date)}${allDay ? "" : ` às ${i.start_time}`}${conflicts.length ? ` ⚠️ conflita com ${conflicts.map((c) => c.title).join(", ")}` : ""}` };
    },
  },

  update_event: {
    description: "Altera um compromisso existente (título, data, horários, local).",
    input: z.object({ event_id: z.string().uuid(), title: z.string().trim().min(1).max(200).optional(), date: isoDate.optional(), start_time: hhmm.optional(), end_time: hhmm.optional(), location: z.string().max(300).optional() }),
    schema: { type: "object", properties: { event_id: str("ID do compromisso"), title: str("Título"), date: str(DATE), start_time: str(TIME), end_time: str(TIME), location: str("Local") }, required: ["event_id"] },
    run: async (i: { event_id: string; title?: string; date?: string; start_time?: string; end_time?: string; location?: string }, ctx) => {
      const { data: ev } = await ctx.sb.from("events").select("*").eq("id", i.event_id).maybeSingle();
      if (!ev) return { ok: false, error: "Compromisso não encontrado." };
      const date = i.date ?? localDateISO(new Date(ev.starts_at), ctx.tz);
      const st = i.start_time ?? localTimeHHMM(new Date(ev.starts_at), ctx.tz);
      const dur = new Date(ev.ends_at).getTime() - new Date(ev.starts_at).getTime();
      const start = zonedToUtc(date, ev.all_day ? "00:00" : st, ctx.tz);
      const end = i.end_time ? zonedToUtc(date, i.end_time, ctx.tz) : new Date(start.getTime() + dur);
      const { error } = await ctx.sb.from("events").update({ title: i.title ?? ev.title, location: i.location ?? ev.location, starts_at: start.toISOString(), ends_at: (end > start ? end : new Date(start.getTime() + dur)).toISOString(), local_updated_at: new Date().toISOString() }).eq("id", i.event_id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, summary: `Compromisso atualizado: ${i.title ?? ev.title}` };
    },
  },

  delete_event: {
    description: "Solicita a exclusão de um compromisso. EXIGE confirmação.",
    input: z.object({ event_id: z.string().uuid() }),
    schema: { type: "object", properties: { event_id: str("ID") }, required: ["event_id"] },
    confirm: true,
    describe: async (i: { event_id: string }, ctx) => {
      const { data } = await ctx.sb.from("events").select("title,starts_at").eq("id", i.event_id).maybeSingle();
      return `Excluir o compromisso “${data?.title ?? "?"}”${data ? ` de ${formatDateBR(localDateISO(new Date(data.starts_at), ctx.tz))}` : ""}`;
    },
    run: async (i: { event_id: string }, ctx) => {
      const { data } = await ctx.sb.from("events").select("google_event_id").eq("id", i.event_id).maybeSingle();
      if (!data) return { ok: false, error: "Compromisso não encontrado." };
      const res = data.google_event_id
        ? await ctx.sb.from("events").update({ deleted_at: new Date().toISOString(), local_updated_at: new Date().toISOString() }).eq("id", i.event_id)
        : await ctx.sb.from("events").delete().eq("id", i.event_id);
      if (res.error) return { ok: false, error: res.error.message };
      return { ok: true, summary: "Compromisso excluído." };
    },
  },

  create_transaction: {
    description: "Registra uma receita ou despesa. Valores em reais (número, ex.: 150.5). Para compras no cartão de crédito informe card_name e, se houver, o número de parcelas.",
    input: z.object({ type: z.enum(["receita", "despesa"]), amount: z.number().positive().max(999_999_999), description: z.string().trim().min(1).max(160), category_name: z.string().max(60).optional(), date: isoDate.optional(), status: z.enum(["pago", "pendente"]).default("pago"), due_date: isoDate.optional(), account_name: z.string().max(80).optional(), card_name: z.string().max(80).optional(), installments: z.number().int().min(1).max(72).default(1) }),
    schema: { type: "object", properties: { type: { type: "string", enum: ["receita", "despesa"] }, amount: num("Valor em reais"), description: str("Descrição"), category_name: str("Categoria (ex.: Mercado, Alimentação, Salário)"), date: str(DATE), status: { type: "string", enum: ["pago", "pendente"], description: "pendente = a pagar/receber" }, due_date: str(`Vencimento para contas a pagar. ${DATE}`), account_name: str("Nome da conta (opcional)"), card_name: str("Nome do cartão de crédito (opcional)"), installments: { type: "integer", minimum: 1, maximum: 72 } }, required: ["type", "amount", "description"] },
    run: async (i: { type: "receita" | "despesa"; amount: number; description: string; category_name?: string; date?: string; status: "pago" | "pendente"; due_date?: string; account_name?: string; card_name?: string; installments: number }, ctx) => {
      const date = i.date ?? ctx.today;
      const category_id = await findCategory(ctx.sb, i.type, i.category_name);
      const card = i.type === "despesa" && i.card_name ? await findByName<{ id: string; name: string; closing_day: number }>(ctx.sb, "credit_cards", "name", i.card_name) : null;
      if (i.card_name && !card) return { ok: false, error: `Cartão “${i.card_name}” não encontrado. Peça para a usuária cadastrá-lo em Finanças › Contas.` };
      let account: { id: string } | null = null;
      if (!card) {
        account = i.account_name ? await findByName(ctx.sb, "financial_accounts", "name", i.account_name) : null;
        if (!account) {
          const { data } = await ctx.sb.from("financial_accounts").select("id").eq("archived", false).order("created_at").limit(1);
          account = data?.[0] ?? null;
        }
        if (!account) return { ok: false, error: "Nenhuma conta cadastrada. Oriente a usuária a cadastrar a conta principal em Finanças antes de registrar movimentações." };
      }
      if (card && i.installments > 1) {
        const group = crypto.randomUUID();
        const rows = buildInstallments(i.amount, i.installments, date, card.closing_day).map((r) => ({ ...r, type: "despesa", description: `${i.description} (${r.installment_number}/${r.installment_total})`, category_id, card_id: card.id, status: "pago", installment_group: group }));
        const { error } = await ctx.sb.from("transactions").insert(rows);
        if (error) return { ok: false, error: error.message };
        return { ok: true, summary: `Compra parcelada registrada: ${i.description} em ${i.installments}x no ${card.name} (total ${formatCents(toCents(i.amount))})` };
      }
      const { error } = await ctx.sb.from("transactions").insert({
        type: i.type, amount: i.amount.toFixed(2), description: i.description, category_id, occurred_on: date,
        account_id: account?.id ?? null, card_id: card?.id ?? null, invoice_month: card ? invoiceMonthFor(date, card.closing_day) : null,
        status: card ? "pago" : i.status, due_date: !card && i.status === "pendente" ? i.due_date ?? date : null,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, summary: `${i.type === "receita" ? "Receita" : "Despesa"} registrada: ${i.description} — ${formatCents(toCents(i.amount))}${card ? ` no ${card.name}` : ""}${i.status === "pendente" && !card ? " (pendente)" : ""}` };
    },
  },

  finance_summary: {
    description: "Resumo financeiro de um mês: receitas, despesas, gastos por categoria, saldo disponível, contas a vencer e orçamento. Use para 'quanto gastei este mês?'.",
    input: z.object({ month: isoDate.optional() }),
    schema: { type: "object", properties: { month: str("Qualquer data do mês desejado (AAAA-MM-DD). Padrão: mês atual.") } },
    run: async (i: { month?: string }, ctx) => {
      const m = monthStart(i.month ?? ctx.today);
      const [txs, accounts, cats, budgets] = await Promise.all([
        ctx.sb.from("transactions").select("*").limit(10000),
        ctx.sb.from("financial_accounts").select("*"),
        ctx.sb.from("categories").select("id,name").eq("scope", "despesa"),
        ctx.sb.from("budgets").select("*").eq("month", m),
      ]);
      const list = (txs.data ?? []) as Tx[];
      const s = monthSummary(list, m);
      const br = [...categoryBreakdown(list, m).entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ categoria: cats.data?.find((c) => c.id === id)?.name ?? "Sem categoria", total: formatCents(v) }));
      const overall = (budgets.data ?? []).find((b) => !b.category_id);
      return {
        ok: true,
        data: {
          mes: m.slice(0, 7),
          receitas: formatCents(s.income),
          despesas: formatCents(s.expense),
          resultado: formatCents(s.net),
          a_pagar: formatCents(s.pendingExpense),
          a_receber: formatCents(s.pendingIncome),
          saldo_disponivel_hoje: formatCents(totalBalance((accounts.data ?? []) as never, list)),
          gastos_por_categoria: br,
          contas_a_vencer_7_dias: upcomingBills(list, ctx.today, 7).map((b) => ({ descricao: b.description, valor: formatCents(toCents(b.amount)), vencimento: b.due_date, atrasada: b.overdue })),
          orcamento: overall ? budgetUsage(overall.limit_amount, s.expense) : null,
          observacao: "Transferências entre contas e pagamentos de fatura não entram como receita/despesa.",
        },
      };
    },
  },

  list_transactions: {
    description: "Lista movimentações financeiras recentes, com filtros.",
    input: z.object({ month: isoDate.optional(), type: z.enum(["receita", "despesa", "transferencia", "pagamento_fatura"]).optional(), search: z.string().max(80).optional(), limit: z.number().int().min(1).max(100).default(30) }),
    schema: { type: "object", properties: { month: str("Data do mês"), type: { type: "string", enum: ["receita", "despesa", "transferencia", "pagamento_fatura"] }, search: str("Texto na descrição"), limit: { type: "integer" } } },
    run: async (i: { month?: string; type?: string; search?: string; limit: number }, ctx) => {
      let q = ctx.sb.from("transactions").select("id,type,amount,description,occurred_on,status").order("occurred_on", { ascending: false }).limit(i.limit);
      if (i.month) q = q.gte("occurred_on", monthStart(i.month)).lte("occurred_on", monthEnd(i.month));
      if (i.type) q = q.eq("type", i.type);
      if (i.search) q = q.ilike("description", `%${i.search.replace(/[%_]/g, "")}%`);
      const { data, error } = await q;
      return error ? { ok: false, error: error.message } : { ok: true, data };
    },
  },

  delete_transaction: {
    description: "Solicita a exclusão de uma movimentação financeira. EXIGE confirmação.",
    input: z.object({ transaction_id: z.string().uuid() }),
    schema: { type: "object", properties: { transaction_id: str("ID") }, required: ["transaction_id"] },
    confirm: true,
    describe: async (i: { transaction_id: string }, ctx) => {
      const { data } = await ctx.sb.from("transactions").select("description,amount").eq("id", i.transaction_id).maybeSingle();
      return `Excluir a movimentação “${data?.description ?? "?"}” (${data ? formatCents(toCents(data.amount)) : "?"})`;
    },
    run: async (i: { transaction_id: string }, ctx) => {
      const { error, count } = await ctx.sb.from("transactions").delete({ count: "exact" }).eq("id", i.transaction_id);
      return error || !count ? { ok: false, error: error?.message ?? "Não encontrada." } : { ok: true, summary: "Movimentação excluída." };
    },
  },

  list_habits: {
    description: "Lista hábitos ativos com sequência atual e situação de hoje.",
    input: z.object({}),
    schema: { type: "object", properties: {} },
    run: async (_i: never, ctx) => {
      const [{ data: hs }, { data: logs }] = await Promise.all([ctx.sb.from("habits").select("*").eq("archived", false), ctx.sb.from("habit_logs").select("habit_id,log_date,value,completed").gte("log_date", addDays(ctx.today, -90))]);
      return { ok: true, data: (hs ?? []).map((h) => ({ id: h.id, nome: h.name, meta: `${Number(h.target_value)} ${h.unit}`, sequencia: currentStreak(h as never, (logs ?? []) as never, ctx.today), feito_hoje: isCompleted(h as never, (logs ?? []).find((l) => l.habit_id === h.id && l.log_date === ctx.today) as never) })) };
    },
  },

  create_habit: {
    description: "Cria um hábito (ex.: rotina de estudos, beber água, ler).",
    input: z.object({ name: z.string().trim().min(1).max(120), emoji: z.string().max(8).default("✨"), target_value: z.number().positive().max(100000).default(1), unit: z.string().max(20).default("vez"), frequency_type: z.enum(["daily", "weekdays", "times_per_week"]).default("daily"), days: z.array(z.number().int().min(0).max(6)).optional(), times: z.number().int().min(1).max(7).optional(), period: z.enum(["manha", "tarde", "noite", "qualquer"]).default("qualquer"), time_of_day: hhmm.optional() }),
    schema: { type: "object", properties: { name: str("Nome"), emoji: str("Emoji"), target_value: num("Meta diária"), unit: str("Unidade (vez, min, ml, páginas)"), frequency_type: { type: "string", enum: ["daily", "weekdays", "times_per_week"] }, days: { type: "array", items: { type: "integer" }, description: "Dias da semana (0=dom) quando weekdays" }, times: { type: "integer", description: "Vezes por semana" }, period: { type: "string", enum: ["manha", "tarde", "noite", "qualquer"] }, time_of_day: str(TIME) }, required: ["name"] },
    run: async (i: { name: string; emoji: string; target_value: number; unit: string; frequency_type: string; days?: number[]; times?: number; period: string; time_of_day?: string }, ctx) => {
      const frequency = i.frequency_type === "weekdays" ? { type: "weekdays", days: i.days?.length ? i.days : [1, 2, 3, 4, 5] } : i.frequency_type === "times_per_week" ? { type: "times_per_week", times: i.times ?? 3 } : { type: "daily" };
      const step = i.unit === "ml" ? 250 : i.unit === "min" ? Math.min(10, i.target_value) : 1;
      const { error } = await ctx.sb.from("habits").insert({ name: i.name, emoji: i.emoji, target_value: i.target_value, unit: i.unit, step_value: step, frequency, period: i.period, time_of_day: i.time_of_day ?? null });
      return error ? { ok: false, error: error.message } : { ok: true, summary: `Hábito criado: ${i.emoji} ${i.name}` };
    },
  },

  log_habit: {
    description: "Registra progresso de um hábito em um dia (marca como feito ou soma quantidade).",
    input: z.object({ habit_name: z.string().min(1).max(120), value: z.number().min(0).optional(), date: isoDate.optional() }),
    schema: { type: "object", properties: { habit_name: str("Nome do hábito"), value: num("Quantidade (omita para marcar como concluído)"), date: str(DATE) }, required: ["habit_name"] },
    run: async (i: { habit_name: string; value?: number; date?: string }, ctx) => {
      const h = await findByName<{ id: string; name: string; target_value: number; checklist: { id: string }[] }>(ctx.sb, "habits", "name", i.habit_name);
      if (!h) return { ok: false, error: `Hábito “${i.habit_name}” não encontrado.` };
      const date = i.date ?? ctx.today;
      const { data: ex } = await ctx.sb.from("habit_logs").select("id,value").eq("habit_id", h.id).eq("log_date", date).maybeSingle();
      const value = i.value !== undefined ? Number(ex?.value ?? 0) + i.value : Number(h.target_value);
      const completed = value >= Number(h.target_value);
      const { error } = await ctx.sb.from("habit_logs").upsert({ ...(ex ? { id: ex.id } : {}), habit_id: h.id, log_date: date, value, completed, checklist_done: completed ? h.checklist.map((c) => c.id) : [] }, { onConflict: "habit_id,log_date" });
      return error ? { ok: false, error: error.message } : { ok: true, summary: `Hábito registrado: ${h.name}${completed ? " ✓" : ` (${value}/${Number(h.target_value)})`}` };
    },
  },

  log_sleep: {
    description: "Registra uma noite de sono. Informe horários de dormir/acordar ou apenas a duração em horas.",
    input: z.object({ date: isoDate.optional(), bed_time: hhmm.optional(), wake_time: hhmm.optional(), hours: z.number().min(0.5).max(20).optional(), quality: z.number().int().min(1).max(5).optional() }),
    schema: { type: "object", properties: { date: str(`Data em que acordou. ${DATE}`), bed_time: str(TIME), wake_time: str(TIME), hours: num("Duração em horas, se os horários não forem informados"), quality: { type: "integer", minimum: 1, maximum: 5 } } },
    run: async (i: { date?: string; bed_time?: string; wake_time?: string; hours?: number; quality?: number }, ctx) => {
      const date = i.date ?? ctx.today;
      let wake = i.wake_time ?? ctx.wakeTime?.slice(0, 5) ?? "07:00";
      let bed = i.bed_time;
      if (!bed) {
        if (!i.hours) return { ok: false, error: "Informe a duração ou os horários." };
        const [h, m] = wake.split(":").map(Number);
        const mins = (h * 60 + m - Math.round(i.hours * 60) + 2880) % 1440;
        bed = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
      }
      wake = wake.slice(0, 5);
      const { bedAt, wakeAt, duration } = buildSleepInstants(date, bed, wake, ctx.tz);
      const { data: ex } = await ctx.sb.from("sleep_logs").select("id").eq("sleep_date", date).maybeSingle();
      const values = { sleep_date: date, bed_at: bedAt.toISOString(), wake_at: wakeAt.toISOString(), duration_minutes: duration, quality: i.quality ?? null };
      const { error } = ex ? await ctx.sb.from("sleep_logs").update(values).eq("id", ex.id) : await ctx.sb.from("sleep_logs").insert(values);
      return error ? { ok: false, error: error.message } : { ok: true, summary: `Sono registrado: ${Math.floor(duration / 60)}h${duration % 60 ? String(duration % 60).padStart(2, "0") : ""} (${bed} → ${wake})` };
    },
  },

  log_water: {
    description: "Registra consumo de água em mililitros.",
    input: z.object({ ml: z.number().int().min(1).max(5000), date: isoDate.optional() }),
    schema: { type: "object", properties: { ml: { type: "integer", minimum: 1, maximum: 5000 }, date: str(DATE) }, required: ["ml"] },
    run: async (i: { ml: number; date?: string }, ctx) => {
      const { error } = await ctx.sb.from("water_logs").insert({ amount_ml: i.ml, log_date: i.date ?? ctx.today });
      return error ? { ok: false, error: error.message } : { ok: true, summary: `Água registrada: ${i.ml} ml` };
    },
  },

  create_shopping_list: {
    description: "Cria uma lista de compras com itens (ou adiciona itens a uma lista existente com o mesmo nome).",
    input: z.object({ name: z.string().trim().min(1).max(80).default("Mercado"), items: z.array(z.string().trim().min(1).max(120)).min(1).max(100) }),
    schema: { type: "object", properties: { name: str("Nome da lista"), items: { type: "array", items: { type: "string" } } }, required: ["items"] },
    run: async (i: { name: string; items: string[] }, ctx) => {
      let list = await findByName<{ id: string; name: string }>(ctx.sb, "shopping_lists", "name", i.name);
      if (!list) {
        const { data, error } = await ctx.sb.from("shopping_lists").insert({ name: i.name }).select("id,name").single();
        if (error) return { ok: false, error: error.message };
        list = data;
      }
      const { error } = await ctx.sb.from("shopping_items").insert(i.items.map((name) => ({ list_id: list!.id, name })));
      return error ? { ok: false, error: error.message } : { ok: true, summary: `Lista “${list.name}”: ${i.items.length} item(ns) adicionado(s)` };
    },
  },

  create_note: {
    description: "Cria uma anotação/ideia.",
    input: z.object({ title: z.string().max(200).default(""), content: z.string().max(20000).default(""), tags: z.array(z.string().max(40)).max(10).default([]) }),
    schema: { type: "object", properties: { title: str("Título"), content: str("Conteúdo"), tags: { type: "array", items: { type: "string" } } } },
    run: async (i: { title: string; content: string; tags: string[] }, ctx) => {
      const { error } = await ctx.sb.from("notes").insert({ title: i.title, content: i.content, tags: i.tags, kind: "nota" });
      return error ? { ok: false, error: error.message } : { ok: true, summary: `Nota criada: ${i.title || "sem título"}` };
    },
  },

  create_goal: {
    description: "Cria uma meta com etapas opcionais.",
    input: z.object({ title: z.string().trim().min(1).max(160), horizon: z.enum(["semanal", "mensal", "anual", "longo_prazo"]).default("anual"), area: z.enum(["pessoal", "profissional", "financeira", "saude", "estudos", "relacionamentos"]).default("pessoal"), target_value: z.number().positive().optional(), unit: z.string().max(20).optional(), due_date: isoDate.optional(), steps: z.array(z.string().trim().min(1).max(160)).max(20).default([]) }),
    schema: { type: "object", properties: { title: str("Meta"), horizon: { type: "string", enum: ["semanal", "mensal", "anual", "longo_prazo"] }, area: { type: "string", enum: ["pessoal", "profissional", "financeira", "saude", "estudos", "relacionamentos"] }, target_value: num("Alvo numérico"), unit: str("Unidade"), due_date: str(DATE), steps: { type: "array", items: { type: "string" } } }, required: ["title"] },
    run: async (i: { title: string; horizon: string; area: string; target_value?: number; unit?: string; due_date?: string; steps: string[] }, ctx) => {
      const { steps, ...g } = i;
      const { data, error } = await ctx.sb.from("goals").insert(g).select("id").single();
      if (error) return { ok: false, error: error.message };
      if (steps.length) await ctx.sb.from("goal_steps").insert(steps.map((title, position) => ({ goal_id: data.id, title, position })));
      return { ok: true, summary: `Meta criada: ${i.title}${steps.length ? ` com ${steps.length} etapa(s)` : ""}` };
    },
  },
};

export function toolDefinitions(): Anthropic.Beta.Messages.BetaTool[] {
  return Object.entries(TOOLS).map(([name, d]) => ({ name, description: d.description, input_schema: d.schema }));
}

/** Valida e executa (ou enfileira para confirmação) uma chamada de ferramenta. */
export async function executeTool(name: string, rawInput: unknown, ctx: ToolContext, opts: { confirmed?: boolean } = {}): Promise<ToolOutcome> {
  const def = TOOLS[name];
  if (!def) return { ok: false, error: `Ferramenta desconhecida: ${name}` };
  const parsed = def.input.safeParse(rawInput ?? {});
  if (!parsed.success) return { ok: false, error: `Parâmetros inválidos: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` };
  if (def.confirm && !opts.confirmed) {
    const summary = def.describe ? await def.describe(parsed.data as never, ctx) : `Executar ${name}`;
    return pending(ctx, name, parsed.data, summary);
  }
  try {
    return await def.run(parsed.data as never, ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
