import { describe, it, expect } from "vitest";
import * as F from "@/lib/domain/finance";
import type { Tx, Account } from "@/lib/domain/finance";

const accounts: Account[] = [
  { id: "corrente", name: "Corrente", initial_balance: "1000.00" },
  { id: "reserva", name: "Reserva", initial_balance: "0", type: "reserva_emergencia" },
];
const card = { id: "nu", name: "Cartão", closing_day: 5, due_day: 12, limit_amount: "2000" };

const txs: Tx[] = [
  { type: "receita", amount: "3000", account_id: "corrente", occurred_on: "2026-11-05", status: "pago" },
  { type: "despesa", amount: "150", account_id: "corrente", occurred_on: "2026-11-06", status: "pago", category_id: "mercado" },
  { type: "transferencia", amount: "500", account_id: "corrente", to_account_id: "reserva", occurred_on: "2026-11-07", status: "pago" },
  { type: "despesa", amount: "84.90", card_id: "nu", invoice_month: "2026-12-01", occurred_on: "2026-11-10", status: "pago", category_id: "mercado" },
  { type: "despesa", amount: "120", account_id: "corrente", occurred_on: "2026-11-28", due_date: "2026-11-28", status: "pendente", category_id: "internet" },
  { type: "receita", amount: "200", account_id: "corrente", occurred_on: "2026-11-30", status: "pendente" },
];

describe("finanças", () => {
  it("transferência não é receita nem despesa, mas move saldo", () => {
    const s = F.monthSummary(txs, "2026-11-01");
    expect(s.income).toBe(300000);
    expect(s.expense).toBe(15000 + 8490); // conta + cartão; sem transferência
    const b = F.accountBalances(accounts, txs);
    expect(b.get("corrente")).toBe(100000 + 300000 - 15000 - 50000);
    expect(b.get("reserva")).toBe(50000);
    expect(F.totalBalance(accounts, txs)).toBe(100000 + 300000 - 15000);
  });

  it("pagar a fatura não duplica a despesa do cartão", () => {
    const paid: Tx[] = [...txs, { type: "pagamento_fatura", amount: "84.90", account_id: "corrente", card_id: "nu", invoice_month: "2026-12-01", occurred_on: "2026-12-12", status: "pago" }];
    expect(F.monthSummary(paid, "2026-12-01").expense).toBe(0);
    expect(F.monthSummary(paid, "2026-11-01").expense).toBe(23490);
    expect(F.accountBalances(accounts, paid).get("corrente")).toBe(335000 - 8490);
    expect(F.invoiceTotals(paid, "nu", "2026-12-01")).toEqual({ total: 8490, paid: 8490, open: 0 });
  });

  it("compra após o fechamento vai para a fatura seguinte", () => {
    expect(F.invoiceMonthFor("2026-11-05", 5)).toBe("2026-11-01");
    expect(F.invoiceMonthFor("2026-11-06", 5)).toBe("2026-12-01");
    expect(F.invoiceMonthFor("2026-12-20", 5)).toBe("2027-01-01");
    expect(F.invoiceMonthFor("2026-02-28", 31)).toBe("2026-02-01");
    expect(F.invoiceDueDate("2026-12-01", { closing_day: 5, due_day: 12 })).toBe("2026-12-12");
    expect(F.invoiceDueDate("2026-12-01", { closing_day: 25, due_day: 5 })).toBe("2027-01-05");
  });

  it("parcelamento distribui em faturas consecutivas com centavos exatos", () => {
    const rows = F.buildInstallments("1000.00", 3, "2026-11-20", 5);
    expect(rows.map((r) => r.amount)).toEqual(["333.34", "333.33", "333.33"]);
    expect(rows.map((r) => r.invoice_month)).toEqual(["2026-12-01", "2027-01-01", "2027-02-01"]);
    expect(rows.map((r) => r.installment_number)).toEqual([1, 2, 3]);
  });

  it("limite disponível do cartão", () => {
    expect(F.cardAvailableLimit(card, txs)).toBe(200000 - 8490);
  });

  it("saldo projetado considera a receber, a pagar e faturas", () => {
    const s = F.monthSummary(txs, "2026-11-01");
    expect(s.pendingExpense).toBe(12000);
    expect(s.pendingIncome).toBe(20000);
    expect(F.projectedBalance(335000, s, 8490)).toBe(335000 + 20000 - 12000 - 8490);
  });

  it("gastos por categoria e orçamento", () => {
    const m = F.categoryBreakdown(txs, "2026-11-01");
    expect(m.get("mercado")).toBe(23490);
    expect(m.get("internet")).toBeUndefined(); // pendente ainda não é gasto
    expect(F.budgetUsage("200", 23490)).toMatchObject({ percent: 117.5, status: "estourado" });
    expect(F.budgetUsage("250", 23490).status).toBe("atencao");
  });

  it("contas a vencer e atrasadas", () => {
    const list = F.upcomingBills(txs, "2026-11-25", 7);
    expect(list).toHaveLength(1);
    expect(list[0].daysLeft).toBe(3);
    expect(F.upcomingBills(txs, "2026-11-30", 7)[0].overdue).toBe(true);
  });

  it("recorrências de contas fixas", () => {
    const def = { id: "r", type: "despesa" as const, description: "Aluguel", amount: "1500", frequency: "mensal" as const, day_of_month: 31, start_date: "2026-01-10", end_date: null, active: true };
    expect(F.recurringDueDates(def, "2026-01-01", "2026-03-31")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(F.monthlyEquivalent({ amount: "120", frequency: "anual" })).toBe(1000);
    expect(F.recurringDueDates({ ...def, active: false }, "2026-01-01", "2026-03-31")).toEqual([]);
  });

  it("série mensal para comparativo", () => {
    const s = F.monthlySeries(txs, "2026-11-01", 3);
    expect(s.map((x) => x.month)).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"]);
    expect(s[2].income).toBe(300000);
  });
});
