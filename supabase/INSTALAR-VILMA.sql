-- =====================================================================
-- VILMA — instalação completa do banco (cole TUDO no SQL Editor do Supabase e clique em Run).
-- Rode apenas UMA vez, num projeto novo. Gerado a partir de supabase/migrations.
-- =====================================================================

-- >>> 20261125000001_schema.sql
-- =====================================================================
-- Vilma — Minha Vida · Schema principal
-- PostgreSQL 15+ / Supabase
-- Todas as tabelas de dados pessoais têm user_id + Row Level Security:
-- cada usuária acessa exclusivamente os próprios registros.
-- Valores monetários: numeric(14,2). Datas locais: date. Instantes: timestamptz.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Funções utilitárias
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- PERFIL E PREFERÊNCIAS
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  nickname text check (char_length(nickname) <= 60),
  avatar_url text,
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'BRL',
  locale text not null default 'pt-BR',
  theme text not null default 'system' check (theme in ('system','light','dark')),
  accent text not null default 'orquidea' check (accent in ('orquidea','lavanda','ameixa')),
  onboarding_completed boolean not null default false,
  goals text[] not null default '{}',
  interests text[] not null default '{}',
  wake_time time,
  bed_time time,
  work_start time,
  work_end time,
  sleep_goal_minutes integer not null default 480 check (sleep_goal_minutes between 180 and 840),
  water_goal_ml integer not null default 2000 check (water_goal_ml between 250 and 8000),
  monthly_income_goal numeric(14,2) check (monthly_income_goal >= 0),
  monthly_savings_goal numeric(14,2) check (monthly_savings_goal >= 0),
  monthly_budget numeric(14,2) check (monthly_budget >= 0),
  notification_prefs jsonb not null default '{"tarefas":true,"compromissos":true,"vencimentos":true,"habitos":true,"agua":false,"resumo_manha":true,"revisao_noite":false}'::jsonb,
  dashboard_widgets jsonb not null default '[]'::jsonb,
  modules jsonb not null default '{"ciclo":false,"gamificacao":true,"treinos":true,"estudos":true,"trabalho":true,"casa":true}'::jsonb,
  avatar_config jsonb not null default '{"emoji":"🌸","color":"#7451A6","frame":"simples"}'::jsonb,
  privacy_accepted_at timestamptz,
  ai_consent_at timestamptz,
  cycle_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente quando uma conta é criada no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  insert into public.automations (user_id, key, enabled)
  select new.id, k, true
  from unnest(array['tarefas_recorrentes','contas_fixas','tarefas_atrasadas','compromissos_proximos',
                    'vencimentos','resumo_manha','revisao_noite','relatorio_mensal',
                    'planejamento_semanal','sugerir_reagendamento','progresso_diario','atualizar_metas']) as k
  on conflict do nothing;
  return new;
end $$;

-- Registro de consentimentos (LGPD — art. 8º: prova do consentimento)
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('privacidade','ia','ciclo','google_agenda','notificacoes')),
  granted boolean not null,
  policy_version text not null default '2026-11',
  created_at timestamptz not null default now()
);
create index on public.consents (user_id, kind, created_at desc);

-- ---------------------------------------------------------------------
-- CATEGORIAS PERSONALIZADAS (tarefas, agenda, finanças, notas)
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope text not null check (scope in ('tarefa','evento','despesa','receita','nota')),
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#7451A6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text,
  created_at timestamptz not null default now(),
  unique (user_id, scope, name),
  unique (id, user_id)
);

-- ---------------------------------------------------------------------
-- PROJETOS (Trabalho) — antes de tarefas por causa da FK
-- ---------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  objective text,
  area text not null default 'trabalho' check (area in ('pessoal','trabalho','estudos')),
  client text,
  status text not null default 'em_andamento' check (status in ('planejamento','em_andamento','pausado','concluido','cancelado')),
  start_date date,
  due_date date,
  color text not null default '#7451A6',
  links jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);
create index on public.projects (user_id, status);
create trigger trg_projects_updated before update on public.projects for each row execute function public.set_updated_at();

create table public.project_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  due_date date,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.project_stages (project_id, position);

