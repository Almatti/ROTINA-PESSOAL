"use client";
import { useState } from "react";
import { Button, Field, Input, Select, Toggle } from "@/components/ui/primitives";
import { mutate, DataError } from "@/lib/data/store";
import { useToast } from "@/components/ui/toast";
import { useAccounts, useCards, useCategories } from "@/lib/data/hooks";
import { parseBRL } from "@/lib/domain/money";
import { unlock } from "@/lib/data/actions";
import { useSession } from "@/lib/session";
import type { FinancialAccount, CreditCard, RecurringTransaction } from "@/lib/types";

const TYPES = [
  { v: "corrente", l: "Conta corrente" }, { v: "poupanca", l: "Poupança" }, { v: "carteira", l: "Carteira / dinheiro" },
  { v: "investimento", l: "Investimentos" }, { v: "reserva_emergencia", l: "Reserva de emergência" },
];

export function AccountForm({ account, onDone }: { account?: FinancialAccount | null; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "corrente");
  const [balance, setBalance] = useState(account ? String(account.initial_balance).replace(".", ",") : "");
  const [include, setInclude] = useState(account?.include_in_total ?? true);
  const [color, setColor] = useState(account?.color ?? "#7451A6");
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const cents = balance.trim() ? parseBRL(balance.replace(/^-/, "")) : 0;
      if (!name.trim()) return setErr({ name: "Dê um nome à conta." });
      if (cents === null) return setErr({ balance: "Valor inválido." });
      const signed = balance.trim().startsWith("-") ? -cents : cents;
      setSaving(true);
      try {
        const values = { name: name.trim(), type, initial_balance: (signed / 100).toFixed(2), include_in_total: include, color };
        if (account) await mutate({ action: "update", table: "financial_accounts", id: account.id, values });
        else await mutate({ action: "insert", table: "financial_accounts", values });
        toast.show("Conta salva.", "success");
        onDone();
      } catch (ex) {
        toast.show(ex instanceof DataError ? ex.message : "Erro ao salvar.", "error");
      } finally {
        setSaving(false);
      }
    }}>
      <Field label="Nome" error={err.name}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank, Carteira" maxLength={80} invalid={!!err.name} />}</Field>
      <Field label="Tipo">{(id) => <Select id={id} value={type} onChange={(e) => setType(e.target.value as FinancialAccount["type"])}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</Select>}</Field>
      <Field label={account ? "Saldo inicial (no cadastro)" : "Saldo atual (R$)"} error={err.balance} hint="Informe o saldo real da conta hoje. Movimentações futuras atualizam o saldo automaticamente.">{(id, d) => <Input id={id} aria-describedby={d} inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0,00" invalid={!!err.balance} />}</Field>
      <Toggle checked={include} onChange={setInclude} label="Somar no saldo disponível" description="Desative para investimentos de longo prazo, se preferir." />
      <Field label="Cor">{(id) => <Input id={id} type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 p-1" />}</Field>
      <Button type="submit" className="w-full" loading={saving}>Salvar conta</Button>
    </form>
  );
}

export function CardForm({ card, onDone }: { card?: CreditCard | null; onDone: () => void }) {
  const toast = useToast();
  const { data: accounts = [] } = useAccounts();
  const [name, setName] = useState(card?.name ?? "");
  const [limit, setLimit] = useState(card ? String(card.limit_amount).replace(".", ",") : "");
  const [closing, setClosing] = useState(String(card?.closing_day ?? 5));
  const [due, setDue] = useState(String(card?.due_day ?? 12));
  const [account, setAccount] = useState(card?.payment_account_id ?? "");
  const [color, setColor] = useState(card?.color ?? "#312A44");
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const c = Number(closing), d = Number(due), l = parseBRL(limit || "0");
      const errors: Record<string, string> = {};
      if (!name.trim()) errors.name = "Dê um nome ao cartão.";
      if (!(c >= 1 && c <= 31)) errors.closing = "Dia entre 1 e 31.";
      if (!(d >= 1 && d <= 31)) errors.due = "Dia entre 1 e 31.";
      if (l === null) errors.limit = "Valor inválido.";
      if (Object.keys(errors).length) return setErr(errors);
      setSaving(true);
      try {
        const values = { name: name.trim(), limit_amount: ((l ?? 0) / 100).toFixed(2), closing_day: c, due_day: d, payment_account_id: account || null, color };
        if (card) await mutate({ action: "update", table: "credit_cards", id: card.id, values });
        else await mutate({ action: "insert", table: "credit_cards", values });
        toast.show("Cartão salvo.", "success");
        onDone();
      } catch (ex) {
        toast.show(ex instanceof DataError ? ex.message : "Erro ao salvar.", "error");
      } finally {
        setSaving(false);
      }
    }}>
      <Field label="Nome do cartão" error={err.name}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Cartão Nubank" invalid={!!err.name} />}</Field>
      <Field label="Limite (R$)" error={err.limit}>{(id) => <Input id={id} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dia de fechamento" error={err.closing}>{(id) => <Input id={id} type="number" min={1} max={31} value={closing} onChange={(e) => setClosing(e.target.value)} />}</Field>
        <Field label="Dia de vencimento" error={err.due}>{(id) => <Input id={id} type="number" min={1} max={31} value={due} onChange={(e) => setDue(e.target.value)} />}</Field>
      </div>
      <Field label="Conta que paga a fatura">{(id) => <Select id={id} value={account} onChange={(e) => setAccount(e.target.value)}><option value="">Escolher no pagamento</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>}</Field>
      <Field label="Cor">{(id) => <Input id={id} type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 p-1" />}</Field>
      <Button type="submit" className="w-full" loading={saving}>Salvar cartão</Button>
    </form>
  );
}

