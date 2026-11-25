import { z } from "zod";
import { isValidISODate } from "@/lib/domain/dates";

/** Esquemas compartilhados entre formulários (cliente) e a Vilma (servidor). */
export const isoDate = z.string().refine(isValidISODate, "Data inválida.");
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Horário inválido.");
const optDate = isoDate.nullable().optional();
const optTime = hhmm.nullable().optional();
const money = z.coerce.number({ message: "Valor inválido." }).positive("O valor deve ser maior que zero.").max(999_999_999, "Valor muito alto.");

export const recurrenceSchema = z
  .object({
    freq: z.enum(["diaria", "semanal", "mensal", "anual"]),
    interval: z.number().int().min(1).max(365).optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
    until: optDate,
    count: z.number().int().min(1).max(1000).nullable().optional(),
  })
  .nullable()
  .optional();

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Dê um título à tarefa.").max(200),
  description: z.string().max(5000).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  area: z.enum(["pessoal", "trabalho", "estudos", "casa"]).default("pessoal"),
  project_id: z.string().uuid().nullable().optional(),
  due_date: optDate,
  due_time: optTime,
  deadline: optDate,
  priority: z.enum(["baixa", "media", "alta", "urgente"]).default("media"),
  status: z.enum(["pendente", "em_andamento", "concluida", "cancelada"]).default("pendente"),
  recurrence: recurrenceSchema,
  reminder_minutes: z.number().int().min(0).max(10080).nullable().optional(),
  estimated_minutes: z.number().int().min(1).max(1440).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).default([]),
});
export type TaskInput = z.infer<typeof taskSchema>;

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Dê um título ao compromisso.").max(200),
    description: z.string().max(5000).nullable().optional(),
    location: z.string().max(300).nullable().optional(),
    category_id: z.string().uuid().nullable().optional(),
    area: z.enum(["pessoal", "trabalho", "estudos", "casa"]).default("pessoal"),
    starts_at: z.string().datetime({ offset: true, message: "Início inválido." }),
    ends_at: z.string().datetime({ offset: true, message: "Fim inválido." }),
    all_day: z.boolean().default(false),
    recurrence: recurrenceSchema,
    reminder_minutes: z.number().int().min(0).max(10080).nullable().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  })
  .refine((e) => new Date(e.ends_at) >= new Date(e.starts_at), { message: "O fim deve ser depois do início.", path: ["ends_at"] });
export type EventInput = z.infer<typeof eventSchema>;

export const transactionSchema = z
  .object({
    type: z.enum(["receita", "despesa", "transferencia", "pagamento_fatura"]),
    amount: money,
    description: z.string().trim().min(1, "Descreva a movimentação.").max(160),
    category_id: z.string().uuid().nullable().optional(),
    account_id: z.string().uuid().nullable().optional(),
    to_account_id: z.string().uuid().nullable().optional(),
    card_id: z.string().uuid().nullable().optional(),
    occurred_on: isoDate,
    due_date: optDate,
    status: z.enum(["pago", "pendente"]).default("pago"),
    is_fixed: z.boolean().default(false),
    installments: z.number().int().min(1).max(72).default(1),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine((t, ctx) => {
    if (t.type === "transferencia") {
      if (!t.account_id || !t.to_account_id) ctx.addIssue({ code: "custom", message: "Escolha as contas de origem e destino.", path: ["to_account_id"] });
      else if (t.account_id === t.to_account_id) ctx.addIssue({ code: "custom", message: "As contas precisam ser diferentes.", path: ["to_account_id"] });
    }
    if (t.type === "pagamento_fatura" && !t.card_id) ctx.addIssue({ code: "custom", message: "Escolha o cartão.", path: ["card_id"] });
    if (t.card_id && t.type === "receita") ctx.addIssue({ code: "custom", message: "Receitas não podem ser lançadas no cartão.", path: ["card_id"] });
    if (t.installments > 1 && !t.card_id) ctx.addIssue({ code: "custom", message: "Parcelamento é feito no cartão de crédito.", path: ["installments"] });
  });
export type TransactionInput = z.infer<typeof transactionSchema>;

export const habitSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao hábito.").max(120),
  emoji: z.string().min(1).max(8).default("✨"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#7451A6"),
  kind: z.enum(["construir", "largar"]).default("construir"),
  frequency: z.discriminatedUnion("type", [
    z.object({ type: z.literal("daily") }),
    z.object({ type: z.literal("weekdays"), days: z.array(z.number().int().min(0).max(6)).min(1, "Escolha ao menos um dia.") }),
    z.object({ type: z.literal("times_per_week"), times: z.number().int().min(1).max(7) }),
    z.object({ type: z.literal("every_n_days"), n: z.number().int().min(2).max(60) }),
  ]),
  target_value: z.coerce.number().positive().max(100000).default(1),
  unit: z.string().trim().min(1).max(20).default("vez"),
  step_value: z.coerce.number().positive().max(100000).default(1),
  time_of_day: optTime,
  period: z.enum(["manha", "tarde", "noite", "qualquer"]).default("qualquer"),
  reminder: z.boolean().default(false),
  checklist: z.array(z.object({ id: z.string(), label: z.string().min(1).max(80) })).max(20).default([]),
  money_per_day: z.coerce.number().min(0).nullable().optional(),
});
export type HabitInput = z.infer<typeof habitSchema>;

export const sleepSchema = z.object({
  sleep_date: isoDate,
  bed: hhmm,
  wake: hhmm,
  quality: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const moodSchema = z.object({
  log_date: isoDate,
  mood: z.number().int().min(1).max(5),
  emoji: z.string().min(1).max(8),
  intensity: z.number().int().min(1).max(10).nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  feelings: z.array(z.string().max(30)).max(20).default([]),
  journal: z.string().max(20000).nullable().optional(),
  gratitude: z.string().max(5000).nullable().optional(),
  highlights: z.string().max(5000).nullable().optional(),
});

export const goalSchema = z.object({
  title: z.string().trim().min(1, "Dê um título à meta.").max(160),
  description: z.string().max(5000).nullable().optional(),
  horizon: z.enum(["semanal", "mensal", "anual", "longo_prazo"]).default("anual"),
  area: z.enum(["pessoal", "profissional", "financeira", "saude", "estudos", "relacionamentos"]).default("pessoal"),
  target_value: z.coerce.number().positive().nullable().optional(),
  current_value: z.coerce.number().min(0).default(0),
  unit: z.string().max(20).nullable().optional(),
  due_date: optDate,
  image_url: z.string().max(1000).nullable().optional(),
});

export function zodFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Converte string vazia de formulário em null. */
export const emptyToNull = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === "" ? null : v])) as T;
