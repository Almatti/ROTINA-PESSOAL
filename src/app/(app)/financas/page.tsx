"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wallet, Eye, EyeOff, Plus, ArrowUp, ArrowDown, Pencil, Download, FileText, CreditCard as CardIcon, Repeat, PiggyBank, Trash2, Search, Zap, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, Segmented, EmptyState, Input, Select, ProgressBar, Badge, cn, Skeleton, SectionTitle } from "@/components/ui/primitives";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { TransactionForm } from "@/components/forms/transaction-form";
import { AccountForm, CardForm, RecurringForm, BudgetForm } from "@/components/finance/forms";
import { Donut, Bars, Lines, Legend, CHART_COLORS, CHART_OTHER, shortBRL } from "@/components/charts";
import { MonthNav } from "@/components/calendar-bits";
import { useSession } from "@/lib/session";
import { useAccounts, useCards, useTransactions, useRecurring, useBudgets, useCategories, useGoals } from "@/lib/data/hooks";
import { accountBalances, totalBalance, monthSummary, categoryBreakdown, upcomingBills, monthlySeries, invoiceTotals, invoiceDueDate, cardAvailableLimit, budgetUsage, monthlyEquivalent, projectedBalance, invoiceMonthFor } from "@/lib/domain/finance";
import { formatCents, formatBRL, toCents, fromCents } from "@/lib/domain/money";
import { monthStart, monthEnd, formatDateBR, formatDayMonth, MONTHS_SHORT, addMonths, formatMonthYear, addDays, diffDays } from "@/lib/domain/dates";
import { mutate } from "@/lib/data/store";
import { generateRecurring } from "@/lib/automation/recurring";
import { getSupabase } from "@/lib/supabase/client";
import { toCSV, download, exportPDF } from "@/lib/export";
import { useToast } from "@/components/ui/toast";
import type { Transaction, FinancialAccount, CreditCard, RecurringTransaction } from "@/lib/types";
import Link from "next/link";

type Tab = "resumo" | "historico" | "planejamento" | "contas";