export function RecurringForm({ item, onDone, subscription }: { item?: RecurringTransaction | null; onDone: () => void; subscription?: boolean }) {
  const toast = useToast();
  const { today } = useSession();
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const [type, setType] = useState<"receita" | "despesa">(item?.type ?? "despesa");
  const { data: categories } = useCategories(type);
  const [description, setDescription] = useState(item?.description ?? "");
  const [amount, setAmount] = useState(item ? String(item.amount).replace(".", ",") : "");
  const [frequency, setFrequency] = useState(item?.frequency ?? "mensal");
  const [day, setDay] = useState(String(item?.day_of_month ?? Number(today.slice(8))));
  const [start, setStart] = useState(item?.start_date ?? today);
  const [end, setEnd] = useState(item?.end_date ?? "");
  const [source, setSource] = useState(item?.card_id ? `card:${item.card_id}` : item?.account_id ? `acc:${item.account_id}` : accounts[0] ? `acc:${accounts[0].id}` : "");
  const [category, setCategory] = useState(item?.category_id ?? "");
  const [isSub, setIsSub] = useState(item?.is_subscription ?? !!subscription);
  const [active, setActive] = useState(item?.active ?? true);
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const cents = parseBRL(amount);
      const errors: Record<string, string> = {};
      if (!description.trim()) errors.description = "Descreva a conta.";
      if (!cents) errors.amount = "Valor inválido.";
      if (end && end < start) errors.end = "Deve ser depois do início.";
      if (!source) errors.source = "Escolha conta ou cartão.";
      if (Object.keys(errors).length) return setErr(errors);
      setSaving(true);
      try {
        const values = {
          type, description: description.trim(), amount: (cents! / 100).toFixed(2), frequency,
          day_of_month: frequency === "semanal" ? null : Math.min(31, Math.max(1, Number(day) || 1)),
          start_date: start, end_date: end || null,
          account_id: source.startsWith("acc:") ? source.slice(4) : null,
          card_id: type === "despesa" && source.startsWith("card:") ? source.slice(5) : null,
          category_id: category || null, is_subscription: isSub, active,
        };
        if (item) await mutate({ action: "update", table: "recurring_transactions", id: item.id, values });
        else await mutate({ action: "insert", table: "recurring_transactions", values });
        toast.show("Salvo. Os lançamentos serão gerados automaticamente.", "success");
        onDone();
      } catch (ex) {
        toast.show(ex instanceof DataError ? ex.message : "Erro ao salvar.", "error");
      } finally {
        setSaving(false);
      }
    }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">{(id) => <Select id={id} value={type} onChange={(e) => setType(e.target.value as "receita" | "despesa")}><option value="despesa">Despesa</option><option value="receita">Receita</option></Select>}</Field>
        <Field label="Valor (R$)" error={err.amount}>{(id) => <Input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />}</Field>
      </div>
      <Field label="Descrição" error={err.description}>{(id) => <Input id={id} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isSub ? "Ex.: Streaming" : "Ex.: Aluguel, Internet"} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Frequência">{(id) => <Select id={id} value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringTransaction["frequency"])}><option value="mensal">Mensal</option><option value="anual">Anual</option><option value="semanal">Semanal</option></Select>}</Field>
        {frequency !== "semanal" && <Field label="Dia do vencimento">{(id) => <Input id={id} type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} />}</Field>}
        <Field label="Início">{(id) => <Input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
        <Field label="Término (opcional)" error={err.end}>{(id) => <Input id={id} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
        <Field label={type === "receita" ? "Recebe em" : "Paga com"} error={err.source}>{(id) => (
          <Select id={id} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Selecione</option>
            <optgroup label="Contas">{accounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}</optgroup>
            {type === "despesa" && <optgroup label="Cartões">{cards.map((c) => <option key={c.id} value={`card:${c.id}`}>💳 {c.name}</option>)}</optgroup>}
          </Select>)}
        </Field>
        <Field label="Categoria">{(id) => <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Sem categoria</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</Select>}</Field>
      </div>
      <Toggle checked={isSub} onChange={setIsSub} label="É uma assinatura" />
      <Toggle checked={active} onChange={setActive} label="Ativa" description="Pausadas não geram lançamentos." />
      <Button type="submit" className="w-full" loading={saving}>Salvar</Button>
    </form>
  );
}

export function BudgetForm({ month, categoryId, current, onDone }: { month: string; categoryId?: string | null; current?: { id: string; limit_amount: string | number } | null; onDone: () => void }) {
  const toast = useToast();
  const { data: categories } = useCategories("despesa");
  const [cat, setCat] = useState(categoryId ?? "");
  const [limit, setLimit] = useState(current ? String(current.limit_amount).replace(".", ",") : "");
  const [saving, setSaving] = useState(false);
  return (
    <form noValidate className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const cents = parseBRL(limit);
      if (!cents) return toast.show("Informe um limite válido.", "error");
      setSaving(true);
      try {
        if (current) await mutate({ action: "update", table: "budgets", id: current.id, values: { limit_amount: (cents / 100).toFixed(2) } });
        else await mutate({ action: "insert", table: "budgets", values: { month, category_id: cat || null, limit_amount: (cents / 100).toFixed(2) } });
        void unlock("orcamento");
        toast.show("Orçamento salvo.", "success");
        onDone();
      } catch (ex) {
        toast.show(ex instanceof DataError ? ex.message : "Erro ao salvar.", "error");
      } finally {
        setSaving(false);
      }
    }}>
      {!current && <Field label="Categoria">{(id) => <Select id={id} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Orçamento geral do mês</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</Select>}</Field>}
      <Field label="Limite (R$)">{(id) => <Input id={id} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" />}</Field>
      <Button type="submit" className="w-full" loading={saving}>Salvar orçamento</Button>
    </form>
  );
}