-- ---------------------------------------------------------------------
-- TAREFAS
-- status "atrasada" é derivado: pendente/em_andamento com prazo vencido.
-- ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  notes text,
  category_id uuid references public.categories(id) on delete set null,
  area text not null default 'pessoal' check (area in ('pessoal','trabalho','estudos','casa')),
  project_id uuid references public.projects(id) on delete set null,
  due_date date,
  due_time time,
  deadline date,
  priority text not null default 'media' check (priority in ('baixa','media','alta','urgente')),
  status text not null default 'pendente' check (status in ('pendente','em_andamento','concluida','cancelada')),
  recurrence jsonb,
  recurrence_parent_id uuid references public.tasks(id) on delete set null,
  reminder_minutes integer check (reminder_minutes between 0 and 10080),
  estimated_minutes integer check (estimated_minutes between 1 and 1440),
  tags text[] not null default '{}',
  is_starred boolean not null default false,
  position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tasks (user_id, status, due_date);
create index on public.tasks (user_id, project_id);
create unique index tasks_recurrence_unique on public.tasks (recurrence_parent_id, due_date);
create trigger trg_tasks_updated before update on public.tasks for each row execute function public.set_updated_at();

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.subtasks (task_id, position);

-- ---------------------------------------------------------------------
-- AGENDA / COMPROMISSOS
-- ---------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  location text,
  category_id uuid references public.categories(id) on delete set null,
  area text not null default 'pessoal' check (area in ('pessoal','trabalho','estudos','casa')),
  project_id uuid references public.projects(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  recurrence jsonb,
  reminder_minutes integer check (reminder_minutes between 0 and 10080),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  source text not null default 'vilma' check (source in ('vilma','google')),
  google_event_id text,
  google_etag text,
  google_updated_at timestamptz,
  local_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  unique (user_id, google_event_id)
);
create index on public.events (user_id, starts_at);
create trigger trg_events_updated before update on public.events for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- HÁBITOS
-- ---------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  emoji text not null default '✨',
  color text not null default '#7451A6',
  kind text not null default 'construir' check (kind in ('construir','largar')),
  frequency jsonb not null default '{"type":"daily"}'::jsonb,
  target_value numeric(10,2) not null default 1 check (target_value > 0),
  unit text not null default 'vez',
  step_value numeric(10,2) not null default 1 check (step_value > 0),
  time_of_day time,
  period text not null default 'qualquer' check (period in ('manha','tarde','noite','qualquer')),
  reminder boolean not null default false,
  checklist jsonb not null default '[]'::jsonb,
  started_on date not null default current_date,
  money_per_day numeric(10,2),
  archived boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.habits (user_id, archived, position);
create trigger trg_habits_updated before update on public.habits for each row execute function public.set_updated_at();

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  log_date date not null,
  value numeric(10,2) not null default 0 check (value >= 0),
  checklist_done jsonb not null default '[]'::jsonb,
  completed boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index on public.habit_logs (user_id, log_date);

