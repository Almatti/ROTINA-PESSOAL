import { addMonths, monthStart, daysInMonth, type ISODate, addDays, diffDays } from "./dates";
import { toCents, splitInstallments, type Cents } from "./money";

export type TxType = "receita" | "despesa" | "transferencia" | "pagamento_fatura";

export interface Tx {
  id?: string;
  type: TxType;
  amount: number | string;
  description?: string;
  category_id?: string | null;
  account_id?: string | null;
  to_account_id?: string | null;
  card_id?: string | null;
  invoice_month?: ISODate | null;
  occurred_on: ISODate;
  due_date?: ISODate | null;
  status: "pago" | "pendente";
  is_fixed?: boolean;
  recurring_id?: string | null;
}

export interface Account {
  id: string;
  name: string;
  initial_balance: number | string;
  include_in_total?: boolean;
  archived?: boolean;
  type?: string;
}

export interface Card {
  id: string;
  name: string;
  closing_day: number;
  due_day: number;
  limit_amount: number | string;
}

/**
 * Mês da fatura (1º dia do mês de vencimento-referência) de uma compra no cartão.
 * Compras feitas APÓS o dia de fechamento entram na fatura do mês seguinte.
 * Convenção: a fatura "de referência M" fecha no dia closing_day do mês M.
 */
export function invoiceMonthFor(purchase: ISODate, closingDay: number): ISODate {
  const [y, m, d] = purchase.split("-").map(Number);
  const closing = Math.min(closingDay, daysInMonth(y, m));
  const ref = monthStart(purchase);
  return d > closing ? addMonths(ref, 1, 1) : ref;
}

/** Data de vencimento de uma fatura de referência. */
export function invoiceDueDate(referenceMonth: ISODate, card: Pick<Card, "closing_day" | "due_day">): ISODate {
  // Se o vencimento é antes/igual ao fechamento, vence no mês seguinte.
  const dueMonth = card.due_day <= card.closing_day ? addMonths(referenceMonth, 1, 1) : referenceMonth;
  const [dy, dm] = dueMonth.split("-").map(Number);
  return `${dy}-${String(dm).padStart(2, "0")}-${String(Math.min(card.due_day, daysInMonth(dy, dm))).padStart(2, "0")}`;
}

export interface InstallmentRow {
  amount: string;
  installment_number: number;
  installment_total: number;
  invoice_month: ISODate;
  occurred_on: ISODate;
}

/** Gera as parcelas de uma compra parcelada no cartão (valores exatos em centavos). */
export function buildInstallments(totalAmount: number | string, n: number, purchase: ISODate, closingDay: number): InstallmentRow[] {
  const parts = splitInstallments(toCents(totalAmount), n);
  const firstInvoice = invoiceMonthFor(purchase, closingDay);
  return parts.map((c, i) => ({
    amount: (c / 100).toFixed(2),
    installment_number: i + 1,
    installment_total: n,
    invoice_month: addMonths(firstInvoice, i, 1),
    occurred_on: purchase,
  }));
}

/**
 * Saldo de cada conta = saldo inicial
 *  + receitas pagas na conta
 *  − despesas pagas debitadas da conta (compras no cartão NÃO saem da conta)
 *  − transferências enviadas + transferências recebidas
 *  − pagamentos de fatura (saem da conta, mas não são despesa)
 */
export function accountBalances(accounts: Account[], txs: Tx[], upTo?: ISODate): Map<string, Cents> {
  const map = new Map<string, Cents>();
  for (const a of accounts) map.set(a.id, toCents(a.initial_balance));
  for (const t of txs) {
    if (t.status !== "pago") continue;
    if (upTo && t.occurred_on > upTo) continue;
    const v = toCents(t.amount);
    switch (t.type) {
      case "receita":
        if (t.account_id && map.has(t.account_id)) map.set(t.account_id, map.get(t.account_id)! + v);
        break;
      case "despesa":
        if (!t.card_id && t.account_id && map.has(t.account_id)) map.set(t.account_id, map.get(t.account_id)! - v);
        break;
      case "transferencia":
        if (t.account_id && map.has(t.account_id)) map.set(t.account_id, map.get(t.account_id)! - v);
        if (t.to_account_id && map.has(t.to_account_id)) map.set(t.to_account_id, map.get(t.to_account_id)! + v);
        break;
      case "pagamento_fatura":
        if (t.account_id && map.has(t.account_id)) map.set(t.account_id, map.get(t.account_id)! - v);
        break;
    }
  }
  return map;
}

export function totalBalance(accounts: Account[], txs: Tx[], upTo?: ISODate): Cents {
  const balances = accountBalances(accounts, txs, upTo);
  let total = 0;
  for (const a of accounts) {
    if (a.archived || a.include_in_total === false) continue;
    total += balances.get(a.id) ?? 0;
  }
  return total;
}

/** Data de competência de uma transação (compras no cartão: data da compra). */
function inMonth(t: Tx, month: ISODate): boolean {
  return t.occurred_on.slice(0, 7) === month.slice(0, 7);
}

export interface MonthSummary {
  income: Cents; // receitas pagas
  expense: Cents; // despesas (inclui cartão; exclui transferências e pagamento de fatura)
  pendingIncome: Cents; // a receber
  pendingExpense: Cents; // a pagar
  net: Cents;
}

export function monthSummary(txs: Tx[], month: ISODate): MonthSummary {
  let income = 0, expense = 0, pendingIncome = 0, pendingExpense = 0;
  for (const t of txs) {
    if (!inMonth(t, month)) continue;
    const v = toCents(t.amount);
    if (t.type === "receita") {
      if (t.status === "pago") income += v;
      else pendingIncome += v;
    } else if (t.type === "despesa") {
      // compras no cartão contam como despesa na competência, independentemente do pagamento da fatura
      if (t.status === "pago" || t.card_id) expense += v;
      else pendingExpense += v;
    }
    // transferencia e pagamento_fatura: ignorados de propósito
  }
  return { income, expense, pendingIncome, pendingExpense, net: income - expense };
}

