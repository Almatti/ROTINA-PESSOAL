/**
 * Utilitários de data com fuso horário explícito (padrão America/Sao_Paulo).
 * Datas "de calendário" trafegam como strings ISO 'YYYY-MM-DD' para evitar
 * erros de fuso; instantes trafegam como Date/ISO com offset.
 */
export const DEFAULT_TZ = "America/Sao_Paulo";

export type ISODate = string; // YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, "0");

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0=domingo
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, tz = DEFAULT_TZ): ZonedParts {
  const parts = Object.fromEntries(dtf(tz).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday as string] ?? 0,
  };
}

/** Data local (no fuso) de um instante. */
export function localDateISO(date: Date = new Date(), tz = DEFAULT_TZ): ISODate {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function localTimeHHMM(date: Date, tz = DEFAULT_TZ): string {
  const p = zonedParts(date, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Converte data+hora locais de um fuso em instante UTC (lida com horário de verão). */
export function zonedToUtc(dateISO: ISODate, time = "00:00", tz = DEFAULT_TZ): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  let guess = asUtc;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), tz);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const diff = shown - asUtc;
    if (diff === 0) break;
    guess -= diff;
  }
  return new Date(guess);
}

function toUTCDate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fromUTCDate(d: Date): ISODate {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return fromUTCDate(toUTCDate(s)) === s;
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = toUTCDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTCDate(d);
}

/** Soma meses mantendo o dia quando possível (31/01 + 1 mês = 28/29 fev). */
export function addMonths(iso: ISODate, n: number, preferredDay?: number): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const day = Math.min(preferredDay ?? d, daysInMonth(ny, nm));
  return `${ny}-${pad(nm)}-${pad(day)}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTCDate(a).getTime() - toUTCDate(b).getTime()) / 86400000);
}

export function weekdayOf(iso: ISODate): number {
  return toUTCDate(iso).getUTCDay();
}

/** Início da semana (domingo por padrão, como nas referências). */
export function startOfWeek(iso: ISODate, weekStartsOn = 0): ISODate {
  const wd = weekdayOf(iso);
  return addDays(iso, -((wd - weekStartsOn + 7) % 7));
}

export function monthStart(iso: ISODate): ISODate {
  return iso.slice(0, 8) + "01";
}

export function monthEnd(iso: ISODate): ISODate {
  const [y, m] = iso.split("-").map(Number);
  return `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`;
}

export function rangeDays(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Grade de calendário mensal (semanas completas, começa no domingo). */
export function monthGrid(iso: ISODate): ISODate[] {
  const first = monthStart(iso);
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(monthEnd(iso)), 6);
  return rangeDays(start, end);
}

export const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const WEEKDAY_LETTER = ["D", "S", "T", "Q", "Q", "S", "S"];
export const WEEKDAY_LONG = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** DD/MM/AAAA */
export function formatDateBR(iso: ISODate | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** DD/MM */
export function formatDayMonth(iso: ISODate): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** "Seg, 22 set" */
export function formatShortLabel(iso: ISODate): string {
  const wd = WEEKDAY_SHORT[weekdayOf(iso)];
  const [, m, d] = iso.split("-").map(Number);
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${d} ${MONTHS_SHORT[m - 1]}`;
}

export function formatMonthYear(iso: ISODate): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1].charAt(0).toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`;
}

/** Converte "DD/MM/AAAA" em ISO; retorna null se inválida. */
export function parseDateBR(s: string): ISODate | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return isValidISODate(iso) ? iso : null;
}

export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function periodOfTime(time: string | null | undefined): "manha" | "tarde" | "noite" | "sem_horario" {
  if (!time) return "sem_horario";
  const h = Number(time.slice(0, 2));
  if (h < 12) return "manha";
  if (h < 18) return "tarde";
  return "noite";
}

export function minutesToLabel(min: number): string {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(Math.round(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}min`;
  return m === 0 ? `${sign}${h}h` : `${sign}${h}h${pad(m)}`;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
