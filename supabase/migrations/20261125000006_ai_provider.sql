-- Provedor de IA autorizado pela usuária (o consentimento é específico por provedor)
alter table public.profiles add column if not exists ai_consent_provider text check (ai_consent_provider in ('anthropic','gemini'));
update public.profiles set ai_consent_provider = 'anthropic' where ai_consent_at is not null and ai_consent_provider is null;

alter table public.consents drop constraint if exists consents_kind_check;
alter table public.consents add constraint consents_kind_check check (kind in ('privacidade','ia','ia_google','ciclo','google_agenda','notificacoes'));
