import { addDays, diffDays, startOfWeek, weekdayOf, type ISODate } from "./dates";

export type HabitFrequency =
  | { type: "daily" }
  | { type: "weekdays"; days: number[] } // dias específicos da semana
  | { type: "times_per_week"; times: number }
  | { type: "every_n_days"; n: number };

export interface HabitLike {
  id: string;
  frequency: HabitFrequency;
  target_value: number | string;
  started_on: ISODate;
  kind?: "construir" | "largar";
}

export interface HabitLogLike {
  habit_id: string;
  log_date: ISODate;
  value: number | string;
  completed: boolean;
}

export function describeFrequency(f: HabitFrequency): string {
  const names = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  switch (f.type) {
    case "daily":
      return "Todos os dias";
    case "weekdays":
      return f.days.length === 7 ? "Todos os dias" : f.days.map((d) => names[d]).join(", ");
    case "times_per_week":
      return `${f.times}x por semana`;
    case "every_n_days":
      return `A cada ${f.n} dias`;
  }
}

/** O hábito está agendado para esta data? (times_per_week: qualquer dia conta) */
export function isScheduledOn(h: HabitLike, date: ISODate): boolean {
  if (date < h.started_on) return false;
  const f = h.frequency;
  switch (f.type) {
    case "daily":
    case "times_per_week":
      return true;
    case "weekdays":
      return f.days.includes(weekdayOf(date));
    case "every_n_days":
      return diffDays(date, h.started_on) % Math.max(1, f.n) === 0;
  }
}

export function isCompleted(h: HabitLike, log: HabitLogLike | undefined): boolean {
  if (!log) return false;
  return log.completed || Number(log.value) >= Number(h.target_value);
}

function logMap(logs: HabitLogLike[], habitId: string) {
  const m = new Map<ISODate, HabitLogLike>();
  for (const l of logs) if (l.habit_id === habitId) m.set(l.log_date, l);
  return m;
}

/**
 * Sequência atual (dias consecutivos agendados e concluídos).
 * O dia de hoje ainda não concluído NÃO quebra a sequência (sem punição antecipada).
 * Para "x vezes por semana", a sequência é contada em semanas que bateram a meta.
 */
export function currentStreak(h: HabitLike, logs: HabitLogLike[], today: ISODate): number {
  const m = logMap(logs, h.id);
  if (h.frequency.type === "times_per_week") {
    const times = h.frequency.times;
    let weeks = 0;
    let ws = startOfWeek(today);
    const countWeek = (start: ISODate) => {
      let c = 0;
      for (let i = 0; i < 7; i++) if (isCompleted(h, m.get(addDays(start, i)))) c++;
      return c;
    };
    if (countWeek(ws) >= times) weeks++;
    ws = addDays(ws, -7);
    while (ws >= startOfWeek(h.started_on) && countWeek(ws) >= times) {
      weeks++;
      ws = addDays(ws, -7);
    }
    return weeks;
  }
  let streak = 0;
  let d = today;
  if (!isCompleted(h, m.get(d))) d = addDays(d, -1);
  for (let guard = 0; guard < 3660 && d >= h.started_on; guard++, d = addDays(d, -1)) {
    if (!isScheduledOn(h, d)) continue;
    if (isCompleted(h, m.get(d))) streak++;
    else break;
  }
  return streak;
}

export function bestStreak(h: HabitLike, logs: HabitLogLike[], today: ISODate): number {
  const m = logMap(logs, h.id);
  let best = 0, cur = 0;
  for (let d = h.started_on; d <= today; d = addDays(d, 1)) {
    if (!isScheduledOn(h, d)) continue;
    if (isCompleted(h, m.get(d))) {
      cur++;
      best = Math.max(best, cur);
    } else if (d !== today) cur = 0;
  }
  return best;
}

/** Taxa de conclusão (%) nos últimos `days` dias agendados. */
export function completionRate(h: HabitLike, logs: HabitLogLike[], today: ISODate, days = 30): number {
  const m = logMap(logs, h.id);
  let scheduled = 0, done = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    if (d < h.started_on) break;
    if (h.frequency.type === "times_per_week") {
      scheduled += h.frequency.times / 7;
    } else if (!isScheduledOn(h, d)) continue;
    else scheduled++;
    if (isCompleted(h, m.get(d))) done++;
  }
  if (!scheduled) return 0;
  return Math.min(100, Math.round((done / scheduled) * 100));
}

/** Para hábitos de "largar": dias desde o início/última recaída. */
export function daysFree(startedOn: ISODate, relapses: ISODate[], today: ISODate): number {
  const last = [...relapses, startedOn].filter((d) => d <= today).sort().pop()!;
  return Math.max(0, diffDays(today, last));
}
