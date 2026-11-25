import { addDays, localDateISO, localTimeHHMM, zonedToUtc, rangeDays } from "@/lib/domain/dates";
import { occurrences } from "@/lib/domain/recurrence";
import type { CalendarEvent } from "@/lib/types";

export type Occurrence = CalendarEvent & { occStart: string; occEnd: string; occDate: string };

/** Expande compromissos (inclusive recorrentes) em ocorrências dentro de [from, to] (datas locais). */
export function expandEvents(events: CalendarEvent[], from: string, to: string, tz: string): Occurrence[] {
  const rangeStart = zonedToUtc(from, "00:00", tz).getTime();
  const rangeEnd = zonedToUtc(addDays(to, 1), "00:00", tz).getTime();
  const out: Occurrence[] = [];
  for (const e of events) {
    if (e.deleted_at) continue;
    const s = new Date(e.starts_at).getTime();
    const dur = Math.max(0, new Date(e.ends_at).getTime() - s);
    if (e.recurrence) {
      const base = localDateISO(new Date(s), tz);
      const time = localTimeHHMM(new Date(s), tz);
      for (const d of occurrences(e.recurrence, base, from, to)) {
        const occS = zonedToUtc(d, e.all_day ? "00:00" : time, tz);
        out.push({ ...e, occStart: occS.toISOString(), occEnd: new Date(occS.getTime() + dur).toISOString(), occDate: d });
      }
    } else if (s < rangeEnd && s + Math.max(dur, 1) > rangeStart) {
      out.push({ ...e, occStart: e.starts_at, occEnd: e.ends_at, occDate: localDateISO(new Date(s), tz) });
    }
  }
  return out.sort((a, b) => a.occStart.localeCompare(b.occStart));
}

export function eventsOnDay(events: CalendarEvent[], day: string, tz: string): Occurrence[] {
  const dayStart = zonedToUtc(day, "00:00", tz).getTime();
  const dayEnd = zonedToUtc(addDays(day, 1), "00:00", tz).getTime();
  return expandEvents(events, addDays(day, -31), day, tz).filter((o) => {
    const s = new Date(o.occStart).getTime();
    const e = Math.max(new Date(o.occEnd).getTime(), s + 1);
    return s < dayEnd && e > dayStart;
  });
}

/** Mapa dia → quantidade de ocorrências (para marcar calendários). */
export function countByDay(occ: Occurrence[], from: string, to: string, tz: string) {
  const map: Record<string, number> = {};
  for (const o of occ) {
    const sd = localDateISO(new Date(o.occStart), tz);
    const ed = localDateISO(new Date(Math.max(new Date(o.occEnd).getTime() - 1, new Date(o.occStart).getTime())), tz);
    for (const d of rangeDays(sd < from ? from : sd, ed > to ? to : ed)) map[d] = (map[d] ?? 0) + 1;
  }
  return map;
}
