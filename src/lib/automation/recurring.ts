import type { SupabaseClient } from "@supabase/supabase-js";
import { recurringDueDates, invoiceMonthFor, type RecurringDef } from "@/lib/domain/finance";

/**
 * Gera lançamentos de contas fixas/assinaturas para o intervalo informado.
 * Idempotente: o índice único (recurring_id, occurred_on) impede duplicidade.
 * Despesas na conta entram como "pendente" (a pagar); no cartão entram na fatura.
 * Receitas fixas entram como "pendente" (a receber). Nunca efetua pagamentos.
 */
export async function generateRecurring(
  sb: SupabaseClient,
  defs: (RecurringDef & { user_id?: string })[],
  from: string,
  to: string,
  cards: { id: string; closing_day: number }[],
  userId?: string,
): Promise<number> {
  const rows: Record<string, unknown>[] = [];
  for (const d of defs) {
    for (const date of recurringDueDates(d, from, to)) {
      const card = d.card_id ? cards.find((c) => c.id === d.card_id) : undefined;
      rows.push({
        ...(userId ? { user_id: userId } : {}),
        type: d.type,
        amount: Number(d.amount).toFixed(2),
        description: d.description,
        category_id: d.category_id ?? null,
        account_id: card ? null : d.account_id ?? null,
        card_id: card ? card.id : null,
        invoice_month: card ? invoiceMonthFor(date, card.closing_day) : null,
        occurred_on: date,
        due_date: card ? null : date,
        status: card ? "pago" : "pendente",
        is_fixed: d.is_fixed ?? true,
        recurring_id: d.id,
      });
    }
  }
  if (!rows.length) return 0;
  const { data, error } = await sb.from("transactions").upsert(rows, { onConflict: "recurring_id,occurred_on", ignoreDuplicates: true }).select("id");
  if (error) throw error;
  return data?.length ?? 0;
}
