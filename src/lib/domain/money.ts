/**
 * Dinheiro: toda aritmética é feita em centavos (inteiros) para evitar
 * erros de ponto flutuante. O banco armazena numeric(14,2).
 */
export type Cents = number;

export function toCents(value: number | string | null | undefined): Cents {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(c: Cents): number {
  return Math.round(c) / 100;
}

/** Valor para enviar ao banco (string decimal exata com 2 casas). */
export function centsToDecimalString(c: Cents): string {
  const sign = c < 0 ? "-" : "";
  const abs = Math.abs(Math.round(c));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  // Intl usa espaço não separável; normalizamos para espaço comum.
  return brl.format(Number.isFinite(n) ? n : 0).replace(/ /g, " ");
}

export function formatCents(c: Cents): string {
  return formatBRL(fromCents(c));
}

/**
 * Interpreta valores digitados em português: "R$ 1.234,56", "150", "3 mil",
 * "3.000", "12,5", "1,234.56" (formato internacional também aceito).
 * Retorna centavos ou null se inválido.
 */
export function parseBRL(input: string): Cents | null {
  if (!input) return null;
  let s = input.toLowerCase().replace(/r\$|reais|real|\s/g, "");
  let mult = 1;
  if (/mil$/.test(s)) {
    mult = 1000;
    s = s.replace(/mil$/, "");
  }
  if (!s || !/^[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma > -1 && lastDot > -1) {
    // o separador mais à direita é o decimal
    normalized = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    normalized = decimals === 3 && s.split(",").length === 2 && mult === 1 ? s.replace(",", "") : s.replace(/\./g, "").replace(",", ".");
    if ((s.match(/,/g) || []).length > 1) normalized = s.replace(/,/g, "");
  } else if (lastDot > -1) {
    const groups = s.split(".");
    const isThousands = groups.length > 2 || (groups.length === 2 && groups[1].length === 3);
    normalized = isThousands ? s.replace(/\./g, "") : s;
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * mult * 100);
}

/** Divide um total em N parcelas exatas; a diferença de centavos vai na 1ª parcela. */
export function splitInstallments(total: Cents, n: number): Cents[] {
  if (n < 1 || !Number.isInteger(n)) throw new Error("Número de parcelas inválido");
  const base = Math.floor(total / n);
  const rest = total - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + rest : base));
}

export function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}
