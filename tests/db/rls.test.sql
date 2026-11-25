-- Testes de integração do banco: isolamento entre usuárias (RLS),
-- restrições de integridade e funções. Falha => exceção => exit != 0.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.local', '{"full_name":"Ana"}'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.local', '{"full_name":"Bia"}');

-- 1) Trigger criou perfis, automações e categorias padrão
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'perfis não criados';
  assert (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Ana', 'nome não copiado';
  assert (select count(*) from public.automations where user_id = '11111111-1111-1111-1111-111111111111') = 12, 'automações padrão';
  assert (select count(*) from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and scope = 'despesa') = 11, 'categorias de despesa';
end $$;

-- 2) Ana cria dados como "authenticated"
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
insert into public.tasks (title) values ('Tarefa da Ana');
insert into public.financial_accounts (name, initial_balance) values ('Conta Ana', 100.10);
insert into public.notes (title, content) values ('Nota secreta', 'conteúdo');
insert into public.cycle_periods (start_date) values ('2026-11-01');

do $$ begin
  assert (select count(*) from public.tasks) = 1, 'Ana deveria ver a própria tarefa';
  assert (select user_id from public.tasks limit 1) = '11111111-1111-1111-1111-111111111111', 'user_id default auth.uid()';
end $$;

-- 3) Bia não enxerga, não altera e não apaga dados da Ana
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$
declare n int;
begin
  assert (select count(*) from public.tasks) = 0, 'VAZAMENTO: Bia viu tarefas da Ana';
  assert (select count(*) from public.notes) = 0, 'VAZAMENTO: Bia viu notas da Ana';
  assert (select count(*) from public.cycle_periods) = 0, 'VAZAMENTO: dados de ciclo';
  assert (select count(*) from public.profiles) = 1, 'Bia deveria ver apenas o próprio perfil';
  update public.tasks set title = 'hackeado';
  get diagnostics n = row_count;
  assert n = 0, 'Bia conseguiu atualizar tarefa alheia';
  delete from public.financial_accounts;
  get diagnostics n = row_count;
  assert n = 0, 'Bia conseguiu apagar conta alheia';
end $$;

-- 4) Bia não consegue inserir registro em nome da Ana
do $$ begin
  begin
    insert into public.tasks (user_id, title) values ('11111111-1111-1111-1111-111111111111', 'injetada');
    raise exception 'FALHA: insert com user_id alheio foi aceito';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 5) Restrições financeiras
do $$ begin
  begin
    insert into public.transactions (type, amount, description) values ('despesa', -5, 'negativo');
    raise exception 'FALHA: valor negativo aceito';
  exception when check_violation then null;
  end;
  begin
    insert into public.transactions (type, amount, description) values ('transferencia', 10, 'sem contas');
    raise exception 'FALHA: transferência sem contas aceita';
  exception when check_violation then null;
  end;
  begin
    insert into public.sleep_logs (sleep_date, bed_at, wake_at, duration_minutes)
    values ('2026-11-20', '2026-11-20 07:00-03', '2026-11-19 23:00-03', 480);
    raise exception 'FALHA: sono com acordar antes de dormir';
  exception when check_violation then null;
  end;
end $$;
-- precisão decimal
insert into public.financial_accounts (name, initial_balance) values ('Conta Bia', 0.1);
insert into public.transactions (type, amount, description, account_id)
  select 'receita', 0.2, 'centavos', id from public.financial_accounts where name = 'Conta Bia';
do $$ begin
  assert (select initial_balance + (select sum(amount) from public.transactions) from public.financial_accounts where name='Conta Bia') = 0.30, 'precisão decimal';
end $$;

-- 6) Integrações: tokens não legíveis pela usuária
reset role;
insert into public.integrations (user_id, provider, access_token_enc, refresh_token_enc)
values ('22222222-2222-2222-2222-222222222222', 'google_calendar', 'enc', 'enc');
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$ begin
  assert (select status from public.integrations) = 'ativa', 'status deveria ser legível';
  begin
    perform access_token_enc from public.integrations;
    raise exception 'FALHA: token legível pelo cliente';
  exception when insufficient_privilege then null;
  end;
end $$;
delete from public.integrations;
do $$ begin assert (select count(*) from public.integrations) = 0, 'revogação falhou'; end $$;

-- 7) Pontos: só via função, com deduplicação; sem escrita direta
do $$ begin
  assert public.award_points('tarefa', 10, 'tarefa:1') = 10, 'pontos 1';
  assert public.award_points('tarefa', 10, 'tarefa:1') = 10, 'dedupe de pontos';
  assert public.award_points('tarefa', 5, 'tarefa:2') = 15, 'pontos 2';
  begin
    insert into public.point_events (source, points, dedupe_key) values ('x', 999, 'x');
    raise exception 'FALHA: escrita direta de pontos';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 8) Rate limit
do $$ declare ok boolean; begin
  assert public.consume_rate_limit('teste', 2, 60) = true, 'rl 1';
  assert public.consume_rate_limit('teste', 2, 60) = true, 'rl 2';
  assert public.consume_rate_limit('teste', 2, 60) = false, 'rl 3 deveria bloquear';
end $$;

-- 9) Storage: pasta alheia bloqueada
do $$ begin
  insert into storage.objects (bucket_id, name) values ('user-files', '22222222-2222-2222-2222-222222222222/avatar.png');
  begin
    insert into storage.objects (bucket_id, name) values ('user-files', '11111111-1111-1111-1111-111111111111/x.png');
    raise exception 'FALHA: upload em pasta alheia';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 9b) Web Push: inscrição só da própria usuária
do $$ begin
  insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/bia', 'k', 'a');
  begin
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('11111111-1111-1111-1111-111111111111', 'https://push.example/x', 'k', 'a');
    raise exception 'FALHA: inscrição em nome de outra usuária';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.push_subscriptions (endpoint, p256dh, auth) values ('http://inseguro', 'k', 'a');
    raise exception 'FALHA: endpoint sem https aceito';
  exception when check_violation then null;
  end;
  assert (select count(*) from public.push_subscriptions) = 1, 'Bia deveria ver só a própria inscrição';
end $$;

-- 10) anon não lê nada
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.tasks;
    raise exception 'FALHA: anon leu tarefas';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 11) Exclusão de conta remove tudo (cascade)
reset role;
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select count(*) from public.tasks where user_id = '11111111-1111-1111-1111-111111111111') = 0, 'cascade tarefas';
  assert (select count(*) from public.cycle_periods where user_id = '11111111-1111-1111-1111-111111111111') = 0, 'cascade ciclo';
  assert (select count(*) from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 0, 'cascade perfil';
end $$;

rollback;
\echo 'OK: todos os testes de banco passaram'