-- ---------------------------------------------------------------------
-- FINANÇAS
-- Regras de contabilização (ver src/lib/domain/finance.ts):
--  * transferencia: move saldo entre contas, NÃO é receita nem despesa.
--  * despesa com card_id: entra na fatura (invoice_month) e conta como despesa
--    na competência; não sai de nenhuma conta na data da compra.
--  * pagamento_fatura: sai da conta, mas NÃO é despesa (evita duplicidade).
-- ---------------------------------------------------------------------
create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  type text not null default 'corrente' check (type in ('corrente','poupanca','carteira','investimento','reserva_emergencia')),
  initial_balance numeric(14,2) not null default 0,
  color text not null default '#7451A6',
  include_in_total boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.financial_accounts (user_id);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  brand text,
  limit_amount numeric(14,2) not null default 0 check (limit_amount >= 0),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  color text not null default '#312A44',
  payment_account_id uuid references public.financial_accounts(id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('receita','despesa')),
  description text not null check (char_length(description) between 1 and 120),
  amount numeric(14,2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.financial_accounts(id) on delete set null,
  card_id uuid references public.credit_cards(id) on delete set null,
  frequency text not null default 'mensal' check (frequency in ('semanal','mensal','anual')),
  day_of_month smallint check (day_of_month between 1 and 31),
  start_date date not null default current_date,
  end_date date,
  is_subscription boolean not null default false,
  is_fixed boolean not null default true,
  active boolean not null default true,
  last_generated_on date,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index on public.recurring_transactions (user_id, active);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('receita','despesa','transferencia','pagamento_fatura')),
  amount numeric(14,2) not null check (amount > 0),
  description text not null check (char_length(description) between 1 and 160),
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.financial_accounts(id) on delete set null,
  to_account_id uuid references public.financial_accounts(id) on delete set null,
  card_id uuid references public.credit_cards(id) on delete set null,
  invoice_month date,
  occurred_on date not null default current_date,
  due_date date,
  status text not null default 'pago' check (status in ('pago','pendente')),
  is_fixed boolean not null default false,
  recurring_id uuid references public.recurring_transactions(id) on delete set null,
  installment_group uuid,
  installment_number smallint check (installment_number >= 1),
  installment_total smallint check (installment_total between 1 and 72),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'transferencia' or (account_id is not null and to_account_id is not null and account_id <> to_account_id and card_id is null)),
  check (type <> 'pagamento_fatura' or (card_id is not null and invoice_month is not null)),
  check (type = 'despesa' or type = 'pagamento_fatura' or card_id is null),
  check (card_id is null or type = 'pagamento_fatura' or invoice_month is not null),
  check (installment_number is null or installment_number <= installment_total)
);
create index on public.transactions (user_id, occurred_on desc);
create index on public.transactions (user_id, card_id, invoice_month);
create index on public.transactions (installment_group);
-- índice completo (NULLs são distintos) para permitir ON CONFLICT via API sem predicado
create unique index transactions_recurring_unique on public.transactions (recurring_id, occurred_on);
create trigger trg_transactions_updated before update on public.transactions for each row execute function public.set_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id) on delete cascade,
  reference_month date not null,
  status text not null default 'aberta' check (status in ('aberta','fechada','paga')),
  paid_transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (card_id, reference_month)
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  category_id uuid references public.categories(id) on delete cascade,
  limit_amount numeric(14,2) not null check (limit_amount > 0),
  created_at timestamptz not null default now()
);
create unique index budgets_unique on public.budgets (user_id, month, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ---------------------------------------------------------------------
-- METAS E PLANEJAMENTO DE VIDA
-- ---------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text,
  horizon text not null default 'anual' check (horizon in ('semanal','mensal','anual','longo_prazo')),
  area text not null default 'pessoal' check (area in ('pessoal','profissional','financeira','saude','estudos','relacionamentos')),
  target_value numeric(14,2) check (target_value > 0),
  current_value numeric(14,2) not null default 0 check (current_value >= 0),
  unit text,
  due_date date,
  status text not null default 'ativa' check (status in ('ativa','concluida','pausada','arquivada')),
  image_url text,
  linked_account_id uuid references public.financial_accounts(id) on delete set null,
  last_reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.goals (user_id, status);
create trigger trg_goals_updated before update on public.goals for each row execute function public.set_updated_at();

create table public.goal_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  due_date date,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.goal_steps (goal_id, position);

-- ---------------------------------------------------------------------
-- BEM-ESTAR: sono, humor, ciclo, hidratação
-- ---------------------------------------------------------------------
create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sleep_date date not null,
  bed_at timestamptz not null,
  wake_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  quality smallint check (quality between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  check (wake_at > bed_at),
  unique (user_id, sleep_date)
);

create table public.mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date date not null,
  mood smallint not null check (mood between 1 and 5),
  emoji text not null,
  intensity smallint check (intensity between 1 and 10),
  energy smallint check (energy between 1 and 5),
  feelings text[] not null default '{}',
  journal text,
  gratitude text,
  highlights text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);
create trigger trg_mood_updated before update on public.mood_logs for each row execute function public.set_updated_at();

