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
