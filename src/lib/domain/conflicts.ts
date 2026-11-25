export interface TimedItem {
  id: string;
  title: string;
  starts_at: string | Date;
  ends_at: string | Date;
  all_day?: boolean;
}

const t = (v: string | Date) => (v instanceof Date ? v.getTime() : new Date(v).getTime());

/** Dois compromissos com horário se sobrepõem? (encostar não é conflito) */
export function overlaps(a: TimedItem, b: TimedItem): boolean {
  if (a.all_day || b.all_day) return false;
  return t(a.starts_at) < t(b.ends_at) && t(b.starts_at) < t(a.ends_at);
}

/** Lista pares em conflito (O(n log n) com varredura ordenada). */
export function findConflicts(items: TimedItem[]): [TimedItem, TimedItem][] {
  const sorted = items.filter((i) => !i.all_day).sort((a, b) => t(a.starts_at) - t(b.starts_at));
  const out: [TimedItem, TimedItem][] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && t(sorted[j].starts_at) < t(sorted[i].ends_at); j++) {
      if (overlaps(sorted[i], sorted[j])) out.push([sorted[i], sorted[j]]);
    }
  }
  return out;
}

export function conflictsWith(candidate: TimedItem, items: TimedItem[]): TimedItem[] {
  return items.filter((i) => i.id !== candidate.id && overlaps(candidate, i));
}