-- Dados de saúde sensíveis (LGPD art. 11): módulo opcional com consentimento específico.
create table public.cycle_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date,
  flow text check (flow in ('leve','moderado','intenso')),
  notes text,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  unique (user_id, start_date)
);

create table public.cycle_symptoms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date date not null,
  symptoms text[] not null default '{}',
  flow text check (flow in ('nenhum','leve','moderado','intenso')),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  logged_at timestamptz not null default now(),
  amount_ml integer not null check (amount_ml between 1 and 5000),
  created_at timestamptz not null default now()
);
create index on public.water_logs (user_id, log_date);

-- ---------------------------------------------------------------------
-- TREINOS
-- ---------------------------------------------------------------------
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  weekdays smallint[] not null default '{}',
  goal text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  sets smallint not null default 3 check (sets between 1 and 20),
  reps text not null default '12',
  load_kg numeric(6,2) check (load_kg >= 0),
  rest_seconds integer not null default 60 check (rest_seconds between 0 and 900),
  position integer not null default 0,
  notes text
);
create index on public.workout_exercises (plan_id, position);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  activity text not null default 'musculacao',
  performed_on date not null default current_date,
  duration_minutes integer check (duration_minutes between 1 and 1440),
  distance_km numeric(6,2) check (distance_km >= 0),
  effort smallint check (effort between 1 and 10),
  notes text,
  created_at timestamptz not null default now()
);
create index on public.workout_sessions (user_id, performed_on desc);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid references public.workout_exercises(id) on delete set null,
  exercise_name text not null,
  set_number smallint not null check (set_number >= 1),
  reps smallint check (reps >= 0),
  load_kg numeric(6,2) check (load_kg >= 0)
);
create index on public.workout_sets (session_id);
create index on public.workout_sets (user_id, exercise_name);

-- ---------------------------------------------------------------------
-- TRABALHO: registro de horas
-- ---------------------------------------------------------------------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  worked_on date not null default current_date,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  description text,
  created_at timestamptz not null default now()
);
create index on public.time_entries (user_id, worked_on);

-- ---------------------------------------------------------------------
-- ESTUDOS
-- ---------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind text not null default 'curso' check (kind in ('curso','disciplina','idioma','certificacao')),
  institution text,
  color text not null default '#88708E',
  weekly_goal_minutes integer check (weekly_goal_minutes between 0 and 10080),
  total_lessons integer check (total_lessons >= 0),
  lessons_done integer not null default 0 check (lessons_done >= 0),
  links jsonb not null default '[]'::jsonb,
  status text not null default 'em_andamento' check (status in ('planejado','em_andamento','concluido','pausado')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  studied_on date not null default current_date,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  topic text,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.study_sessions (user_id, studied_on);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  type text not null check (type in ('prova','trabalho','revisao','aula')),
  title text not null check (char_length(title) between 1 and 160),
  due_date date,
  grade numeric(6,2) check (grade >= 0),
  max_grade numeric(6,2) check (max_grade > 0),
  weight numeric(5,2) check (weight >= 0),
  done boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.assessments (user_id, due_date);

-- ---------------------------------------------------------------------
-- CASA
-- ---------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  icon text not null default '🏠',
  color text not null default '#DAD0E5',
  created_at timestamptz not null default now()
);

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  frequency text not null default 'semanal' check (frequency in ('diaria','semanal','quinzenal','mensal','unica')),
  last_done_on date,
  next_due_on date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit text,
  section text,
  price_estimate numeric(14,2) check (price_estimate >= 0),
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.shopping_items (list_id);

create table public.household_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  quantity numeric(10,2) not null default 0 check (quantity >= 0),
  min_quantity numeric(10,2) not null default 0 check (min_quantity >= 0),
  unit text,
  expires_on date,
  created_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meal_date date not null,
  meal_type text not null check (meal_type in ('cafe','almoco','lanche','jantar','ceia')),
  description text not null check (char_length(description) between 1 and 200),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, meal_date, meal_type)
);

create table public.maintenance_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  last_done_on date,
  next_due_on date,
  cost numeric(14,2) check (cost >= 0),
  provider text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ANOTAÇÕES / SEGUNDO CÉREBRO
