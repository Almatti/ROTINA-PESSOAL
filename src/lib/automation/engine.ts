import "server-only";
/**
 * Motor de automações. Funciona com o cliente da usuária (RLS) ou com
 * service_role (cron) — por isso TODA consulta filtra por user_id e todo
 * insert informa user_id explicitamente.
 * Regras de segurança: nenhuma automação paga contas, exclui registros ou
 * altera compromissos; apenas gera lembretes, lançamentos "a pagar",
 * próximas ocorrências e notificações.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, localDateISO, zonedParts, monthStart, addMonths, monthEnd, zonedToUtc, localTimeHHMM, formatDateBR, startOfWeek } from "@/lib/domain/dates";
import { nextOccurrence, type RecurrenceRule } from "@/lib/domain/recurrence";
import { monthSummary, upcomingBills, invoiceTotals, invoiceDueDate, invoiceMonthFor, type Tx, type RecurringDef } from "@/lib/domain/finance";
import { effectiveStatus, suggestReschedule } from "@/lib/domain/tasks";
import { isScheduledOn, isCompleted } from "@/lib/domain/habits";
import { formatCents, toCents } from "@/lib/domain/money";
import { generateRecurring } from "./recurring";
import { sendPushToUser } from "@/lib/push/send";
import { expandEvents } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/types";

interface Profile { id: string; timezone: string | null; notification_prefs: Record<string, boolean> | null }

export async function runAutomationsForUser(sb: SupabaseClient, profile: Profile, now = new Date()) {
  const uid = profile.id;
  const tz = profile.timezone || "America/Sao_Paulo";
  const today = localDateISO(now, tz);
  const parts = zonedParts(now, tz);
  const prefs = profile.notification_prefs ?? {};
  const { data: autos } = await sb.from("automations").select("key,enabled").eq("user_id", uid);
  const on = (k: string) => !!autos?.find((a) => a.key === k && a.enabled);
  let created = 0;
  const log: Record<string, unknown> = {};

  const notify = async (type: string, title: string, body: string, link: string, dedupe: string) => {
    const { data } = await sb.from("notifications").upsert({ user_id: uid, type, title, body, link, dedupe_key: dedupe }, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }).select("id");
    if (data?.length) {
      created++;
      // Web Push: entrega no dispositivo mesmo com o app fechado (se a usuária ativou)
      await sendPushToUser(sb, uid, { title, body, url: link, tag: dedupe }).catch(() => undefined);
    }
  };

  const [tasksRes, txRes] = await Promise.all([
    sb.from("tasks").select("*").eq("user_id", uid).limit(3000),
    sb.from("transactions").select("*").eq("user_id", uid).limit(10000),
  ]);
  const tasks = (tasksRes.data ?? []) as { id: string; title: string; status: "pendente" | "em_andamento" | "concluida" | "cancelada"; due_date: string | null; due_time: string | null; deadline: string | null; priority: "baixa" | "media" | "alta" | "urgente"; recurrence: RecurrenceRule | null; recurrence_parent_id: string | null; [k: string]: unknown }[];
  let txs = (txRes.data ?? []) as Tx[];

  // 1. Tarefas recorrentes: garante a próxima ocorrência de séries concluídas
  if (on("tarefas_recorrentes")) {
    let n = 0;
    const roots = new Map<string, typeof tasks>();
    for (const t of tasks.filter((x) => x.recurrence)) {
      const root = t.recurrence_parent_id ?? t.id;
      roots.set(root, [...(roots.get(root) ?? []), t]);
    }
    for (const [root, series] of roots) {
      if (series.some((t) => t.status === "pendente" || t.status === "em_andamento")) continue;
      const last = series.filter((t) => t.due_date).sort((a, b) => b.due_date!.localeCompare(a.due_date!))[0];
      if (!last || last.status === "cancelada") continue;
      const next = nextOccurrence(last.recurrence!, last.due_date!, last.due_date!);
      if (!next) continue;
      const { error } = await sb.from("tasks").insert({
        user_id: uid, title: last.title, description: last.description ?? null, area: last.area ?? "pessoal", category_id: last.category_id ?? null,
        project_id: last.project_id ?? null, due_date: next, due_time: last.due_time, priority: last.priority, recurrence: last.recurrence, recurrence_parent_id: root,
        reminder_minutes: last.reminder_minutes ?? null, estimated_minutes: last.estimated_minutes ?? null, tags: last.tags ?? [],
      });
      if (!error) n++;
    }
    log.tarefas_recorrentes = n;
    created += n;
  }

  // 2. Contas fixas do mês (e dos próximos 7 dias)
  if (on("contas_fixas")) {
    const [{ data: defs }, { data: cards }] = await Promise.all([
      sb.from("recurring_transactions").select("*").eq("user_id", uid).eq("active", true),
      sb.from("credit_cards").select("id,closing_day").eq("user_id", uid),
    ]);
    const n = await generateRecurring(sb, (defs ?? []) as RecurringDef[], monthStart(today), addDays(monthEnd(today), 7), cards ?? [], uid);
    log.contas_fixas = n;
    created += n;
    if (n) txs = ((await sb.from("transactions").select("*").eq("user_id", uid).limit(10000)).data ?? []) as Tx[];
  }

  // 3/4. Atrasadas e sugestão de reagendamento
  const overdue = tasks.filter((t) => effectiveStatus(t, today) === "atrasada");
  if (on("tarefas_atrasadas") && overdue.length && prefs.tarefas !== false) {
    await notify("tarefa", `Você tem ${overdue.length} tarefa(s) atrasada(s)`, overdue.slice(0, 5).map((t) => `• ${t.title}`).join("\n"), "/tarefas", `atrasadas:${today}`);
  }
  if (on("sugerir_reagendamento") && overdue.length) {
    const sug = suggestReschedule(overdue, today).slice(0, 6);
    await notify("tarefa", "Sugestão de reagendamento", sug.map((s) => `• ${overdue.find((t) => t.id === s.id)?.title} → ${formatDateBR(s.to)}`).join("\n") + "\nPeça à Vilma para aplicar, se quiser.", "/vilma", `reagendar:${today}`);
  }

  // 5. Compromissos nas próximas 24 h
  if (on("compromissos_proximos") && prefs.compromissos !== false) {
    const { data: evs } = await sb.from("events").select("*").eq("user_id", uid).is("deleted_at", null).or(`and(starts_at.lte.${new Date(now.getTime() + 86400_000).toISOString()},ends_at.gte.${now.toISOString()}),recurrence.not.is.null`).limit(500);
    const occ = expandEvents((evs ?? []) as CalendarEvent[], today, addDays(today, 1), tz).filter((o) => new Date(o.occStart) > now && new Date(o.occStart).getTime() < now.getTime() + 86400_000);
    for (const o of occ.slice(0, 10)) await notify("compromisso", `Em breve: ${o.title}`, `${formatDateBR(localDateISO(new Date(o.occStart), tz))} ${o.all_day ? "(dia inteiro)" : `às ${localTimeHHMM(new Date(o.occStart), tz)}`}`, `/agenda?dia=${localDateISO(new Date(o.occStart), tz)}`, `evento:${o.id}:${o.occStart}`);
  }

  // 5b. Lembretes no horário exato (compromissos e tarefas com "X min antes").
  // Janela de 20 min para tolerar atrasos do agendador; deduplicado por ocorrência.
  const windowStart = now.getTime() - 20 * 60_000;
  if (on("compromissos_proximos") && prefs.compromissos !== false) {
    const { data: evs } = await sb.from("events").select("*").eq("user_id", uid).is("deleted_at", null).not("reminder_minutes", "is", null).or(`and(starts_at.lte.${new Date(now.getTime() + 8 * 86400_000).toISOString()},ends_at.gte.${now.toISOString()}),recurrence.not.is.null`).limit(500);
    for (const o of expandEvents((evs ?? []) as CalendarEvent[], today, addDays(today, 7), tz)) {
      const at = new Date(o.occStart).getTime() - (o.reminder_minutes ?? 0) * 60_000;
      if (at <= now.getTime() && at >= windowStart) await notify("compromisso", `Lembrete: ${o.title}`, o.all_day ? "Hoje (dia inteiro)" : `Começa às ${localTimeHHMM(new Date(o.occStart), tz)}`, `/agenda?dia=${localDateISO(new Date(o.occStart), tz)}`, `lembrete-ev:${o.id}:${o.occStart}`);
    }
  }
  if (prefs.tarefas !== false) {
    for (const t of tasks.filter((x) => x.due_date && x.due_time && typeof x.reminder_minutes === "number" && (x.status === "pendente" || x.status === "em_andamento"))) {
      const at = zonedToUtc(t.due_date!, t.due_time!.slice(0, 5), tz).getTime() - (t.reminder_minutes as number) * 60_000;
      if (at <= now.getTime() && at >= windowStart) await notify("tarefa", `Lembrete: ${t.title}`, `Às ${t.due_time!.slice(0, 5)}`, "/meu-plano", `lembrete-tk:${t.id}:${t.due_date}`);
    }
  }

  // 6. Vencimentos (contas a pagar e faturas em até 3 dias)
  if (on("vencimentos") && prefs.vencimentos !== false) {
    for (const b of upcomingBills(txs, today, 3)) await notify("vencimento", b.overdue ? `Conta atrasada: ${b.description}` : `Vence ${b.daysLeft === 0 ? "hoje" : `em ${b.daysLeft} dia(s)`}: ${b.description}`, formatCents(toCents(b.amount)), "/financas", `venc:${b.id}`);
    const { data: cards } = await sb.from("credit_cards").select("*").eq("user_id", uid).eq("archived", false);
    for (const c of cards ?? []) {
      for (const ref of [addMonths(invoiceMonthFor(today, c.closing_day), -1, 1), invoiceMonthFor(today, c.closing_day)]) {
        const due = invoiceDueDate(ref, c);
        const inv = invoiceTotals(txs, c.id, ref);
        if (inv.open > 0 && due >= today && due <= addDays(today, 3)) await notify("vencimento", `Fatura ${c.name} vence em ${formatDateBR(due)}`, `Em aberto: ${formatCents(inv.open)}`, "/financas?aba=contas", `fatura:${c.id}:${ref}`);
      }
    }
  }

  // 7. Resumo da manhã / revisão da noite / semanal / mensal
  const open = tasks.filter((t) => (t.status === "pendente" || t.status === "em_andamento") && (t.due_date === today || effectiveStatus(t, today) === "atrasada"));
  if (on("resumo_manha") && parts.hour >= 5 && prefs.resumo_manha !== false) {
    const { data: evs } = await sb.from("events").select("*").eq("user_id", uid).is("deleted_at", null).or(`and(starts_at.lte.${zonedToUtc(addDays(today, 1), "00:00", tz).toISOString()},ends_at.gte.${zonedToUtc(today, "00:00", tz).toISOString()}),recurrence.not.is.null`).limit(300);
    const occ = expandEvents((evs ?? []) as CalendarEvent[], today, today, tz);
    const { data: habits } = await sb.from("habits").select("*").eq("user_id", uid).eq("archived", false).eq("kind", "construir");
    const hs = (habits ?? []).filter((h) => isScheduledOn(h as never, today));
    await notify("resumo", "Bom dia! Seu dia em resumo ☀️", `${occ.length} compromisso(s)${occ.length ? `: ${occ.slice(0, 3).map((o) => o.title).join(", ")}` : ""}\n${open.length} tarefa(s) para hoje\n${hs.length} hábito(s) agendado(s)`, "/meu-plano", `resumo:${today}`);
  }
  if (on("revisao_noite") && parts.hour >= 20 && prefs.revisao_noite) {
    const done = tasks.filter((t) => t.status === "concluida" && typeof t.completed_at === "string" && localDateISO(new Date(t.completed_at as string), tz) === today).length;
    const { data: habits } = await sb.from("habits").select("*").eq("user_id", uid).eq("archived", false).eq("kind", "construir");
    const { data: logs } = await sb.from("habit_logs").select("habit_id,log_date,value,completed").eq("user_id", uid).eq("log_date", today);
    const sched = (habits ?? []).filter((h) => isScheduledOn(h as never, today));
    const hd = sched.filter((h) => isCompleted(h as never, (logs ?? []).find((l) => l.habit_id === h.id) as never)).length;
    await notify("resumo", "Revisão do dia 🌙", `Você concluiu ${done} tarefa(s) e ${hd}/${sched.length} hábito(s). ${open.length ? `${open.length} tarefa(s) podem ir para amanhã.` : "Tudo em dia!"} Descanse bem.`, "/meu-plano", `revisao:${today}`);
  }
  if (on("planejamento_semanal") && parts.weekday === 0) {
    const ws = startOfWeek(addDays(today, 1));
    const weekTasks = tasks.filter((t) => t.due_date && t.due_date >= ws && t.due_date <= addDays(ws, 6) && t.status !== "concluida" && t.status !== "cancelada");
    await notify("resumo", "Planejamento da semana", `${weekTasks.length} tarefa(s) previstas e ${overdue.length} atrasada(s). Peça à Vilma: “organize minha semana”.`, "/vilma", `semana:${today}`);
  }
  if (on("relatorio_mensal") && parts.day === 1) {
    const prev = addMonths(monthStart(today), -1, 1);
    const s = monthSummary(txs, prev);
    const doneM = tasks.filter((t) => t.status === "concluida" && typeof t.completed_at === "string" && (t.completed_at as string).slice(0, 7) === prev.slice(0, 7)).length;
    await notify("resumo", `Seu mês de ${formatDateBR(prev).slice(3)} 📊`, `Receitas ${formatCents(s.income)} · Despesas ${formatCents(s.expense)} · Resultado ${formatCents(s.net)}\n${doneM} tarefa(s) concluída(s).`, "/financas", `mes:${prev.slice(0, 7)}`);
  }

  // 8. Metas: prazo próximo ou sem revisão
  if (on("atualizar_metas")) {
    const { data: goals } = await sb.from("goals").select("id,title,due_date,last_reviewed_at,created_at").eq("user_id", uid).eq("status", "ativa");
    for (const g of goals ?? []) {
      if (g.due_date && g.due_date >= today && g.due_date <= addDays(today, 7)) await notify("info", `Meta com prazo próximo: ${g.title}`, `Prazo: ${formatDateBR(g.due_date)}`, "/metas", `meta-prazo:${g.id}:${g.due_date}`);
      const ref = g.last_reviewed_at ?? g.created_at;
      if (new Date(ref).getTime() < now.getTime() - 30 * 86400_000) await notify("info", `Que tal revisar a meta “${g.title}”?`, "Ela está há mais de 30 dias sem revisão.", "/metas", `meta-rev:${g.id}:${startOfWeek(today)}`);
    }
  }

  // 9. Progresso diário (histórico para gráficos)
  if (on("progresso_diario")) {
    const dayTasks = tasks.filter((t) => t.due_date === today && t.status !== "cancelada");
    log.progresso = { data: today, tarefas_total: dayTasks.length, tarefas_feitas: dayTasks.filter((t) => t.status === "concluida").length };
  }

  await sb.from("automations").update({ last_run_at: now.toISOString() }).eq("user_id", uid).eq("enabled", true);
  await sb.from("automation_runs").insert({ user_id: uid, automation_key: "todas", status: "ok", details: { ...log, criados: created } });
  return { created, log };
}
