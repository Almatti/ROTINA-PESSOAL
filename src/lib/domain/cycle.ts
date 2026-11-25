import { addDays, diffDays, type ISODate } from "./dates";

export interface Period {
  start_date: ISODate;
  end_date: ISODate | null;
}

export const CYCLE_DISCLAIMER =
  "As previsões são estimativas baseadas no seu histórico e podem variar. Não utilize como método contraceptivo nem como diagnóstico.";

/** Duração média do ciclo (início a início), considerando os últimos 6 ciclos válidos (15–60 dias). */
export function averageCycleLength(periods: Period[]): number | null {
  const starts = [...new Set(periods.map((p) => p.start_date))].sort();
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const len = diffDays(starts[i], starts[i - 1]);
    if (len >= 15 && len <= 60) lengths.push(len);
  }
  const recent = lengths.slice(-6);
  if (!recent.length) return null;
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
}

export function averagePeriodLength(periods: Period[]): number | null {
  const lens = periods
    .filter((p) => p.end_date)
    .map((p) => diffDays(p.end_date!, p.start_date) + 1)
    .filter((l) => l >= 1 && l <= 15)
    .slice(-6);
  if (!lens.length) return null;
  return Math.round(lens.reduce((a, b) => a + b, 0) / lens.length);
}

export interface CyclePrediction {
  cycleLength: number;
  periodLength: number;
  nextStart: ISODate;
  nextEnd: ISODate;
  fertileStart: ISODate;
  fertileEnd: ISODate;
  currentDay: number | null; // dia do ciclo atual
  basedOnHistory: boolean;
}

/** Previsão estimada. Com menos de 2 ciclos, usa 28/5 dias como padrão (sinalizado). */
export function predictCycle(periods: Period[], today: ISODate): CyclePrediction | null {
  if (!periods.length) return null;
  const sorted = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const last = sorted[sorted.length - 1];
  const avg = averageCycleLength(sorted);
  const cycleLength = avg ?? 28;
  const periodLength = averagePeriodLength(sorted) ?? 5;
  let nextStart = addDays(last.start_date, cycleLength);
  while (nextStart < addDays(today, -periodLength)) nextStart = addDays(nextStart, cycleLength);
  const ovulation = addDays(nextStart, -14);
  const currentDay = today >= last.start_date ? (diffDays(today, last.start_date) % cycleLength) + 1 : null;
  return {
    cycleLength,
    periodLength,
    nextStart,
    nextEnd: addDays(nextStart, periodLength - 1),
    fertileStart: addDays(ovulation, -5),
    fertileEnd: addDays(ovulation, 1),
    currentDay,
    basedOnHistory: avg !== null,
  };
}

/** Dias marcados no calendário: menstruação registrada e prevista. */
export function cycleCalendarMarks(periods: Period[], prediction: CyclePrediction | null, from: ISODate, to: ISODate) {
  const marks = new Map<ISODate, "menstruacao" | "previsao" | "fertil">();
  if (prediction) {
    for (let d = prediction.fertileStart; d <= prediction.fertileEnd; d = addDays(d, 1)) if (d >= from && d <= to) marks.set(d, "fertil");
    for (let d = prediction.nextStart; d <= prediction.nextEnd; d = addDays(d, 1)) if (d >= from && d <= to) marks.set(d, "previsao");
  }
  for (const p of periods) {
    const end = p.end_date ?? addDays(p.start_date, (prediction?.periodLength ?? 5) - 1);
    for (let d = p.start_date; d <= end; d = addDays(d, 1)) if (d >= from && d <= to) marks.set(d, "menstruacao");
  }
  return marks;
}