/** Saldo projetado ao fim do mês: saldo atual + a receber − a pagar − faturas em aberto. */
export function projectedBalance(currentBalance: Cents, summary: MonthSummary, openInvoices: Cents): Cents {
  return currentBalance + summary.pendingIncome - summary.pendingExpense - openInvoices;
}

export function categoryBreakdown(txs: Tx[], month: ISODate): Map<string | null, Cents> {
  const map = new Map<string | null, Cents>();
  for (const t of txs) {
    if (t.type !== "despesa" || !inMonth(t, month)) continue;
    if (t.status !== "pago" && !t.card_id) continue; // contas a pagar ainda não são gasto
    const key = t.category_id ?? null;
    map.set(key, (map.get(key) ?? 0) + toCents(t.amount));
  }
  return map;
}

/** Total de uma fatura (compras com invoice_month igual) e quanto já foi pago. */
export function invoiceTotals(txs: Tx[], cardId: string, referenceMonth: ISODate): { total: Cents; paid: Cents; open: Cents } {
  let total = 0, paid = 0;
  for (const t of txs) {
    if (t.card_id !== cardId || t.invoice_month?.slice(0, 7) !== referenceMonth.slice(0, 7)) continue;
    if (t.type === "despesa") total += toCents(t.amount);
    if (t.type === "pagamento_fatura") paid += toCents(t.amount);
  }
  return { total, paid, open: Math.max(0, total - paid) };
}

/** Limite disponível do cartão = limite − compras ainda não pagas (todas as faturas). */
export function cardAvailableLimit(card: Card, txs: Tx[]): Cents {
  let used = 0;
  for (const t of txs) {
    if (t.card_id !== card.id) continue;
    if (t.type === "despesa") used += toCents(t.amount);
    if (t.type === "pagamento_fatura") used -= toCents(t.amount);
  }
  return toCents(card.limit_amount) - Math.max(0, used);
}

export interface BudgetUsage {
  limit: Cents;
  spent: Cents;
  percent: number;
  status: "ok" | "atencao" | "estourado";
}

export function budgetUsage(limit: number | string, spent: Cents): BudgetUsage {
  const l = toCents(limit);
  const p = l ? Math.round((spent / l) * 1000) / 10 : 0;
  return { limit: l, spent, percent: p, status: p >= 100 ? "estourado" : p >= 80 ? "atencao" : "ok" };
}

/** Contas a pagar pendentes que vencem nos próximos `days` dias (inclui atrasadas). */
export function upcomingBills<T extends Tx>(txs: T[], today: ISODate, days = 7): (T & { overdue: boolean; daysLeft: number })[] {
  const limit = addDays(today, days);
  return txs
    .filter((t) => t.type === "despesa" && t.status === "pendente" && !t.card_id)
    .map((t) => {
      const due = t.due_date ?? t.occurred_on;
      return { ...t, overdue: due < today, daysLeft: diffDays(due, today) };
    })
    .filter((t) => (t.due_date ?? t.occurred_on) <= limit)
    .sort((a, b) => (a.due_date ?? a.occurred_on).localeCompare(b.due_date ?? b.occurred_on));
}

/** Série mensal (últimos N meses) de receitas × despesas para gráficos comparativos. */
export function monthlySeries(txs: Tx[], endMonth: ISODate, months = 6): { month: ISODate; income: Cents; expense: Cents }[] {
  const out: { month: ISODate; income: Cents; expense: Cents }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = addMonths(monthStart(endMonth), -i, 1);
    const s = monthSummary(txs, m);
    out.push({ month: m, income: s.income, expense: s.expense });
  }
  return out;
}

export interface RecurringDef {
  id: string;
  type: "receita" | "despesa";
  description: string;
  amount: number | string;
  frequency: "semanal" | "mensal" | "anual";
  day_of_month: number | null;
  start_date: ISODate;
  end_date: ISODate | null;
  active: boolean;
  category_id?: string | null;
  account_id?: string | null;
  card_id?: string | null;
  is_fixed?: boolean;
}

/** Datas em que uma conta fixa/assinatura vence dentro de [from, to]. */
export function recurringDueDates(def: RecurringDef, from: ISODate, to: ISODate): ISODate[] {
  if (!def.active) return [];
  const out: ISODate[] = [];
  const end = def.end_date && def.end_date < to ? def.end_date : to;
  if (def.frequency === "semanal") {
    for (let d = def.start_date; d <= end; d = addDays(d, 7)) if (d >= from) out.push(d);
    return out;
  }
  const step = def.frequency === "anual" ? 12 : 1;
  const day = def.day_of_month ?? Number(def.start_date.slice(8, 10));
  let d = addMonths(monthStart(def.start_date), 0, day);
  if (d < def.start_date) d = addMonths(d, step, day);
  for (let guard = 0; d <= end && guard < 600; guard++, d = addMonths(d, step, day)) {
    if (d >= from) out.push(d);
  }
  return out;
}

/** Custo mensal equivalente de uma recorrência (assinaturas/contas fixas). */
export function monthlyEquivalent(def: Pick<RecurringDef, "amount" | "frequency">): Cents {
  const c = toCents(def.amount);
  if (def.frequency === "anual") return Math.round(c / 12);
  if (def.frequency === "semanal") return Math.round((c * 52) / 12);
  return c;
}
