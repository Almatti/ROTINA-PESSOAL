"use client";
/**
 * Vilma no modo local: assistente por regras (sem IA na nuvem).
 * Entende comandos comuns em português e responde com dados reais do aparelho.
 * Não inventa: quando não entende, diz isso e sugere exemplos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseQuickCommand } from "@/lib/domain/nlp";
import { addDays, formatDateBR, monthStart, startOfWeek, zonedToUtc } from "@/lib/domain/dates";
import { monthSummary, categoryBreakdown, totalBalance, upcomingBills, type Tx } from "@/lib/domain/finance";
import { formatCents, toCents } from "@/lib/domain/money";
import { effectiveStatus } from "@/lib/domain/tasks";
import { buildSleepInstants } from "@/lib/domain/sleep";

export interface LocalReply { reply: string; actions: { tool: string; ok: boolean; summary?: string; error?: string }[] }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export async function localAssistant(message: string, ctx: { sb: SupabaseClient; today: string; tz: string; wakeTime: string | null }): Promise<LocalReply> {
  const { sb, today, tz } = ctx;
  const n = norm(message);
  const actions: LocalReply["actions"] = [];

  // ---------- consultas ----------
  if (/(quais|lista|liste|mostre|tenho).*(tarefa)|tarefas? (pendente|aberta|atrasada)/.test(n)) {
    const { data } = await sb.from("tasks").select("id,title,due_date,status,priority,deadline").in("status", ["pendente", "em_andamento"]).order("due_date", { ascending: true, nullsFirst: false }).limit(50);
    const list = (data ?? []) as { id: string; title: string; due_date: string | null; status: "pendente" | "em_andamento"; priority: "baixa" | "media" | "alta" | "urgente"; deadline: string | null }[];
    if (!list.length) return { reply: "Você não tem tarefas pendentes. Tudo em dia! ✨", actions };
    const late = list.filter((t) => effectiveStatus(t, today) === "atrasada");
    const lines = list.slice(0, 12).map((t) => `- ${t.title}${t.due_date ? ` (${formatDateBR(t.due_date)})` : ""}${effectiveStatus(t, today) === "atrasada" ? " — **atrasada**" : ""}`);
    return { reply: `Você tem **${list.length}** tarefa(s) pendente(s)${late.length ? `, sendo ${late.length} atrasada(s)` : ""}:\n${lines.join("\n")}${list.length > 12 ? `\n- …e mais ${list.length - 12}` : ""}`, actions };
  }

  if (/quanto (eu )?gastei|meus gastos|gastos d[eo] mes|despesas d[eo] mes|resumo financeiro|saldo/.test(n)) {
    const [{ data: txs }, { data: accounts }, { data: cats }] = await Promise.all([
      sb.from("transactions").select("*").limit(10000),
      sb.from("financial_accounts").select("*"),
      sb.from("categories").select("id,name").eq("scope", "despesa"),
    ]);
    const list = (txs ?? []) as Tx[];
    const s = monthSummary(list, monthStart(today));
    const top = [...categoryBreakdown(list, monthStart(today)).entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, v]) => `- ${(cats ?? []).find((c) => c.id === id)?.name ?? "Sem categoria"}: ${formatCents(v)}`);
    const bills = upcomingBills(list, today, 7);
    return {
      reply: `Neste mês você gastou **${formatCents(s.expense)}** e recebeu **${formatCents(s.income)}**.${(accounts ?? []).length ? ` Saldo disponível: **${formatCents(totalBalance((accounts ?? []) as never, list))}**.` : ""}${top.length ? `\n\nOnde mais gastou:\n${top.join("\n")}` : ""}${bills.length ? `\n\nContas a vencer em 7 dias: ${bills.map((b) => `${b.description} (${formatCents(toCents(b.amount))})`).join(", ")}.` : ""}`,
      actions,
    };
  }

  if (/resumo|revis|como foi (minha|meu)|organiz|prioridad|planej/.test(n)) {
    const period = /mes/.test(n) ? "mes" : /semana/.test(n) || /organiz|planej/.test(n) ? "semana" : "dia";
    const from = period === "dia" ? today : period === "semana" ? startOfWeek(today) : monthStart(today);
    const to = period === "dia" ? today : addDays(from, period === "semana" ? 6 : 30);
    const [{ data: tasks }, { data: events }, { data: txs }] = await Promise.all([
      sb.from("tasks").select("id,title,status,due_date,priority,deadline,completed_at").limit(3000),
      sb.from("events").select("title,starts_at,all_day").is("deleted_at", null).gte("starts_at", zonedToUtc(from, "00:00", tz).toISOString()).lte("starts_at", zonedToUtc(addDays(to, 1), "00:00", tz).toISOString()).order("starts_at"),
      sb.from("transactions").select("*").limit(10000),
    ]);
    const t = (tasks ?? []) as { id: string; title: string; status: "pendente" | "em_andamento" | "concluida" | "cancelada"; due_date: string | null; priority: "baixa" | "media" | "alta" | "urgente"; deadline: string | null; completed_at: string | null }[];
    const late = t.filter((x) => effectiveStatus(x, today) === "atrasada");
    const inPeriod = t.filter((x) => x.due_date && x.due_date >= from && x.due_date <= to && x.status !== "cancelada");
    const done = inPeriod.filter((x) => x.status === "concluida").length;
    const urgent = t.filter((x) => (x.priority === "urgente" || x.priority === "alta") && (x.status === "pendente" || x.status === "em_andamento"));
    const s = monthSummary((txs ?? []) as Tx[], monthStart(today));
    const label = period === "dia" ? "hoje" : period === "semana" ? "nesta semana" : "neste mês";
    const plan = [...late, ...urgent.filter((u) => !late.includes(u))].slice(0, 6).map((x) => `- ${x.title}${effectiveStatus(x, today) === "atrasada" ? " (atrasada)" : ""}`);
    return {
      reply: `**Resumo ${label}:**\n- ${(events ?? []).length} compromisso(s)\n- ${done}/${inPeriod.length} tarefa(s) concluída(s)\n- ${late.length} tarefa(s) atrasada(s)\n- Gastos do mês: ${formatCents(s.expense)} · Entradas: ${formatCents(s.income)}${plan.length ? `\n\n**Sugestão de prioridades:** comece por\n${plan.join("\n")}` : "\n\nNada urgente por aqui. 💜"}`,
      actions,
    };
  }

  if (/lista de compras|lista do mercado/.test(n)) {
    const after = message.split(/:|com /i).slice(1).join(" ");
    const items = after.split(/,| e /).map((s) => s.trim()).filter(Boolean).slice(0, 50);
    if (!items.length) return { reply: "Me diga os itens, por exemplo: “monte uma lista de compras: arroz, feijão, café e leite”.", actions };
    const { data: list } = await sb.from("shopping_lists").insert({ name: "Mercado" }).select("id").single();
    const { error } = await sb.from("shopping_items").insert(items.map((name) => ({ list_id: (list as { id: string }).id, name })));
    actions.push({ tool: "lista", ok: !error, summary: error ? undefined : `Lista “Mercado” com ${items.length} item(ns)`, error: error?.message });
    return { reply: error ? "Não consegui criar a lista." : "Pronto! Sua lista está em Casa › Compras.", actions };
  }

  // ---------- comandos de registro ----------
  const p = parseQuickCommand(message, today);
  const has = (re: RegExp) => re.test(n);
  if (p.intent === "despesa" || p.intent === "receita") {
    if (!p.amountCents) return { reply: "Qual foi o valor? Ex.: “gastei R$ 45,90 no mercado”.", actions };
    const { data: acc } = await sb.from("financial_accounts").select("id").eq("archived", false).order("created_at").limit(1);
    if (!acc?.length) return { reply: "Antes, cadastre sua conta com o saldo atual em Finanças › Contas. Assim seus saldos ficam reais.", actions };
    const { data: cats } = await sb.from("categories").select("id,name").eq("scope", p.intent);
    const cat = (cats ?? []).find((c) => n.includes(norm(c.name)) || norm(p.title).includes(norm(c.name)));
    const { error } = await sb.from("transactions").insert({ type: p.intent, amount: (p.amountCents / 100).toFixed(2), description: p.title.slice(0, 160), category_id: cat?.id ?? null, account_id: acc[0].id, occurred_on: p.date ?? today, status: "pago" });
    actions.push({ tool: "financa", ok: !error, summary: error ? undefined : `${p.intent === "receita" ? "Entrada" : "Gasto"} registrado: ${p.title} — ${formatCents(p.amountCents)}`, error: error?.message });
    return { reply: error ? "Não consegui registrar." : "Registrado! 💜", actions };
  }
  if (p.intent === "compromisso") {
    if (!p.date && !p.time) return { reply: "Para quando? Ex.: “academia amanhã às 7h”.", actions };
    const date = p.date ?? today;
    const start = p.time ? zonedToUtc(date, p.time, tz) : zonedToUtc(date, "00:00", tz);
    const end = p.time ? new Date(start.getTime() + 3600_000) : zonedToUtc(addDays(date, 1), "00:00", tz);
    const { error } = await sb.from("events").insert({ title: p.title.slice(0, 200), starts_at: start.toISOString(), ends_at: end.toISOString(), all_day: !p.time, reminder_minutes: 30 });
    actions.push({ tool: "agenda", ok: !error, summary: error ? undefined : `Compromisso: ${p.title} em ${formatDateBR(date)}${p.time ? ` às ${p.time}` : ""}`, error: error?.message });
    return { reply: error ? "Não consegui agendar." : "Agendado! Te lembro 30 minutos antes. ✨", actions };
  }
  if (p.intent === "sono" && p.durationMinutes) {
    const wake = ctx.wakeTime?.slice(0, 5) ?? "07:00";
    const [h, m] = wake.split(":").map(Number);
    const bedMin = (h * 60 + m - p.durationMinutes + 2880) % 1440;
    const bed = `${String(Math.floor(bedMin / 60)).padStart(2, "0")}:${String(bedMin % 60).padStart(2, "0")}`;
    const { bedAt, wakeAt, duration } = buildSleepInstants(today, bed, wake, tz);
    const { data: ex } = await sb.from("sleep_logs").select("id").eq("sleep_date", today).maybeSingle();
    const values = { sleep_date: today, bed_at: bedAt.toISOString(), wake_at: wakeAt.toISOString(), duration_minutes: duration };
    const { error } = ex ? await sb.from("sleep_logs").update(values).eq("id", (ex as { id: string }).id) : await sb.from("sleep_logs").insert(values);
    actions.push({ tool: "sono", ok: !error, summary: error ? undefined : `Sono registrado: ${Math.floor(duration / 60)}h (${bed} → ${wake})`, error: error?.message });
    return { reply: error ? "Não consegui registrar." : "Anotado! Ajuste os horários em Sono, se quiser. 🌙", actions };
  }
  if (p.intent === "agua" && p.waterMl) {
    const { error } = await sb.from("water_logs").insert({ amount_ml: p.waterMl, log_date: today });
    actions.push({ tool: "agua", ok: !error, summary: error ? undefined : `Água: +${p.waterMl} ml`, error: error?.message });
    return { reply: error ? "Não consegui registrar." : "Boa! Hidratação registrada 💧", actions };
  }
  if (p.intent === "nota") {
    const { error } = await sb.from("notes").insert({ title: p.title.slice(0, 200), content: message, kind: "ideia" });
    actions.push({ tool: "nota", ok: !error, summary: error ? undefined : `Nota criada: ${p.title}`, error: error?.message });
    return { reply: error ? "Não consegui salvar." : "Anotado em Anotações. 📝", actions };
  }
  if (has(/^(oi|ola|bom dia|boa tarde|boa noite)\b/)) return { reply: "Oi! 💜 Posso registrar gastos, compromissos, tarefas, sono e água, ou te mostrar tarefas pendentes, gastos do mês e um resumo da semana.", actions };
  if (has(/lembr|tarefa|preciso|fazer|pagar|comprar|ligar/) || p.date) {
    const { error } = await sb.from("tasks").insert({ title: p.title.slice(0, 200), due_date: p.date ?? today, due_time: p.time ?? null, reminder_minutes: p.time ? 0 : null });
    actions.push({ tool: "tarefa", ok: !error, summary: error ? undefined : `Tarefa: ${p.title}${p.date ? ` (${formatDateBR(p.date)})` : ""}`, error: error?.message });
    return { reply: error ? "Não consegui criar a tarefa." : "Tarefa criada! ✅", actions };
  }
  return {
    reply: "No modo básico eu entendo comandos simples. Experimente:\n- “gastei 45,90 no mercado”\n- “academia amanhã às 7h”\n- “lembre-me de pagar a internet dia 10”\n- “quais tarefas estão pendentes?”\n- “quanto gastei este mês?”\n- “faça um resumo da minha semana”",
    actions,
  };
}
