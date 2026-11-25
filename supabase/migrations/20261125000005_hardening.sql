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
