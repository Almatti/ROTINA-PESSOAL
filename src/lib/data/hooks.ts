"use client";
import { useQuery } from "./store";
import type {
  Category, Task, CalendarEvent, Habit, HabitLog, FinancialAccount, CreditCard, Transaction, RecurringTransaction,
  Budget, Goal, SleepLogRow, MoodLog, WaterLog, NotificationRow,
} from "@/lib/types";

export function useCategories(scope?: Category["scope"]) {
  const q = useQuery<Category[]>("categories", (sb) => sb.from("categories").select("*").order("name"), { tables: ["categories"], table: "categories" });
  return { ...q, data: (q.data ?? []).filter((c) => !scope || c.scope === scope) };
}

export function useTasks(opts: { from?: string; to?: string; includeDone?: boolean; key?: string } = {}) {
  const key = `tasks:${opts.key ?? `${opts.from ?? ""}:${opts.to ?? ""}:${opts.includeDone ? 1 : 0}`}`;
  return useQuery<Task[]>(
    key,
    (sb) => {
      let q = sb.from("tasks").select("*, subtasks(*)").order("position").order("created_at");
      if (opts.from) q = q.gte("due_date", opts.from);
      if (opts.to) q = q.lte("due_date", opts.to);
      if (!opts.includeDone) q = q.in("status", ["pendente", "em_andamento"]);
      return q.limit(1000);
    },
    { tables: ["tasks", "subtasks"], table: "tasks" },
  );
}

/** Tarefas do dia + atrasadas + sem data abertas (plano do dia). */
export function useTodayTasks(today: string) {
  return useQuery<Task[]>(
    `tasks:today:${today}`,
    (sb) =>
      sb
        .from("tasks")
        .select("*, subtasks(*)")
        .or(`due_date.eq.${today},and(due_date.lt.${today},status.in.(pendente,em_andamento)),and(due_date.is.null,status.in.(pendente,em_andamento))`)
        .neq("status", "cancelada")
        .order("due_time", { ascending: true, nullsFirst: false })
        .limit(300),
    { tables: ["tasks", "subtasks"], table: "tasks" },
  );
}

export function useEvents(fromISO: string, toISO: string) {
  return useQuery<CalendarEvent[]>(
    `events:${fromISO}:${toISO}`,
    (sb) =>
      sb
        .from("events")
        .select("*")
        .is("deleted_at", null)
        .or(`and(starts_at.lte.${toISO},ends_at.gte.${fromISO}),recurrence.not.is.null`)
        .order("starts_at")
        .limit(2000),
    { tables: ["events"], table: "events" },
  );
}

export function useHabits() {
  return useQuery<Habit[]>("habits", (sb) => sb.from("habits").select("*").eq("archived", false).order("position").order("created_at"), { tables: ["habits"], table: "habits" });
}

export function useHabitLogs(from: string, to: string) {
  return useQuery<HabitLog[]>(`habit_logs:${from}:${to}`, (sb) => sb.from("habit_logs").select("*").gte("log_date", from).lte("log_date", to).limit(5000), { tables: ["habit_logs"], table: "habit_logs" });
}

export function useAccounts() {
  return useQuery<FinancialAccount[]>("accounts", (sb) => sb.from("financial_accounts").select("*").order("created_at"), { tables: ["financial_accounts"], table: "financial_accounts" });
}

export function useCards() {
  return useQuery<CreditCard[]>("cards", (sb) => sb.from("credit_cards").select("*").order("created_at"), { tables: ["credit_cards"], table: "credit_cards" });
}

/** Todas as transações (necessário para saldos corretos). Limitado a 10 mil linhas. */
export function useTransactions() {
  return useQuery<Transaction[]>("transactions", (sb) => sb.from("transactions").select("*").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(10000), { tables: ["transactions"], table: "transactions" });
}

export function useRecurring() {
  return useQuery<RecurringTransaction[]>("recurring", (sb) => sb.from("recurring_transactions").select("*").order("description"), { tables: ["recurring_transactions"], table: "recurring_transactions" });
}

export function useBudgets(month: string) {
  return useQuery<Budget[]>(`budgets:${month}`, (sb) => sb.from("budgets").select("*").eq("month", month), { tables: ["budgets"], table: "budgets" });
}

export function useGoals() {
  return useQuery<Goal[]>("goals", (sb) => sb.from("goals").select("*, goal_steps(*)").order("created_at", { ascending: false }), { tables: ["goals", "goal_steps"], table: "goals" });
}

export function useSleepLogs(days = 90) {
  return useQuery<SleepLogRow[]>(`sleep:${days}`, (sb) => sb.from("sleep_logs").select("*").order("sleep_date", { ascending: false }).limit(days), { tables: ["sleep_logs"], table: "sleep_logs" });
}

export function useMoodLogs(from: string, to: string) {
  return useQuery<MoodLog[]>(`mood:${from}:${to}`, (sb) => sb.from("mood_logs").select("*").gte("log_date", from).lte("log_date", to).order("log_date"), { tables: ["mood_logs"], table: "mood_logs" });
}

export function useWaterLogs(from: string, to: string) {
  return useQuery<WaterLog[]>(`water:${from}:${to}`, (sb) => sb.from("water_logs").select("*").gte("log_date", from).lte("log_date", to).order("logged_at"), { tables: ["water_logs"], table: "water_logs" });
}

export function useNotifications() {
  return useQuery<NotificationRow[]>("notifications", (sb) => sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(100), { tables: ["notifications"], table: "notifications" });
}

export function usePoints() {
  const q = useQuery<{ points: number }[]>("points", (sb) => sb.from("point_events").select("points").limit(10000), { tables: ["point_events"] });
  return { ...q, total: (q.data ?? []).reduce((s, r) => s + r.points, 0) };
}

/** Generic list for simpler modules. */
export function useTable<T>(table: string, opts: { order?: string; ascending?: boolean; filter?: Record<string, string | number | boolean>; select?: string; key?: string; limit?: number } = {}) {
  const key = `${table}:${opts.key ?? JSON.stringify(opts)}`;
  return useQuery<T[]>(
    key,
    (sb) => {
      let q = sb.from(table).select(opts.select ?? "*");
      for (const [k, v] of Object.entries(opts.filter ?? {})) q = q.eq(k, v);
      if (opts.order) q = q.order(opts.order, { ascending: opts.ascending ?? true });
      return q.limit(opts.limit ?? 2000) as unknown as PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>;
    },
    { tables: [table], table },
  );
}
