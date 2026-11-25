import { addDays, addMonths, isValidISODate, weekdayOf, type ISODate } from "./dates";
import { parseBRL, type Cents } from "./money";

/**
 * Interpretador leve de linguagem natural em português para a "Nova ação"
 * (funciona offline, sem IA). A assistente Vilma usa o modelo de IA para
 * casos complexos; este parser cobre os padrões mais comuns.
 */

const WEEKDAY_WORDS: [RegExp, number][] = [
  [/\bdomingo\b/, 0],
  [/\bsegunda(-feira)?\b/, 1],
  [/\bter[cç]a(-feira)?\b/, 2],
  [/\bquarta(-feira)?\b/, 3],
  [/\bquinta(-feira)?\b/, 4],
  [/\bsexta(-feira)?\b/, 5],
  [/\bs[aá]bado\b/, 6],
];

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, "três": 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12,
};

function strip(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export interface ParsedDate {
  date: ISODate | null;
  match: string | null;
}

export function parseRelativeDate(text: string, today: ISODate): ParsedDate {
  const s = text.toLowerCase();
  const n = strip(text);
  const rel = n.match(/\b(depois de amanha|amanha|hoje|ontem)\b/);
  if (rel) {
    const offset = { "depois de amanha": 2, amanha: 1, hoje: 0, ontem: -1 }[rel[1] as "hoje"];
    const original = text.substr(n.indexOf(rel[1]), rel[1].length);
    return { date: addDays(today, offset), match: original };
  }
  const inDays = n.match(/\bdaqui a (\d+|\w+) dias?\b/);
  if (inDays) {
    const k = Number(inDays[1]) || NUMBER_WORDS[inDays[1]];
    if (k) return { date: addDays(today, k), match: inDays[0] };
  }
  if (/\bproxima semana\b/.test(n)) return { date: addDays(today, 7 - weekdayOf(today) + 1), match: "próxima semana" };
  const dm = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (dm) {
    let y = dm[3] ? Number(dm[3]) : Number(today.slice(0, 4));
    if (y < 100) y += 2000;
    const iso = `${y}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
    if (isValidISODate(iso)) {
      const final = !dm[3] && iso < today ? `${y + 1}${iso.slice(4)}` : iso;
      return { date: final, match: dm[0] };
    }
  }
  const day = s.match(/\bdia (\d{1,2})\b/);
  if (day) {
    const d = Number(day[1]);
    let iso = `${today.slice(0, 8)}${String(d).padStart(2, "0")}`;
    if (!isValidISODate(iso) || iso < today) iso = addMonths(today.slice(0, 8) + "01", 1, d);
    return { date: iso, match: day[0] };
  }
  for (const [re, wd] of WEEKDAY_WORDS) {
    const m = n.match(re) || s.match(re);
    if (m) {
      let diff = (wd - weekdayOf(today) + 7) % 7;
      if (diff === 0) diff = 7;
      return { date: addDays(today, diff), match: m[0] };
    }
  }
  return { date: null, match: null };
}

export function parseTime(text: string): { time: string | null; match: string | null } {
  const s = strip(text);
  // "às 7h", "7h30", "14:30", "as 9", "19 horas"
  const m =
    s.match(/\b(?:as|a?s?)\s*(\d{1,2})[:h](\d{2})\b/) ||
    s.match(/\b(\d{1,2}):(\d{2})\b/) ||
    s.match(/\b(\d{1,2})h(\d{2})?\b/) ||
    s.match(/\bas (\d{1,2})(?:\s*horas?)?\b/) ||
    s.match(/\b(\d{1,2}) horas?\b/);
  if (!m) {
    if (/\bmeio-?dia\b/.test(s)) return { time: "12:00", match: "meio-dia" };
    if (/\bmeia-?noite\b/.test(s)) return { time: "00:00", match: "meia-noite" };
    return { time: null, match: null };
  }
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (/\b(da|de) (tarde|noite)\b/.test(s) && h < 12) h += 12;
  if (h > 23 || min > 59) return { time: null, match: null };
  return { time: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`, match: m[0] };
}

export function parseAmount(text: string): { cents: Cents | null; match: string | null } {
  const m =
    text.match(/r\$\s*([\d.,]+(?:\s*mil)?)/i) ||
    text.match(/([\d.,]+(?:\s*mil)?)\s*(?:reais|real)\b/i);
  if (!m) return { cents: null, match: null };
  return { cents: parseBRL(m[1]), match: m[0] };
}

export function parseDurationHours(text: string): number | null {
  const s = strip(text);
  const m = s.match(/(\d+(?:[.,]\d+)?|\w+) horas?(?: e (\d+) minutos?)?/);
  if (!m) return null;
  const h = Number(m[1].replace(",", ".")) || NUMBER_WORDS[m[1]];
  if (!h) return null;
  return h * 60 + (m[2] ? Number(m[2]) : 0);
}

export type QuickIntent = "despesa" | "receita" | "compromisso" | "tarefa" | "sono" | "agua" | "habito" | "nota";

export interface QuickParse {
  intent: QuickIntent;
  title: string;
  date: ISODate | null;
  time: string | null;
  amountCents: Cents | null;
  durationMinutes: number | null;
  waterMl: number | null;
}

/** Classifica um comando curto e extrai os campos. */
export function parseQuickCommand(input: string, today: ISODate): QuickParse {
  const raw = input.trim().replace(/^vilma[,:]?\s*/i, "");
  const s = strip(raw);
  const { date, match: dMatch } = parseRelativeDate(raw, today);
  const { time, match: tMatch } = parseTime(raw);
  const { cents, match: aMatch } = parseAmount(raw);
  const duration = parseDurationHours(raw);
  const water = s.match(/(\d{2,4})\s*ml\b/) ?? (/(\d+(?:[.,]\d+)?)\s*(?:l|litros?)\b/.exec(s) as RegExpMatchArray | null);

  let intent: QuickIntent = "tarefa";
  if (/\b(recebi|ganhei|salario|entrada|receita|pagamento recebido)\b/.test(s) && cents) intent = "receita";
  else if ((/\b(gastei|paguei|despesa|comprei|gasto|conta de)\b/.test(s) || cents) && cents) intent = "despesa";
  else if (/\b(dormi|sono)\b/.test(s) && duration) intent = "sono";
  else if (/\b(bebi|agua|água)\b/.test(s) && water) intent = "agua";
  else if (/\b(agende|agendar|marque|marcar|reuniao|consulta|compromisso|encontro|aniversario)\b/.test(s) || (time && !/\blembre/.test(s))) intent = "compromisso";
  else if (/\b(anote|anotar|nota|ideia)\b/.test(s)) intent = "nota";

  let title = raw;
  for (const m of [dMatch, tMatch, aMatch]) if (m) title = title.replace(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
  title = title
    .replace(/\b(agende|agendar|marque|marcar|adicione|adicionar|crie|criar|lembre-me de|lembre-me|me lembre de|anote|gastei|paguei|recebi|uma despesa de|despesa de|uma receita de|de salário)\b/gi, " ")
    .replace(/\b(às|as|no|na|em|de|do|da|para)\s*$/i, "")
    .replace(/^\s*(de|do|da|no|na|em|com)\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!title) title = intent === "receita" ? "Receita" : intent === "despesa" ? "Despesa" : raw;
  title = title.charAt(0).toUpperCase() + title.slice(1);

  let waterMl: number | null = null;
  if (water) {
    const v = Number(String(water[1]).replace(",", "."));
    waterMl = /ml/.test(water[0]) ? v : Math.round(v * 1000);
  }

  return { intent, title, date, time, amountCents: cents, durationMinutes: duration, waterMl };
}
