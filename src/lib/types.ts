import type { RecurrenceRule } from "@/lib/domain/recurrence";
import type { HabitFrequency } from "@/lib/domain/habits";

export type Area = "pessoal" | "trabalho" | "estudos" | "casa";

export interface Profile {
  id: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  timezone: string;
  currency: string;
  theme: "system" | "light" | "dark";
  accent: string;
  onboarding_completed: boolean;
  goals: string[];
  interests: string[];
  wake_time: string | null;
  bed_time: string | null;
  work_start: string | null;
  work_end: string | null;
  sleep_goal_minutes: number;
  water_goal_ml: number;
  monthly_income_goal: number | string | null;
  monthly_savings_goal: number | string | null;
  monthly_budget: number | string | null;
  notification_prefs: Record<string, boolean>;
  dashboard_widgets: { key: string; visible: boolean }[];
  modules: Record<string, boolean>;
  avatar_config: { emoji: string; color: string; frame: string };
  privacy_accepted_at: string | null;
  ai_consent_at: string | null;
  ai_consent_provider: "anthropic" | "gemini" | null;
  cycle_consent_at: string | null;
}

export interface Category {
  id: string;
  scope: "tarefa" | "evento" | "despesa" | "receita" | "nota";
  name: string;
  color: string;
  icon: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  category_id: string | null;
  area: Area;
  project_id: string | null;
  due_date: string | null;
  due_time: string | null;
  deadline: string | null;
  priority: "baixa" | "media" | "alta" | "urgente";
  status: "pendente" | "em_andamento" | "concluida" | "cancelada";
  recurrence: RecurrenceRule | null;
  recurrence_parent_id: string | null;
  reminder_minutes: number | null;
  estimated_minutes: number | null;
  tags: string[];
  is_starred: boolean;
  position: number;
  completed_at: string | null;
  created_at: string;
  subtasks?: Subtask[];
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  position: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  category_id: string | null;
  area: Area;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  recurrence: RecurrenceRule | null;
  reminder_minutes: number | null;
  color: string | null;
  source: "vilma" | "google";
  google_event_id: string | null;
  deleted_at: string | null;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: "construir" | "largar";
  frequency: HabitFrequency;
  target_value: number;
  unit: string;
  step_value: number;
  time_of_day: string | null;
  period: "manha" | "tarde" | "noite" | "qualquer";
  reminder: boolean;
  checklist: { id: string; label: string }[];
  started_on: string;
  money_per_day: number | null;
  archived: boolean;
  position: number;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string;
  value: number;
  checklist_done: string[];
  completed: boolean;
}

export interface FinancialAccount {
  id: string;
  name: string;
  type: "corrente" | "poupanca" | "carteira" | "investimento" | "reserva_emergencia";
  initial_balance: number | string;
  color: string;
  include_in_total: boolean;
  archived: boolean;
}

export interface CreditCard {
  id: string;
  name: string;
  brand: string | null;
  limit_amount: number | string;
  closing_day: number;
  due_day: number;
  color: string;
  payment_account_id: string | null;
  archived: boolean;
}

export interface Transaction {
  id: string;
  type: "receita" | "despesa" | "transferencia" | "pagamento_fatura";
  amount: number | string;
  description: string;
  category_id: string | null;
  account_id: string | null;
  to_account_id: string | null;
  card_id: string | null;
  invoice_month: string | null;
  occurred_on: string;
  due_date: string | null;
  status: "pago" | "pendente";
  is_fixed: boolean;
  recurring_id: string | null;
  installment_group: string | null;
  installment_number: number | null;
  installment_total: number | null;
  notes: string | null;
}

export interface RecurringTransaction {
  id: string;
  type: "receita" | "despesa";
  description: string;
  amount: number | string;
  category_id: string | null;
  account_id: string | null;
  card_id: string | null;
  frequency: "semanal" | "mensal" | "anual";
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  is_subscription: boolean;
  is_fixed: boolean;
  active: boolean;
  last_generated_on: string | null;
}

export interface Budget {
  id: string;
  month: string;
  category_id: string | null;
  limit_amount: number | string;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  horizon: "semanal" | "mensal" | "anual" | "longo_prazo";
  area: "pessoal" | "profissional" | "financeira" | "saude" | "estudos" | "relacionamentos";
  target_value: number | string | null;
  current_value: number | string;
  unit: string | null;
  due_date: string | null;
  status: "ativa" | "concluida" | "pausada" | "arquivada";
  image_url: string | null;
  linked_account_id: string | null;
  last_reviewed_at: string | null;
  completed_at: string | null;
  goal_steps?: { id: string; title: string; done: boolean; due_date: string | null; position: number }[];
}

export interface SleepLogRow {
  id: string;
  sleep_date: string;
  bed_at: string;
  wake_at: string;
  duration_minutes: number;
  quality: number | null;
  notes: string | null;
}

export interface MoodLog {
  id: string;
  log_date: string;
  mood: number;
  emoji: string;
  intensity: number | null;
  energy: number | null;
  feelings: string[];
  journal: string | null;
  gratitude: string | null;
  highlights: string | null;
}

export interface WaterLog {
  id: string;
  log_date: string;
  logged_at: string;
  amount_ml: number;
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