function FinanceInner() {
  const params = useSearchParams();
  const { today } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>((params.get("aba") as Tab) ?? "resumo");
  const [month, setMonth] = useState(monthStart(today));
  const [hidden, setHidden] = useState(false);
  const [txForm, setTxForm] = useState<{ type: Transaction["type"]; tx?: Transaction; defaults?: { cardId?: string; invoiceMonth?: string; amountCents?: number; description?: string } } | null>(null);
  const [accountForm, setAccountForm] = useState<FinancialAccount | null | "new">(null);
  const [cardForm, setCardForm] = useState<CreditCard | null | "new">(null);
  const [recForm, setRecForm] = useState<{ item?: RecurringTransaction; sub?: boolean } | null>(null);
  const [budgetForm, setBudgetForm] = useState<{ categoryId?: string | null; current?: { id: string; limit_amount: string } } | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ table: string; id: string; label: string; group?: string | null } | null>(null);

  const { data: accounts = [], loading: la } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: txs = [], loading: lt } = useTransactions();
  const { data: recurring = [] } = useRecurring();
  const { data: budgets = [] } = useBudgets(month);
  const { data: expenseCats } = useCategories("despesa");
  const { data: incomeCats } = useCategories("receita");
  const { data: goals = [] } = useGoals();
  const allCats = [...expenseCats, ...incomeCats];

  useEffect(() => {
    const novo = params.get("novo");
    if (novo === "despesa" || novo === "receita") setTxForm({ type: novo });
    const aba = params.get("aba") as Tab | null;
    if (aba) setTab(aba);
  }, [params]);

  // Gera lançamentos das contas fixas do mês corrente e do próximo (idempotente).
  useEffect(() => {
    const active = recurring.filter((r) => r.active);
    if (!active.length || !navigator.onLine) return;
    const key = `vilma:rec-gen:${month}:${active.map((r) => r.id + r.amount).join()}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    generateRecurring(getSupabase(), active, monthStart(today) < month ? month : monthStart(today), monthEnd(month), cards)
      .then((n) => { if (n) toast.show(`${n} lançamento(s) de contas fixas gerado(s).`, "info"); })
      .catch(() => sessionStorage.removeItem(key));
  }, [recurring, month, today, cards, toast]);

  const balances = accountBalances(accounts, txs);
  const balance = totalBalance(accounts, txs);
  const summary = monthSummary(txs, month);
  const openInvoices = cards.reduce((s, c) => s + invoiceTotals(txs, c.id, invoiceMonthFor(today, c.closing_day)).open, 0);
  const projected = projectedBalance(balance, summary, openInvoices);
  const breakdown = categoryBreakdown(txs, month);
  const bills = upcomingBills(txs, today, 10);
  const subs = recurring.filter((r) => r.active && r.is_subscription);
  const fixed = recurring.filter((r) => r.active && !r.is_subscription && r.type === "despesa");
  const overall = budgets.find((b) => !b.category_id);
  const money = (c: number) => (hidden ? "R$ ••••" : formatCents(c));

  const donut = useMemo(() => {
    const entries = [...breakdown.entries()].sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 5);
    const order = expenseCats.map((c) => c.id);
    const sortedTop = [...top].sort((a, b) => order.indexOf(a[0] ?? "") - order.indexOf(b[0] ?? ""));
    const rest = entries.slice(5).reduce((s, e) => s + e[1], 0);
    const items = sortedTop.map(([id, v], i) => {
      const c = expenseCats.find((x) => x.id === id);
      return { label: c ? `${c.icon ?? ""} ${c.name}` : "Sem categoria", value: v, color: CHART_COLORS[i] };
    });
    if (rest) items.push({ label: "Outras", value: rest, color: CHART_OTHER });
    return items.sort((a, b) => b.value - a.value);
  }, [breakdown, expenseCats]);

  const series = monthlySeries(txs, month, 6).map((s) => ({ mes: MONTHS_SHORT[Number(s.month.slice(5, 7)) - 1], Entradas: fromCents(s.income), Saídas: fromCents(s.expense) }));
  const evolution = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(month, i - 5, 1);
    const end = monthEnd(m) > today ? today : monthEnd(m);
    return { mes: MONTHS_SHORT[Number(m.slice(5, 7)) - 1], Saldo: fromCents(totalBalance(accounts, txs, end)) };
  });

  if ((la || lt) && !accounts.length) return <><PageHeader title="Finanças" icon={<Wallet className="size-5" />} /><Skeleton className="h-40" /></>;

  return (
    <>
      <PageHeader title="Meu dinheiro" icon={<Wallet className="size-5" />} actions={<Badge tone="neutral">{formatMonthYear(month)}</Badge>} />
      <Segmented label="Seções de finanças" value={tab} onChange={setTab} options={[{ value: "resumo", label: "Resumo" }, { value: "historico", label: "Histórico" }, { value: "planejamento", label: "Planejar" }, { value: "contas", label: "Contas" }]} />

      {!accounts.length ? (
        <div className="mt-5"><EmptyState icon="💜" title="Vamos começar pelo seu saldo real" description="Cadastre sua conta principal com o saldo de hoje. Nada de valores fictícios: tudo aqui reflete o que você registrar." action={<Button onClick={() => setAccountForm("new")}>Cadastrar conta</Button>} /></div>
      ) : tab === "resumo" ? (
        <div className="mt-4 space-y-3">
          <MonthNav month={month} onChange={setMonth} />
          <Card className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary"><Wallet className="size-5" aria-hidden /></span>
            <div className="flex-1"><p className="text-xs text-muted">Saldo disponível</p><p className={cn("text-2xl font-bold tabular-nums", balance < 0 && "text-error")}>{money(balance)}</p></div>
            <button onClick={() => setHidden(!hidden)} aria-label={hidden ? "Mostrar valores" : "Ocultar valores"} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">{hidden ? <Eye className="size-5" /> : <EyeOff className="size-5" />}</button>
            <button onClick={() => setTab("contas")} aria-label="Editar contas" className="grid size-10 place-items-center rounded-full text-primary hover:bg-surface-2"><Pencil className="size-4" /></button>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Card><p className="flex items-center gap-1.5 text-xs text-success"><span className="grid size-6 place-items-center rounded-full bg-success-soft"><ArrowUp className="size-3.5" aria-hidden /></span>Entradas no mês</p><p className="mt-1 text-lg font-bold tabular-nums text-success">{money(summary.income)}</p>{summary.pendingIncome > 0 && <p className="text-xs text-muted">+{money(summary.pendingIncome)} a receber</p>}</Card>
            <Card><p className="flex items-center gap-1.5 text-xs text-error"><span className="grid size-6 place-items-center rounded-full bg-error-soft"><ArrowDown className="size-3.5" aria-hidden /></span>Saiu no mês</p><p className="mt-1 text-lg font-bold tabular-nums">{money(summary.expense)}</p>{summary.pendingExpense > 0 && <p className="text-xs text-muted">+{money(summary.pendingExpense)} a pagar</p>}</Card>
            <Button size="lg" className="w-full" icon={<Plus className="size-5" />} onClick={() => setTxForm({ type: "despesa" })}>Gasto</Button>
            <Button size="lg" variant="soft" className="w-full" icon={<Plus className="size-5" />} onClick={() => setTxForm({ type: "receita" })}>Entrada</Button>
            <button onClick={() => setTab("planejamento")} className="card bg-info-soft/60 p-4 text-left"><p className="text-xs text-muted">📺 Assinaturas ativas</p><p className="text-xl font-bold">{subs.length}</p><p className="text-xs text-muted">{money(subs.reduce((s, r) => s + monthlyEquivalent(r), 0))} por mês</p></button>
            <button onClick={() => setTab("planejamento")} className="card bg-warning-soft/60 p-4 text-left"><p className="text-xs text-muted">🧾 Contas fixas</p><p className="text-xl font-bold tabular-nums">{money(fixed.reduce((s, r) => s + monthlyEquivalent(r), 0))}</p><p className="text-xs text-muted">comprometido no mês</p></button>
          </div>
          <Card>
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">Saldo projetado (fim do mês)</p><p className={cn("font-bold tabular-nums", projected < 0 ? "text-error" : "text-success")}>{money(projected)}</p></div>
            <p className="mt-1 text-xs text-muted">Saldo atual + a receber − a pagar − faturas em aberto.</p>
            {overall && (() => { const u = budgetUsage(overall.limit_amount, summary.expense); return (
              <div className="mt-3"><div className="flex justify-between text-xs"><span>Orçamento do mês</span><span className={cn("font-semibold", u.status === "estourado" && "text-error", u.status === "atencao" && "text-warning")}>{u.percent}% de {money(u.limit)}</span></div><ProgressBar value={u.percent} tone={u.status === "estourado" ? "error" : u.status === "atencao" ? "warning" : "success"} className="mt-1" label="Uso do orçamento" /></div>
            ); })()}
          </Card>

          {cards.filter((c) => !c.archived).map((c) => {
            const ref = invoiceMonthFor(today, c.closing_day);
            const inv = invoiceTotals(txs, c.id, ref);
            return (
              <Card key={c.id} className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl text-white" style={{ background: c.color }}><CardIcon className="size-5" aria-hidden /></span>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{c.name}</p><p className="text-xs text-muted">Fatura de {formatMonthYear(ref)} · vence {formatDayMonth(invoiceDueDate(ref, c))}</p></div>
                <div className="text-right"><p className="font-bold tabular-nums">{money(inv.open)}</p>{inv.open > 0 && <button className="text-xs font-semibold text-primary" onClick={() => setTxForm({ type: "pagamento_fatura", defaults: { cardId: c.id, invoiceMonth: ref, amountCents: inv.open, description: `Fatura ${c.name}` } })}>Pagar</button>}</div>
              </Card>
            );
          })}

          <SectionTitle>Contas a pagar</SectionTitle>
          {bills.length === 0 ? <p className="text-sm text-muted">Nenhuma conta pendente nos próximos dias. ✨</p> : (
            <Card className="space-y-3">
              {bills.map((b, i) => {
                const pct = Math.max(5, Math.min(100, ((10 - Math.max(0, b.daysLeft)) / 10) * 100));
                const tone = b.overdue ? "error" : (["primary", "info", "warning"] as const)[i % 3];
                return (
                  <div key={b.id} className="flex items-center gap-3">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", b.overdue ? "bg-error-soft text-error" : "bg-primary-soft text-primary")}><Zap className="size-4" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2 text-sm"><span className="truncate">{b.description} · {formatDayMonth(b.due_date ?? b.occurred_on)}</span><span className="font-semibold tabular-nums text-error">{money(toCents(b.amount))}</span></div>
                      <ProgressBar value={pct} tone={tone} className="mt-1" label={b.overdue ? "Atrasada" : `Vence em ${b.daysLeft} dia(s)`} />
                      <p className="mt-0.5 text-[0.7rem] text-muted">{b.overdue ? `Atrasada há ${-b.daysLeft} dia(s)` : b.daysLeft === 0 ? "Vence hoje" : `Vence em ${b.daysLeft} dia(s)`}</p>
                    </div>
                    <Button size="sm" variant="soft" onClick={async () => { await mutate({ action: "update", table: "transactions", id: b.id, values: { status: "pago", occurred_on: today } }); toast.show("Marcada como paga.", "success"); }} aria-label={`Marcar ${b.description} como paga`}><CheckCircle2 className="size-4" /></Button>
                  </div>
                );
              })}
            </Card>
          )}

          <SectionTitle>Gastos por categoria</SectionTitle>
          <Card className="flex flex-col items-center gap-4 sm:flex-row">
            <Donut data={donut} format={(v) => formatCents(v)} center={<span>Neste<br />mês</span>} />
            <div className="w-full flex-1">{donut.length ? <Legend items={donut.map((d) => ({ label: d.label, color: d.color, value: money(d.value) }))} /> : <p className="text-sm text-muted">Sem gastos registrados neste mês.</p>}</div>
          </Card>

          <SectionTitle>Comparativo mensal</SectionTitle>
          <Card><Bars data={series} xKey="mes" series={[{ key: "Entradas", label: "Entradas", color: CHART_COLORS[2] }, { key: "Saídas", label: "Saídas", color: CHART_COLORS[1] }]} format={shortBRL} /><div className="mt-2 flex gap-4 text-xs"><span className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: CHART_COLORS[2] }} />Entradas</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: CHART_COLORS[1] }} />Saídas</span></div></Card>
          <SectionTitle>Evolução do saldo</SectionTitle>
          <Card><Lines data={evolution} xKey="mes" series={[{ key: "Saldo", label: "Saldo", color: CHART_COLORS[0] }]} format={shortBRL} /></Card>
        </div>
      ) : tab === "historico" ? (
        <History txs={txs} accounts={accounts} cards={cards} cats={allCats} month={month} setMonth={setMonth} onEdit={(tx) => setTxForm({ type: tx.type, tx })} onDelete={(tx) => setConfirmDel({ table: "transactions", id: tx.id, label: tx.description, group: tx.installment_group })} money={money} />
      ) : tab === "planejamento" ? (
        <div className="mt-4 space-y-3">
          <MonthNav month={month} onChange={setMonth} />
          <SectionTitle action={<Button size="sm" variant="soft" onClick={() => setBudgetForm({})}>+ Orçamento</Button>}>Orçamentos e limites</SectionTitle>
          {budgets.length === 0 ? <p className="text-sm text-muted">Defina um limite geral ou por categoria para acompanhar seus gastos.</p> : (
            <Card className="space-y-3">
              {budgets.map((b) => {
                const spent = b.category_id ? breakdown.get(b.category_id) ?? 0 : summary.expense;
                const u = budgetUsage(b.limit_amount, spent);
                const c = expenseCats.find((x) => x.id === b.category_id);
                return (
                  <button key={b.id} className="block w-full text-left" onClick={() => setBudgetForm({ categoryId: b.category_id, current: b })}>
                    <div className="flex justify-between text-sm"><span>{c ? `${c.icon} ${c.name}` : "Geral do mês"}</span><span className="tabular-nums">{money(u.spent)} / {money(u.limit)}</span></div>
                    <ProgressBar value={u.percent} tone={u.status === "estourado" ? "error" : u.status === "atencao" ? "warning" : "success"} className="mt-1" label={`${u.percent}% usado`} />
                    {u.status !== "ok" && <p className={cn("mt-0.5 text-xs", u.status === "estourado" ? "text-error" : "text-warning")}>{u.status === "estourado" ? "Limite ultrapassado" : "Atenção: acima de 80%"}</p>}
                  </button>
                );
              })}
            </Card>
          )}
          <SectionTitle action={<Button size="sm" variant="soft" onClick={() => setRecForm({})}>+ Conta fixa</Button>}>Contas fixas e receitas recorrentes</SectionTitle>
          <RecurringList list={recurring.filter((r) => !r.is_subscription)} onEdit={(item) => setRecForm({ item })} onDelete={(r) => setConfirmDel({ table: "recurring_transactions", id: r.id, label: r.description })} money={money} />
          <SectionTitle action={<Button size="sm" variant="soft" onClick={() => setRecForm({ sub: true })}>+ Assinatura</Button>}>Assinaturas</SectionTitle>
          <RecurringList list={recurring.filter((r) => r.is_subscription)} onEdit={(item) => setRecForm({ item })} onDelete={(r) => setConfirmDel({ table: "recurring_transactions", id: r.id, label: r.description })} money={money} />
          <SectionTitle action={<Link href="/metas" className="text-sm font-semibold text-primary">Ver metas</Link>}>Metas financeiras e reservas</SectionTitle>
          {goals.filter((g) => g.area === "financeira" && g.status === "ativa").length === 0 ? <p className="text-sm text-muted">Crie uma meta financeira (ex.: reserva de emergência) em Metas e vincule a uma conta para acompanhar automaticamente.</p> : (
            <div className="space-y-2">
              {goals.filter((g) => g.area === "financeira" && g.status === "ativa").map((g) => {
                const current = g.linked_account_id ? fromCents(balances.get(g.linked_account_id) ?? 0) : Number(g.current_value);
                const pct = g.target_value ? (current / Number(g.target_value)) * 100 : 0;
                return <Card key={g.id}><div className="flex justify-between text-sm"><span className="font-semibold"><PiggyBank className="mr-1 inline size-4 text-primary" aria-hidden />{g.title}</span><span className="tabular-nums">{hidden ? "••••" : formatBRL(current)} / {formatBRL(g.target_value)}</span></div><ProgressBar value={pct} className="mt-2" label={g.title} />{g.due_date && <p className="mt-1 text-xs text-muted">Prazo: {formatDateBR(g.due_date)} · {Math.max(0, diffDays(g.due_date, today))} dias</p>}</Card>;
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <SectionTitle action={<Button size="sm" variant="soft" onClick={() => setAccountForm("new")}>+ Conta</Button>}>Contas</SectionTitle>
          {accounts.map((a) => (
            <Card key={a.id} className="flex items-center gap-3">
              <span className="size-3 rounded-full" style={{ background: a.color }} aria-hidden />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{a.name}{a.archived && " (arquivada)"}</p><p className="text-xs text-muted">{({ corrente: "Conta corrente", poupanca: "Poupança", carteira: "Carteira", investimento: "Investimentos", reserva_emergencia: "Reserva de emergência" } as const)[a.type]}{!a.include_in_total && " · fora do saldo"}</p></div>
              <p className={cn("font-bold tabular-nums", (balances.get(a.id) ?? 0) < 0 && "text-error")}>{money(balances.get(a.id) ?? 0)}</p>
              <Button size="icon" variant="ghost" aria-label={`Editar ${a.name}`} onClick={() => setAccountForm(a)}><Pencil className="size-4" /></Button>
            </Card>
          ))}
          <Button variant="outline" className="w-full" icon={<Repeat className="size-4" />} onClick={() => setTxForm({ type: "transferencia" })}>Transferir entre contas</Button>
          <SectionTitle action={<Button size="sm" variant="soft" onClick={() => setCardForm("new")}>+ Cartão</Button>}>Cartões de crédito</SectionTitle>
          {cards.length === 0 && <p className="text-sm text-muted">Cadastre seus cartões para controlar faturas, parcelas e limite.</p>}
          {cards.map((c) => {
            const avail = cardAvailableLimit(c, txs);
            const lim = toCents(c.limit_amount);
            const months = Array.from({ length: 4 }, (_, i) => addMonths(invoiceMonthFor(today, c.closing_day), i - 1, 1));
            return (
              <Card key={c.id} className="space-y-3">
                <div className="flex items-center gap-3 rounded-2xl p-3 text-white" style={{ background: `linear-gradient(135deg, ${c.color}, #7451A6)` }}>
                  <CardIcon className="size-6" aria-hidden />
                  <div className="flex-1"><p className="font-semibold">{c.name}</p><p className="text-xs opacity-80">Fecha dia {c.closing_day} · vence dia {c.due_day}</p></div>
                  <button onClick={() => setCardForm(c)} aria-label={`Editar ${c.name}`} className="grid size-9 place-items-center rounded-full bg-white/15"><Pencil className="size-4" /></button>
                </div>
                <div><div className="flex justify-between text-xs"><span>Limite disponível</span><span className="font-semibold">{money(avail)} de {money(lim)}</span></div><ProgressBar value={lim ? ((lim - avail) / lim) * 100 : 0} tone="primary" className="mt-1" label="Limite usado" /></div>
                <ul className="divide-y divide-line text-sm">
                  {months.map((m) => {
                    const inv = invoiceTotals(txs, c.id, m);
                    const due = invoiceDueDate(m, c);
                    const status = inv.total === 0 ? "vazia" : inv.open === 0 ? "paga" : due < today ? "atrasada" : addDays(m, c.closing_day - 1) < today ? "fechada" : "aberta";
                    return (
                      <li key={m} className="flex items-center gap-2 py-2">
                        <span className="flex-1 capitalize">{formatMonthYear(m)} <span className="text-xs text-muted">· vence {formatDayMonth(due)}</span></span>
                        <Badge tone={status === "paga" ? "success" : status === "atrasada" ? "error" : status === "fechada" ? "warning" : "neutral"}>{status}</Badge>
                        <span className="w-24 text-right font-semibold tabular-nums">{money(inv.total)}</span>
                        {inv.open > 0 && <Button size="sm" variant="soft" onClick={() => setTxForm({ type: "pagamento_fatura", defaults: { cardId: c.id, invoiceMonth: m, amountCents: inv.open, description: `Fatura ${c.name}` } })}>Pagar</Button>}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={!!txForm} onClose={() => setTxForm(null)} title={txForm?.tx ? "Editar movimentação" : txForm?.type === "receita" ? "Nova entrada" : txForm?.type === "transferencia" ? "Transferência" : txForm?.type === "pagamento_fatura" ? "Pagar fatura" : "Novo gasto"}>
        {txForm && <TransactionForm tx={txForm.tx} initialType={txForm.type} onDone={() => setTxForm(null)} defaults={txForm.defaults} />}
      </Sheet>
      <Sheet open={!!accountForm} onClose={() => setAccountForm(null)} title={accountForm === "new" ? "Nova conta" : "Editar conta"} footer={accountForm && accountForm !== "new" && (
        <div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={async () => { await mutate({ action: "update", table: "financial_accounts", id: accountForm.id, values: { archived: !accountForm.archived } }); setAccountForm(null); }}>{accountForm.archived ? "Reativar" : "Arquivar"}</Button><Button variant="ghost" className="flex-1 text-error" onClick={() => { setConfirmDel({ table: "financial_accounts", id: accountForm.id, label: accountForm.name }); setAccountForm(null); }}>Excluir</Button></div>
      )}>{accountForm && <AccountForm account={accountForm === "new" ? null : accountForm} onDone={() => setAccountForm(null)} />}</Sheet>
      <Sheet open={!!cardForm} onClose={() => setCardForm(null)} title={cardForm === "new" ? "Novo cartão" : "Editar cartão"} footer={cardForm && cardForm !== "new" && <Button variant="ghost" className="w-full text-error" onClick={() => { setConfirmDel({ table: "credit_cards", id: cardForm.id, label: cardForm.name }); setCardForm(null); }}>Excluir cartão</Button>}>
        {cardForm && <CardForm card={cardForm === "new" ? null : cardForm} onDone={() => setCardForm(null)} />}
      </Sheet>
      <Sheet open={!!recForm} onClose={() => setRecForm(null)} title={recForm?.item ? "Editar recorrência" : recForm?.sub ? "Nova assinatura" : "Nova conta fixa"}>{recForm && <RecurringForm item={recForm.item} subscription={recForm.sub} onDone={() => setRecForm(null)} />}</Sheet>
      <Sheet open={!!budgetForm} onClose={() => setBudgetForm(null)} title="Orçamento" footer={budgetForm?.current && <Button variant="ghost" className="w-full text-error" onClick={() => { setConfirmDel({ table: "budgets", id: budgetForm.current!.id, label: "este orçamento" }); setBudgetForm(null); }}>Remover orçamento</Button>}>
        {budgetForm && <BudgetForm month={month} categoryId={budgetForm.categoryId} current={budgetForm.current} onDone={() => setBudgetForm(null)} />}
      </Sheet>
      <ConfirmDialog
        open={!!confirmDel}
        danger
        title="Confirmar exclusão"
        message={confirmDel?.table === "financial_accounts" ? `Excluir “${confirmDel.label}”? As movimentações ficarão sem conta vinculada. Prefira arquivar para manter o histórico.` : confirmDel?.group ? `“${confirmDel.label}” faz parte de uma compra parcelada. Todas as parcelas serão excluídas.` : `Excluir “${confirmDel?.label}”? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => {
          const d = confirmDel!;
          if (d.group) {
            for (const t of txs.filter((t) => t.installment_group === d.group)) await mutate({ action: "delete", table: "transactions", id: t.id });
          } else await mutate({ action: "delete", table: d.table, id: d.id });
          setConfirmDel(null);
          toast.show("Excluído.", "success");
        }}
      />
    </>
  );
}

function RecurringList({ list, onEdit, onDelete, money }: { list: RecurringTransaction[]; onEdit: (r: RecurringTransaction) => void; onDelete: (r: RecurringTransaction) => void; money: (c: number) => string }) {
  if (!list.length) return <p className="text-sm text-muted">Nada cadastrado.</p>;
  return (
    <Card className="divide-y divide-line py-1">
      {list.map((r) => (
        <div key={r.id} className="flex items-center gap-3 py-2.5">
          <button onClick={() => onEdit(r)} className="min-w-0 flex-1 text-left">
            <p className={cn("truncate font-semibold", !r.active && "text-muted line-through")}>{r.description}</p>
            <p className="text-xs text-muted">{r.frequency === "mensal" ? `Todo dia ${r.day_of_month}` : r.frequency === "anual" ? `Anual · dia ${r.day_of_month}` : "Semanal"}{r.card_id ? " · cartão" : ""}{!r.active ? " · pausada" : ""}</p>
          </button>
          <span className={cn("font-semibold tabular-nums", r.type === "receita" ? "text-success" : "")}>{r.type === "receita" ? "+" : ""}{money(toCents(r.amount))}</span>
          <Button size="icon" variant="ghost" aria-label={`Excluir ${r.description}`} onClick={() => onDelete(r)}><Trash2 className="size-4" /></Button>
        </div>
      ))}
    </Card>
  );
}

function History({ txs, accounts, cards, cats, month, setMonth, onEdit, onDelete, money }: { txs: Transaction[]; accounts: FinancialAccount[]; cards: CreditCard[]; cats: { id: string; name: string; icon: string | null }[]; month: string; setMonth: (m: string) => void; onEdit: (t: Transaction) => void; onDelete: (t: Transaction) => void; money: (c: number) => string }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [cat, setCat] = useState("");
  const name = (id: string | null, list: { id: string; name: string }[]) => list.find((x) => x.id === id)?.name ?? "";
  const list = txs.filter((t) => t.occurred_on.slice(0, 7) === month.slice(0, 7) && (!type || t.type === type) && (!status || t.status === status) && (!cat || t.category_id === cat) && (!q || t.description.toLowerCase().includes(q.toLowerCase())));
  const s = monthSummary(list, month);
  const rows = list.map((t) => ({
    data: formatDateBR(t.occurred_on), descricao: t.description, tipo: { receita: "Receita", despesa: "Despesa", transferencia: "Transferência", pagamento_fatura: "Pagamento de fatura" }[t.type],
    categoria: name(t.category_id, cats), conta: name(t.account_id, accounts) || name(t.card_id, cards), situacao: t.status === "pago" ? "Pago" : "Pendente",
    valor: Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
  }));
  const cols = [{ key: "data", label: "Data" }, { key: "descricao", label: "Descrição" }, { key: "tipo", label: "Tipo" }, { key: "categoria", label: "Categoria" }, { key: "conta", label: "Conta/Cartão" }, { key: "situacao", label: "Situação" }, { key: "valor", label: "Valor (R$)" }];
  return (
    <div className="mt-4 space-y-3">
      <MonthNav month={month} onChange={setMonth} />
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="pl-9" aria-label="Buscar movimentações" /></div>
      <div className="grid grid-cols-3 gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo"><option value="">Todos os tipos</option><option value="receita">Receitas</option><option value="despesa">Despesas</option><option value="transferencia">Transferências</option><option value="pagamento_fatura">Faturas</option></Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Situação"><option value="">Toda situação</option><option value="pago">Pagas</option><option value="pendente">Pendentes</option></Select>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria"><option value="">Categorias</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</Select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" icon={<Download className="size-4" />} onClick={() => download(`vilma-financas-${month.slice(0, 7)}.csv`, toCSV(rows, cols))}>CSV</Button>
        <Button size="sm" variant="outline" icon={<FileText className="size-4" />} onClick={() => exportPDF("Vilma — Finanças", `Movimentações de ${formatMonthYear(month)}`, cols.map((c) => c.label), rows.map((r) => cols.map((c) => String((r as Record<string, string>)[c.key] ?? ""))), `vilma-financas-${month.slice(0, 7)}.pdf`, [["Receitas", formatCents(s.income)], ["Despesas", formatCents(s.expense)], ["Resultado", formatCents(s.net)]])}>PDF</Button>
      </div>
      {list.length === 0 ? <EmptyState icon="🧾" title="Nenhuma movimentação" /> : (
        <Card className="divide-y divide-line py-1">
          {list.map((t) => {
            const c = cats.find((x) => x.id === t.category_id);
            const sign = t.type === "receita" ? "+" : t.type === "despesa" ? "−" : "";
            return (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-base" aria-hidden>{t.type === "transferencia" ? "🔁" : t.type === "pagamento_fatura" ? "💳" : c?.icon ?? (t.type === "receita" ? "💰" : "🧾")}</span>
                <button onClick={() => onEdit(t)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-semibold">{t.description}</p>
                  <p className="text-xs text-muted">{formatDayMonth(t.occurred_on)} · {name(t.card_id, cards) || name(t.account_id, accounts)}{t.type === "transferencia" ? ` → ${name(t.to_account_id, accounts)}` : ""}{t.status === "pendente" ? " · pendente" : ""}</p>
                </button>
                <span className={cn("font-semibold tabular-nums", t.type === "receita" && "text-success", t.type === "despesa" && "text-error")}>{sign}{money(toCents(t.amount))}</span>
                <Button size="icon" variant="ghost" aria-label={`Excluir ${t.description}`} onClick={() => onDelete(t)}><Trash2 className="size-4" /></Button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

export default function FinancePage() {
  return <Suspense><FinanceInner /></Suspense>;
}
