import { addDays, diffDays, type ISODate, timeToMinutes, zonedToUtc, DEFAULT_TZ } from "./dates";

export interface SleepLog {
  sleep_date: ISODate; // dia em que acordou
  bed_at: string;
  wake_at: string;
  duration_minutes: number;
  quality?: number | null;
}

/**
 * Duração entre os horários de dormir e acordar (HH:MM), atravessando a
 * meia-noite quando acordar <= dormir. Ex.: 23:00 → 07:00 = 480 min.
 */
export function durationFromTimes(bed: string, wake: string): number {
  const b = timeToMinutes(bed);
  const w = timeToMinutes(wake);
  const diff = w - b;
  return diff > 0 ? diff : diff + 1440;
}

/**
 * Monta os instantes de dormir/acordar a partir da data em que acordou.
 * Se o horário de dormir for maior que o de acordar, dormiu no dia anterior.
 */
export function buildSleepInstants(wakeDate: ISODate, bed: string, wake: string, tz = DEFAULT_TZ) {
  const crossesMidnight = timeToMinutes(bed) >= timeToMinutes(wake);
  const bedDate = crossesMidnight ? addDays(wakeDate, -1) : wakeDate;
  const bedAt = zonedToUtc(bedDate, bed, tz);
  const wakeAt = zonedToUtc(wakeDate, wake, tz);
  return { bedAt, wakeAt, duration: Math.round((wakeAt.getTime() - bedAt.getTime()) / 60000) };
}

export interface SleepStats {
  last: SleepLog | null;
  weekAvg: number | null;
  monthAvg: number | null;
  best: SleepLog | null;
  nightsOnGoal: number; // nos últimos 30 dias
  streakOnGoal: number; // noites seguidas na meta até a última registrada
  debtMinutes: number; // déficit acumulado nos últimos 7 dias (positivo = déficit)
}

export function sleepStats(logs: SleepLog[], goalMinutes: number, today: ISODate): SleepStats {
  const sorted = [...logs].sort((a, b) => b.sleep_date.localeCompare(a.sleep_date));
  const within = (days: number) => sorted.filter((l) => diffDays(today, l.sleep_date) < days && l.sleep_date <= today);
  const avg = (arr: SleepLog[]) => (arr.length ? Math.round(arr.reduce((s, l) => s + l.duration_minutes, 0) / arr.length) : null);
  const week = within(7);
  const month = within(30);
  let streak = 0;
  let expected = sorted[0]?.sleep_date;
  for (const l of sorted) {
    if (l.sleep_date !== expected || l.duration_minutes < goalMinutes) break;
    streak++;
    expected = addDays(expected, -1);
  }
  const debt = week.reduce((s, l) => s + (goalMinutes - l.duration_minutes), 0);
  return {
    last: sorted[0] ?? null,
    weekAvg: avg(week),
    monthAvg: avg(month),
    best: month.reduce<SleepLog | null>((b, l) => (!b || l.duration_minutes > b.duration_minutes ? l : b), null),
    nightsOnGoal: month.filter((l) => l.duration_minutes >= goalMinutes).length,
    streakOnGoal: streak,
    debtMinutes: Math.max(0, debt),
  };
}
