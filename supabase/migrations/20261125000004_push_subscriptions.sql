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
