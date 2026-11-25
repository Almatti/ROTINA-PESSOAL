import { addDays, addMonths, diffDays, weekdayOf, type ISODate } from "./dates";

export type RecurrenceFreq = "diaria" | "semanal" | "mensal" | "anual";

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval?: number; // a cada N períodos
  weekdays?: number[]; // para semanal: 0=dom..6=sáb
  until?: ISODate | null;
  count?: number | null;
}

export function describeRecurrence(rule: RecurrenceRule | null | undefined): string {
  if (!rule) return "Não se repete";
  const n = rule.interval ?? 1;
  const names = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  switch (rule.freq) {
    case "diaria":
      return n === 1 ? "Todos os dias" : `A cada ${n} dias`;
    case "semanal": {
      const days = rule.weekdays?.length ? ` (${rule.weekdays.map((d) => names[d]).join(", ")})` : "";
      return (n === 1 ? "Toda semana" : `A cada ${n} semanas`) + days;
    }
    case "mensal":
      return n === 1 ? "Todo mês" : `A cada ${n} meses`;
    case "anual":
      return n === 1 ? "Todo ano" : `A cada ${n} anos`;
  }
}

/**
 * Lista as ocorrências (datas) de uma regra começando em `start`,
 * dentro do intervalo [from, to]. Limite de segurança de 1000 ocorrências.
 */
export function occurrences(rule: RecurrenceRule, start: ISODate, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const interval = Math.max(1, rule.interval ?? 1);
  const until = rule.until && rule.until < to ? rule.until : to;
  const max = rule.count ?? Infinity;
  let produced = 0;
  const startDay = Number(start.slice(8, 10));

  if (rule.freq === "semanal" && rule.weekdays && rule.weekdays.length) {
    const days = [...new Set(rule.weekdays)].sort();
    // percorre dia a dia a partir do início, respeitando o intervalo de semanas
    for (let d = start, guard = 0; d <= until && guard < 5000; d = addDays(d, 1), guard++) {
      const weekIndex = Math.floor(diffDays(d, addDays(start, -weekdayOf(start))) / 7);
      if (weekIndex % interval !== 0) continue;
      if (!days.includes(weekdayOf(d))) continue;
      produced++;
      if (produced > max) break;
      if (d >= from) out.push(d);
      if (out.length >= 1000) break;
    }
    return out;
  }

  for (let i = 0, guard = 0; guard < 5000; i++, guard++) {
    let d: ISODate;
    switch (rule.freq) {
      case "diaria":
        d = addDays(start, i * interval);
        break;
      case "semanal":
        d = addDays(start, i * 7 * interval);
        break;
      case "mensal":
        d = addMonths(start, i * interval, startDay);
        break;
      case "anual":
        d = addMonths(start, i * 12 * interval, startDay);
        break;
    }
    if (d > until) break;
    produced++;
    if (produced > max) break;
    if (d >= from) out.push(d);
    if (out.length >= 1000) break;
  }
  return out;
}

/** Próxima ocorrência estritamente depois de `after`. */
export function nextOccurrence(rule: RecurrenceRule, start: ISODate, after: ISODate): ISODate | null {
  const horizon = addDays(after, 400 * Math.max(1, rule.interval ?? 1));
  const list = occurrences(rule, start, addDays(after, 1), horizon);
  return list[0] ?? null;
}
