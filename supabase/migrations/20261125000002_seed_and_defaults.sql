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