-- ---------------------------------------------------------------------
create table public.note_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#BAAAC8',
  parent_id uuid references public.note_folders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  content text not null default '' check (char_length(content) <= 100000),
  kind text not null default 'nota' check (kind in ('nota','lista','ideia','diario')),
  folder_id uuid references public.note_folders(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  tags text[] not null default '{}',
  checklist jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  is_favorite boolean not null default false,
  is_pinned boolean not null default false,
  archived boolean not null default false,
  task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.notes (user_id, archived, updated_at desc);
create index notes_search_idx on public.notes using gin (to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(content,'')));
create trigger trg_notes_updated before update on public.notes for each row execute function public.set_updated_at();

create table public.note_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes integer check (size_bytes between 0 and 10485760),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FOCO / POMODORO
-- ---------------------------------------------------------------------
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  mode text not null default 'foco' check (mode in ('foco','pausa_curta','pausa_longa')),
  planned_minutes integer not null check (planned_minutes between 1 and 240),
  actual_minutes integer not null default 0 check (actual_minutes between 0 and 600),
  started_at timestamptz not null,
  ended_at timestamptz,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.focus_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------
-- NOTIFICAÇÕES
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null default 'info' check (type in ('info','tarefa','compromisso','vencimento','habito','resumo','conquista','sistema')),
  title text not null check (char_length(title) between 1 and 160),
  body text,
  link text check (link is null or link ~ '^/'),
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index on public.notifications (user_id, read_at, created_at desc);

-- ---------------------------------------------------------------------
-- ASSISTENTE VILMA: conversas e ações pendentes de confirmação
-- ---------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Nova conversa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.conversations (user_id, updated_at desc);
create trigger trg_conversations_updated before update on public.conversations for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 20000),
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at);

create table public.pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  tool_name text not null,
  input jsonb not null,
  summary text not null,
  status text not null default 'pendente' check (status in ('pendente','confirmada','cancelada','expirada','falhou')),
  result jsonb,
  expires_at timestamptz not null default now() + interval '30 minutes',
  created_at timestamptz not null default now()
);
create index on public.pending_actions (user_id, status);

-- ---------------------------------------------------------------------
-- AUTOMAÇÕES
-- ---------------------------------------------------------------------
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  automation_key text not null,
  status text not null check (status in ('ok','erro','ignorada')),
  details jsonb not null default '{}'::jsonb,
  ran_at timestamptz not null default now()
);
create index on public.automation_runs (user_id, ran_at desc);

-- ---------------------------------------------------------------------
-- GAMIFICAÇÃO
-- ---------------------------------------------------------------------
create table public.achievements (
  key text primary key,
  title text not null,
  description text not null,
  icon text not null,
  points integer not null default 10,
  category text not null
);

create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  achievement_key text not null references public.achievements(key) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_key)
);

create table public.point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null,
  points integer not null check (points between 0 and 1000),
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index on public.point_events (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- INTEGRAÇÕES EXTERNAS (tokens criptografados; colunas sensíveis NÃO
-- são legíveis pelo papel authenticated — apenas pelo servidor)
-- ---------------------------------------------------------------------
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_calendar')),
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  scope text,
  calendar_id text not null default 'primary',
  sync_token text,
  status text not null default 'ativa' check (status in ('ativa','erro','revogada')),
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- ---------------------------------------------------------------------
-- LIMITAÇÃO DE REQUISIÇÕES (janela fixa)
-- ---------------------------------------------------------------------
create table public.rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket, window_start)
);

create or replace function public.consume_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_window timestamptz;
  v_count integer;
