"use client";
/** Ações de domínio no cliente (usam a fila offline via mutate). */
import { mutate, newId, invalidate } from "./store";
import { getSupabase } from "@/lib/supabase/client";
import { nextOccurrence } from "@/lib/domain/recurrence";
import { buildInstallments, invoiceMonthFor } from "@/lib/domain/finance";
import { POINTS } from "@/lib/domain/gamification";
import type { Task, Habit, HabitLog, CreditCard } from "@/lib/types";
import type { TransactionInput } from "@/lib/validation/entities";

/** Pontua (idempotente por dedupe) e tenta desbloquear conquistas relacionadas. Nunca falha a ação principal. */
export async function award(source: keyof typeof POINTS, dedupe: string) {
  try {
    if (!navigator.onLine) return;
    const sb = getSupabase();
    await sb.rpc("award_points", { p_source: source, p_points: POINTS[source], p_dedupe: dedupe });
    invalidate("point_events");
  } catch {
    // pontuação é opcional
  }
}

export async function unlock(key: string) {
  try {
    if (!navigator.onLine) return false;
    const { error } = await getSupabase().from("user_achievements").insert({ achievement_key: key });
    if (!error) {
      invalidate("user_achievements");
      return true;
    }
  } catch {}
  return false;
}

/** Conclui/reabre uma tarefa. Recorrentes geram a próxima ocorrência. */
export async function setTaskDone(task: Task, done: boolean, today: string) {
  await mutate({
    action: "update",
    table: "tasks",
    id: task.id,
    values: { status: done ? "concluida" : "pendente", completed_at: done ? new Date().toISOString() : null },
  });
  if (done && task.recurrence) {
    const base = task.due_date ?? today;
    const rootId = task.recurrence_parent_id ?? task.id;
    const next = nextOccurrence(task.recurrence, base, base);
    if (next) {
      const { data: existing } = navigator.onLine
        ? await getSupabase().from("tasks").select("id").eq("recurrence_parent_id", rootId).eq("due_date", next).limit(1)
        : { data: [] };
      if (!existing?.length) {
        await mutate({
          action: "insert",
          table: "tasks",
          values: {
            title: task.title, description: task.description, notes: task.notes, category_id: task.category_id, area: task.area,
            project_id: task.project_id, due_date: next, due_time: task.due_time, priority: task.priority, recurrence: task.recurrence,
            recurrence_parent_id: rootId, reminder_minutes: task.reminder_minutes, estimated_minutes: task.estimated_minutes, tags: task.tags,
          },
        });
      }
    }
  }
  if (done) {
    await award("tarefa", `tarefa:${task.id}`);
    void checkTaskAchievements();
  }
}

async function checkTaskAchievements() {
  if (!navigator.onLine) return;
  const { count } = await getSupabase().from("tasks").select("id", { count: "exact", head: true }).eq("status", "concluida");
  if ((count ?? 0) >= 1) await unlock("primeira_tarefa");
  if ((count ?? 0) >= 10) await unlock("tarefas_10");
  if ((count ?? 0) >= 50) await unlock("tarefas_50");
}

export async function toggleSubtask(id: string, done: boolean) {
  await mutate({ action: "update", table: "subtasks", id, values: { done } });
  invalidate("tasks");
}

/** Registra progresso de um hábito em uma data (upsert por hábito+data). */
export async function logHabit(habit: Habit, date: string, patch: { value?: number; checklist_done?: string[] }, existing?: HabitLog) {
  const value = patch.value ?? existing?.value ?? 0;
  const checklist = patch.checklist_done ?? existing?.checklist_done ?? [];
  const checklistComplete = habit.checklist.length > 0 && habit.checklist.every((c) => checklist.includes(c.id));
  const completed = habit.checklist.length > 0 ? checklistComplete : value >= Number(habit.target_value);
  await mutate({
    action: "upsert",
    table: "habit_logs",
    onConflict: "habit_id,log_date",
    values: { id: existing?.id ?? newId(), habit_id: habit.id, log_date: date, value, checklist_done: checklist, completed },
  });
  if (completed) await award("habito", `habito:${habit.id}:${date}`);
  return completed;
}

export async function addWater(ml: number, date: string) {
  await mutate({ action: "insert", table: "water_logs", values: { amount_ml: ml, log_date: date, logged_at: new Date().toISOString() } });
}

/** Cria movimentação(ões) financeira(s), incluindo parcelamento no cartão. */
export async function createTransaction(input: TransactionInput, cards: CreditCard[]) {
  const { installments, ...t } = input;
  const card = t.card_id ? cards.find((c) => c.id === t.card_id) : undefined;
  const base = {
    type: t.type,
    description: t.description,
    category_id: t.category_id ?? null,
    account_id: t.type === "despesa" && t.card_id ? null : t.account_id ?? null,
    to_account_id: t.type === "transferencia" ? t.to_account_id : null,
    card_id: t.card_id ?? null,
    status: t.card_id && t.type === "despesa" ? "pago" : t.status,
    is_fixed: t.is_fixed,
    due_date: t.due_date ?? null,
    notes: t.notes ?? null,
  };
  if (card && t.type === "despesa" && installments > 1) {
    const group = newId();
    const rows = buildInstallments(t.amount, installments, t.occurred_on, card.closing_day).map((r) => ({
      ...base,
      ...r,
      description: `${t.description} (${r.installment_number}/${r.installment_total})`,
      installment_group: group,
    }));
    await mutate({ action: "insert", table: "transactions", values: rows });
  } else {
    await mutate({
      action: "insert",
      table: "transactions",
      values: {
        ...base,
        amount: t.amount.toFixed(2),
        occurred_on: t.occurred_on,
        invoice_month: card ? (t.type === "pagamento_fatura" ? (input as TransactionInput & { invoice_month?: string }).invoice_month ?? invoiceMonthFor(t.occurred_on, card.closing_day) : invoiceMonthFor(t.occurred_on, card.closing_day)) : null,
      },
    });
  }
  await award("financa", `financa:${t.occurred_on}`);
  void unlock("financas_primeiro");
}
