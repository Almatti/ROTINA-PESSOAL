"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Field, Input, Select, Textarea, Segmented, Toggle } from "@/components/ui/primitives";
import { transactionSchema, zodFieldErrors } from "@/lib/validation/entities";
import { useAccounts, useCards, useCategories, useTransactions } from "@/lib/data/hooks";
import { mutate, DataError } from "@/lib/data/store";
import { createTransaction } from "@/lib/data/actions";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/lib/session";
import { parseBRL, formatCents, splitInstallments } from "@/lib/domain/money";
import { invoiceMonthFor, invoiceTotals } from "@/lib/domain/finance";
import { formatMonthYear } from "@/lib/domain/dates";
import type { Transaction } from "@/lib/types";

type TType = Transaction["type"];

interface Props {
  tx?: Transaction | null;
  initialType?: TType;
  onDone: () => void;
  defaults?: { description?: string; amountCents?: number | null; date?: string | null; cardId?: string; invoiceMonth?: string };
}

export function TransactionForm({ tx, initialType = "despesa", onDone, defaults }: Props) {
  const toast = useToast();
  const { today } = useSession();
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: allTx = [] } = useTransactions();
  const isEdit = !!tx;
  const [type, setType] = useState<TType>(tx?.type ?? initialType);
  const { data: categories } = useCategories(type === "receita" ? "receita" : "despesa");
  const activeAccounts = accounts.filter((a) => !a.archived);
  const activeCards = cards.filter((c) => !c.archived);

  const [amount, setAmount] = useState(tx ? tx.amount.replace(".", ",") : defaults?.amountCents ? (defaults.amountCents / 100).toFixed(2).replace(".", ",") : "");
  const [description, setDescription] = useState(tx?.description ?? defaults?.description ?? "");
  const [categoryId, setCategoryId] = useState(tx?.category_id ?? "");
  // origem: conta ou cartão (cartão só para despesa)
  const [source, setSource] = useState(tx?.type === "despesa" && tx.card_id ? `card:${tx.card_id}` : tx?.account_id ? `acc:${tx.account_id}` : activeAccounts[0] ? `acc:${activeAccounts[0].id}` : "");
  const [toAccount, setToAccount] = useState(tx?.to_account_id ?? "");
  const [invoiceCard, setInvoiceCard] = useState(tx?.type === "pagamento_fatura" ? tx.card_id ?? "" : defaults?.cardId ?? "");
  const [invoiceMonth, setInvoiceMonth] = useState(tx?.invoice_month ?? defaults?.invoiceMonth ?? "");
  const [date, setDate] = useState(tx?.occurred_on ?? defaults?.date ?? today);
  const [status, setStatus] = useState<"pago" | "pendente">(tx?.status ?? "pago");
  const [dueDate, setDueDate] = useState(tx?.due_date ?? "");
  const [isFixed, setIsFixed] = useState(tx?.is_fixed ?? false);
  const [installments, setInstallments] = useState("1");
  const [notes, setNotes] = useState(tx?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const cardId = type === "despesa" && source.startsWith("card:") ? source.slice(5) : null;
  const accountId = source.startsWith("acc:") ? source.slice(4) : null;
  const card = cards.find((c) => c.id === cardId);
  const payCard = cards.find((c) => c.id === invoiceCard);
  const cents = parseBRL(amount);
  const n = Number(installments) || 1;
  const preview = useMemo(() => (card && cents && n > 1 ? splitInstallments(cents, n) : null), [card, cents, n]);
  const openInvoice = payCard && invoiceMonth ? invoiceTotals(allTx, payCard.id, invoiceMonth) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (cents === null || cents <= 0) return setErrors({ amount: "Informe um valor válido, ex.: 150,00" });
    const isInvoice = type === "pagamento_fatura";
    const payload = {
      type,
      amount: cents / 100,
      description: description || (isInvoice && payCard ? `Fatura ${payCard.name}` : ""),
      category_id: type === "despesa" || type === "receita" ? categoryId || null : null,
      account_id: cardId ? null : accountId,
      to_account_id: type === "transferencia" ? toAccount || null : null,
      card_id: isInvoice ? invoiceCard || null : cardId,
      occurred_on: date,
      due_date: status === "pendente" && !cardId && !isInvoice ? dueDate || date : null,
      status: cardId || isInvoice || type === "transferencia" ? "pago" : status,
      is_fixed: type === "despesa" ? isFixed : false,
      installments: cardId && !isEdit ? n : 1,
      notes: notes || null,
    } as const;
    const parsed = transactionSchema.safeParse(payload);
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));
    if (isInvoice && !invoiceMonth) return setErrors({ invoice_month: "Escolha o mês da fatura." });
    if (!payload.account_id && !payload.card_id) return setErrors({ source: "Escolha a conta." });
    if (isInvoice && !payload.account_id) return setErrors({ source: "Escolha a conta de onde sai o pagamento." });
    setErrors({});
    setSaving(true);
    try {
      if (isEdit) {
        const { installments: _omit, ...rest } = parsed.data;
        void _omit;
        await mutate({
          action: "update",
          table: "transactions",
          id: tx!.id,
          values: {
            ...rest,
            amount: rest.amount.toFixed(2),
            invoice_month: isInvoice ? invoiceMonth : card ? invoiceMonthFor(rest.occurred_on, card.closing_day) : null,
          },
        });
      } else {
        await createTransaction({ ...parsed.data, ...(isInvoice ? { invoice_month: invoiceMonth } : {}) } as Parameters<typeof createTransaction>[0], cards);
      }
      toast.show(isEdit ? "Movimentação atualizada." : "Registrado!", "success");
      onDone();
    } catch (err) {
      toast.show(err instanceof DataError ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!activeAccounts.length) {
    return (
      <div className="space-y-3 text-sm">
        <p>Para registrar movimentações, cadastre primeiro uma conta (ex.: conta corrente ou carteira) com o saldo atual. Assim seus saldos serão reais desde o início.</p>
        <Link href="/financas?aba=contas" onClick={onDone} className="inline-flex h-11 items-center rounded-pill bg-primary px-5 font-semibold text-primary-ink">Cadastrar conta</Link>
      </div>
    );
  }

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      {!isEdit && (
        <Segmented
          label="Tipo de movimentação"
          value={type}
          onChange={(t) => { setType(t); setErrors({}); if (t !== "despesa" && source.startsWith("card:")) setSource(activeAccounts[0] ? `acc:${activeAccounts[0].id}` : ""); }}
          options={[{ value: "despesa", label: "Gasto" }, { value: "receita", label: "Entrada" }, { value: "transferencia", label: "Transferir" }, { value: "pagamento_fatura", label: "Fatura" }]}
        />
      )}
      <Field label="Valor (R$)" error={errors.amount}>{(id, d) => <Input id={id} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" aria-describedby={d} invalid={!!errors.amount} className="text-2xl font-bold" />}</Field>
      <Field label="Descrição" error={errors.description}>{(id, d) => <Input id={id} value={description} onChange={(e) => setDescription(e.target.value)} aria-describedby={d} invalid={!!errors.description} placeholder={type === "receita" ? "Ex.: Salário" : type === "pagamento_fatura" ? "Ex.: Fatura do cartão" : type === "transferencia" ? "Ex.: Guardar na reserva" : "Ex.: Mercado"} maxLength={160} />}</Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={type === "receita" ? "Recebido em" : type === "transferencia" ? "Da conta" : type === "pagamento_fatura" ? "Pagar com a conta" : "Pago com"} error={errors.source || errors.account_id}>{(id) => (
          <Select id={id} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Selecione</option>
            <optgroup label="Contas">{activeAccounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}</optgroup>
            {type === "despesa" && activeCards.length > 0 && <optgroup label="Cartões de crédito">{activeCards.map((c) => <option key={c.id} value={`card:${c.id}`}>💳 {c.name}</option>)}</optgroup>}
          </Select>)}
        </Field>

        {type === "transferencia" && (
          <Field label="Para a conta" error={errors.to_account_id}>{(id) => (
            <Select id={id} value={toAccount} onChange={(e) => setToAccount(e.target.value)}>
              <option value="">Selecione</option>
              {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>)}
          </Field>
        )}

        {type === "pagamento_fatura" && (
          <>
            <Field label="Cartão" error={errors.card_id}>{(id) => (
              <Select id={id} value={invoiceCard} onChange={(e) => setInvoiceCard(e.target.value)}>
                <option value="">Selecione</option>
                {activeCards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>)}
            </Field>
            <Field label="Mês da fatura" error={errors.invoice_month}>{(id) => <Input id={id} type="month" value={invoiceMonth.slice(0, 7)} onChange={(e) => setInvoiceMonth(e.target.value ? `${e.target.value}-01` : "")} />}</Field>
          </>
        )}

        {(type === "despesa" || type === "receita") && (
          <Field label="Categoria">{(id) => (
            <Select id={id} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sem categoria</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </Select>)}
          </Field>
        )}

        <Field label={type === "despesa" && card ? "Data da compra" : "Data"} error={errors.occurred_on}>{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>

        {(type === "despesa" || type === "receita") && !card && (
          <Field label="Situação">{(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as "pago" | "pendente")}>
              <option value="pago">{type === "receita" ? "Recebido" : "Pago"}</option>
              <option value="pendente">{type === "receita" ? "A receber" : "A pagar"}</option>
            </Select>)}
          </Field>
        )}
        {status === "pendente" && !card && (type === "despesa" || type === "receita") && <Field label="Vencimento">{(id) => <Input id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}</Field>}

        {card && !isEdit && (
          <Field label="Parcelas" error={errors.installments}>{(id) => (
            <Select id={id} value={installments} onChange={(e) => setInstallments(e.target.value)}>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((i) => <option key={i} value={i}>{i === 1 ? "À vista" : `${i}x`}</option>)}
            </Select>)}
          </Field>
        )}
      </div>

      {card && (
        <p className="rounded-2xl bg-surface-2 p-3 text-xs text-ink-soft">
          Entra na fatura de <strong>{formatMonthYear(invoiceMonthFor(date, card.closing_day))}</strong>.
          {preview && <> Parcelas: {preview.map((c) => formatCents(c)).join(" + ")}.</>} O valor não sai da sua conta agora — só quando você registrar o pagamento da fatura.
        </p>
      )}
      {openInvoice && (
        <p className="rounded-2xl bg-surface-2 p-3 text-xs text-ink-soft">
          Fatura de {formatMonthYear(invoiceMonth)}: total {formatCents(openInvoice.total)} · já pago {formatCents(openInvoice.paid)} · em aberto <strong>{formatCents(openInvoice.open)}</strong>.{" "}
          {openInvoice.open > 0 && <button type="button" className="font-semibold text-primary underline" onClick={() => setAmount((openInvoice.open / 100).toFixed(2).replace(".", ","))}>Usar valor em aberto</button>}
        </p>
      )}
      {type === "transferencia" && <p className="text-xs text-muted">Transferências entre suas contas não contam como receita nem despesa.</p>}
      {type === "despesa" && <Toggle checked={isFixed} onChange={setIsFixed} label="Conta fixa" description="Para repetir automaticamente todo mês, cadastre em Finanças › Contas fixas." />}
      <Field label="Observações">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}</Field>
      <Button type="submit" className="w-full" loading={saving}>{isEdit ? "Salvar" : "Registrar"}</Button>
    </form>
  );
}