begin
  if v_uid is null then
    return false;
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits (user_id, bucket, window_start, count)
  values (v_uid, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  delete from public.rate_limits where user_id = v_uid and window_start < now() - interval '1 day';
  return v_count <= p_max;
end $$;

-- Pontuação: soma dos eventos (recalculada, nunca decrementada por inatividade).
create or replace function public.award_points(p_source text, p_points integer, p_dedupe text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_total integer;
begin
  if v_uid is null then raise exception 'não autenticada'; end if;
  if p_points < 0 or p_points > 100 then raise exception 'pontuação inválida'; end if;
  insert into public.point_events (user_id, source, points, dedupe_key)
  values (v_uid, p_source, p_points, p_dedupe)
  on conflict (user_id, dedupe_key) do nothing;
  select coalesce(sum(points), 0) into v_total from public.point_events where user_id = v_uid;
  return v_total;
end $$;

-- ---------------------------------------------------------------------
-- TRIGGER de novo usuário (precisa de automations existente)
-- ---------------------------------------------------------------------
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
create policy "perfil_proprio_select" on public.profiles for select using (id = auth.uid());
create policy "perfil_proprio_update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "perfil_proprio_insert" on public.profiles for insert with check (id = auth.uid());

do $$
declare
  t text;
  owned text[] := array[
    'consents','categories','projects','project_stages','tasks','subtasks','events','habits','habit_logs',
    'financial_accounts','credit_cards','recurring_transactions','transactions','invoices','budgets',
    'goals','goal_steps','sleep_logs','mood_logs','cycle_periods','cycle_symptoms','water_logs',
    'workout_plans','workout_exercises','workout_sessions','workout_sets','time_entries',
    'courses','study_sessions','assessments','rooms','chores','shopping_lists','shopping_items',
    'household_products','meals','maintenance_items','note_folders','notes','note_attachments',
    'focus_sessions','notifications','conversations','messages','pending_actions','automations',
    'automation_runs','user_achievements'
  ];
begin
  foreach t in array owned loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "dono_select" on public.%I for select using (user_id = auth.uid())', t);
    execute format('create policy "dono_insert" on public.%I for insert with check (user_id = auth.uid())', t);
    execute format('create policy "dono_update" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "dono_delete" on public.%I for delete using (user_id = auth.uid())', t);
  end loop;
end $$;

-- Consentimentos são um registro histórico: sem update/delete pela usuária
-- (são removidos junto com a conta via ON DELETE CASCADE).
drop policy "dono_update" on public.consents;
drop policy "dono_delete" on public.consents;

-- Pontos: somente leitura direta; escrita via award_points().
alter table public.point_events enable row level security;
create policy "dono_select" on public.point_events for select using (user_id = auth.uid());

-- Catálogo de conquistas: leitura pública para usuárias autenticadas.
alter table public.achievements enable row level security;
create policy "catalogo_leitura" on public.achievements for select to authenticated using (true);

-- Rate limits: sem acesso direto.
alter table public.rate_limits enable row level security;

-- Integrações: a usuária pode ver o status e revogar (delete), mas os tokens
-- só podem ser lidos/escritos pelo servidor (service_role).
alter table public.integrations enable row level security;
create policy "dono_select" on public.integrations for select using (user_id = auth.uid());
create policy "dono_delete" on public.integrations for delete using (user_id = auth.uid());
revoke all on public.integrations from anon, authenticated;
grant select (id, user_id, provider, calendar_id, status, last_error, last_synced_at, created_at) on public.integrations to authenticated;
grant delete on public.integrations to authenticated;

-- Anônimos não acessam nada de dados pessoais.
revoke all on all tables in schema public from anon;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.integrations from authenticated;
grant select (id, user_id, provider, calendar_id, status, last_error, last_synced_at, created_at) on public.integrations to authenticated;
grant delete on public.integrations to authenticated;
revoke insert, update, delete on public.point_events from authenticated;
revoke insert, update, delete on public.achievements from authenticated;
revoke all on public.rate_limits from authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;
grant execute on function public.award_points(text, integer, text) to authenticated;

-- Realtime (sincronização entre dispositivos) — publicação do Supabase.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.tasks, public.subtasks, public.events, public.habits, public.habit_logs,
      public.transactions, public.water_logs, public.notifications, public.notes;
  end if;
end $$;

-- >>> 20261125000002_seed_and_defaults.sql
-- =====================================================================
-- Catálogo de conquistas e categorias padrão criadas para cada conta.
-- (Nenhum dado fictício: apenas estruturas vazias e rótulos padrão.)
-- =====================================================================

insert into public.achievements (key, title, description, icon, points, category) values
  ('primeiro_passo', 'Primeiro passo', 'Concluiu o onboarding e configurou o perfil.', '🌱', 20, 'geral'),
  ('primeira_tarefa', 'Mão na massa', 'Concluiu a primeira tarefa.', '✅', 10, 'tarefas'),
  ('tarefas_10', 'Ritmo constante', 'Concluiu 10 tarefas.', '📋', 30, 'tarefas'),
  ('tarefas_50', 'Produtividade gentil', 'Concluiu 50 tarefas.', '🏅', 80, 'tarefas'),
  ('habito_7', 'Uma semana inteira', 'Manteve um hábito por 7 dias seguidos.', '🔥', 40, 'habitos'),
  ('habito_30', 'Hábito enraizado', 'Manteve um hábito por 30 dias seguidos.', '🌳', 120, 'habitos'),
  ('agua_meta', 'Bem hidratada', 'Bateu a meta de água em um dia.', '💧', 10, 'bem_estar'),
  ('sono_meta_7', 'Descanso em dia', 'Atingiu a meta de sono em 7 noites.', '🌙', 50, 'bem_estar'),
  ('journal_7', 'Diário vivo', 'Registrou o humor em 7 dias.', '📔', 30, 'bem_estar'),
  ('foco_1', 'Primeiro pomodoro', 'Concluiu uma sessão de foco.', '⏱️', 10, 'foco'),
  ('foco_25', 'Mente focada', 'Concluiu 25 sessões de foco.', '🎯', 80, 'foco'),
  ('financas_primeiro', 'Dinheiro no radar', 'Registrou a primeira movimentação financeira.', '💜', 10, 'financas'),
  ('orcamento', 'Planejadora', 'Criou um orçamento mensal.', '🧾', 20, 'financas'),
  ('meta_concluida', 'Sonho realizado', 'Concluiu uma meta.', '🏆', 100, 'metas'),
  ('treino_10', 'Corpo em movimento', 'Registrou 10 treinos.', '💪', 50, 'treinos'),
  ('vilma_conversa', 'Prazer, Vilma', 'Conversou com a Vilma pela primeira vez.', '✨', 10, 'geral')
on conflict (key) do update set title = excluded.title, description = excluded.description,
  icon = excluded.icon, points = excluded.points, category = excluded.category;

create or replace function public.create_default_categories(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.categories (user_id, scope, name, color, icon) values
    (p_user,'despesa','Alimentação','#E59A4F','🍽️'),
    (p_user,'despesa','Mercado','#F2B84B','🛒'),
    (p_user,'despesa','Moradia','#7451A6','🏠'),
    (p_user,'despesa','Transporte','#5B8DEF','🚗'),
    (p_user,'despesa','Saúde','#3FAE7A','🩺'),
    (p_user,'despesa','Educação','#4F7CAC','🎓'),
    (p_user,'despesa','Lazer','#D96BA0','🎉'),
    (p_user,'despesa','Compras','#B07CC6','🛍️'),
    (p_user,'despesa','Assinaturas','#88708E','📺'),
    (p_user,'despesa','Investimentos','#2E9C8F','📈'),
    (p_user,'despesa','Outros','#9A93A8','✨'),
    (p_user,'receita','Salário','#3FAE7A','💼'),
    (p_user,'receita','Freelance','#2E9C8F','🧑‍💻'),
    (p_user,'receita','Rendimentos','#5B8DEF','📈'),
    (p_user,'receita','Outros','#9A93A8','✨'),
    (p_user,'tarefa','Pessoal','#7451A6','🌸'),
    (p_user,'tarefa','Trabalho','#5B8DEF','💼'),
    (p_user,'tarefa','Estudos','#4F7CAC','📚'),
    (p_user,'tarefa','Casa','#E59A4F','🏡'),
    (p_user,'tarefa','Saúde','#3FAE7A','🩺'),
    (p_user,'evento','Pessoal','#7451A6','🌸'),
    (p_user,'evento','Trabalho','#5B8DEF','💼'),
    (p_user,'evento','Saúde','#3FAE7A','🩺'),
    (p_user,'evento','Social','#D96BA0','🥂'),
    (p_user,'evento','Estudos','#4F7CAC','📚'),
    (p_user,'nota','Ideias','#BAAAC8','💡'),
    (p_user,'nota','Referências','#88708E','🔖')
  on conflict (user_id, scope, name) do nothing;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.automations (user_id, key, enabled)
  select new.id, k, true
  from unnest(array['tarefas_recorrentes','contas_fixas','tarefas_atrasadas','compromissos_proximos',
                    'vencimentos','resumo_manha','revisao_noite','relatorio_mensal',
                    'planejamento_semanal','sugerir_reagendamento','progresso_diario','atualizar_metas']) as k
  on conflict do nothing;

  perform public.create_default_categories(new.id);
  return new;
end $$;

revoke execute on function public.create_default_categories(uuid) from public, anon, authenticated;

-- >>> 20261125000003_storage.sql
-- =====================================================================
-- Supabase Storage: bucket privado "user-files".
-- Convenção de caminho: {user_id}/{pasta}/{arquivo}
-- Cada usuária só lê/escreve dentro da própria pasta.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-files', 'user-files', false, 10485760,
        array['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain'])
on conflict (id) do nothing;

create policy "arquivos_proprios_select" on storage.objects for select to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "arquivos_proprios_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "arquivos_proprios_update" on storage.objects for update to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "arquivos_proprios_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- >>> 20261125000004_push_subscriptions.sql
-- =====================================================================
-- Web Push: inscrições de dispositivos para notificações com o app fechado.
-- =====================================================================
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text check (char_length(user_agent) <= 300),
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  unique (endpoint)
);
create index on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "dono_select" on public.push_subscriptions for select using (user_id = auth.uid());
create policy "dono_insert" on public.push_subscriptions for insert with check (user_id = auth.uid());
create policy "dono_update" on public.push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "dono_delete" on public.push_subscriptions for delete using (user_id = auth.uid());
grant select, insert, update, delete on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from anon;
-- Reforço de segurança (avisos do Security Advisor do Supabase)
-- 1) search_path fixo na função de gatilho
alter function public.set_updated_at() set search_path = public;

-- 2) Funções SECURITY DEFINER: nada para o papel anônimo
revoke execute on function public.award_points(text, integer, text) from public, anon;
revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.award_points(text, integer, text) to authenticated, service_role;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated, service_role;

-- 3) handle_new_user é só gatilho: ninguém chama pela API
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- Provedor de IA autorizado pela usuária (o consentimento é específico por provedor)
alter table public.profiles add column if not exists ai_consent_provider text check (ai_consent_provider in ('anthropic','gemini'));
update public.profiles set ai_consent_provider = 'anthropic' where ai_consent_at is not null and ai_consent_provider is null;

alter table public.consents drop constraint if exists consents_kind_check;
alter table public.consents add constraint consents_kind_check check (kind in ('privacidade','ia','ia_google','ciclo','google_agenda','notificacoes'));
-- Google Tasks + alarmes no Google Agenda
alter table public.integrations add column if not exists tasks_list_id text;
alter table public.integrations add column if not exists tasks_synced_at timestamptz;
grant select (scope, tasks_synced_at) on public.integrations to authenticated;

-- Avisos com horário também como alarme no Google Agenda (a API do Google Tasks não guarda horário)
alter table public.profiles add column if not exists google_alarms boolean not null default true;

-- Vínculos entre itens do app e itens do Google (Tasks ou eventos-alarme do Agenda).
-- Escrita somente pelo servidor (service_role), sempre filtrando user_id.
create table public.google_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target text not null check (target in ('tasks','calendar')),
  source text not null check (source in ('task','habit','assessment','stage','chore','maintenance')),
  source_id uuid not null,
  occurrence text not null default '',
  remote_id text not null,
  remote_updated_at timestamptz,
  pushed_hash text,
  dismissed boolean not null default false,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, target, source, source_id, occurrence)
);
create index google_links_remote on public.google_links (user_id, target, remote_id);
alter table public.google_links enable row level security;
create policy "dono_select" on public.google_links for select using (user_id = auth.uid());
revoke all on public.google_links from anon, authenticated;
grant select on public.google_links to authenticated;
