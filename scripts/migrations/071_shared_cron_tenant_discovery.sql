-- 071_shared_cron_tenant_discovery.sql
-- Onda 10 / F7 passo 4 — descoberta de tenants p/ crons via SECURITY DEFINER
--
-- Contexto:
--   Os crons /api/cron/reminders e /api/cron/renew-webhook sao cross-tenant
--   por natureza. Pos-Item 11F ambos ja processam por tenant via
--   withTenantClient (Pattern S3), mas a "Query 0" de descoberta de tenants
--   rodava via pool SEM GUC direto em scheduled_reminders /
--   calendar_connections. Quando essas tabelas receberem ENABLE + FORCE
--   ROW LEVEL SECURITY (proxima migration da F7), app_tenant_id() (058)
--   levanta EXCEPTION sem GUC -> Query 0 explode -> cron inteiro morre.
--
--   Solucao (decisao A2, passo 4): mesmo precedente das migrations 014 e
--   070 — functions SECURITY DEFINER rodam como owner e furam a RLS
--   APENAS para a descoberta, retornando SOMENTE SETOF uuid (tenant_ids).
--   Nenhum dado de linha cruza a fronteira de tenant; o processamento
--   continua dentro de withTenantClient.
--
-- Diferenca deliberada vs 070: SET search_path fixado nas functions.
--   SECURITY DEFINER sem search_path fixo e vulneravel a hijack de schema
--   (CVE-class). 070 nao fixou; aqui fixamos por hardening — sem impacto
--   funcional (objetos estao em public).
--
-- Pre-condicoes:
--   - scheduled_reminders / calendar_connections existem (baseline)
--   - axis_app: rolsuper=f, rolbypassrls=f (validado em prod)
--   - aplicar ANTES de deployar a versao dos crons que chama estas funcoes
--   - a migration de RLS das 4 tabelas (calendar_connections, push_tokens,
--     patient_push_tokens, scheduled_reminders) vem DEPOIS desta
--
-- Reversivel: ver bloco ROLLBACK comentado abaixo.

-- =============================================================
-- VERIFICACAO POS-APLICACAO (rodar fora desta tx)
-- =============================================================
-- SELECT proname, prosecdef FROM pg_proc
-- WHERE proname IN ('pending_reminder_tenants', 'expiring_calendar_conn_tenants');
-- Esperado: 2 linhas, prosecdef = t
--
-- SET ROLE axis_app;
-- SELECT * FROM pending_reminder_tenants();
-- SELECT * FROM expiring_calendar_conn_tenants(NOW() + interval '1 day');
-- Esperado: 0+ rows de uuid (sem erro de RLS/GUC)
-- RESET ROLE;

-- =============================================================
-- ROLLBACK (DOWN — em caso de regressao)
-- =============================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS pending_reminder_tenants();
-- DROP FUNCTION IF EXISTS expiring_calendar_conn_tenants(timestamptz);
-- COMMIT;
-- (os crons que chamam as funcoes voltam a falhar; reverter tambem o
--  codigo de scheduler.ts / renew-webhook para a Query 0 direta)

BEGIN;

-- Tenants com lembretes de paciente pendentes de envio.
-- Espelha o WHERE da Query 1 per-tenant do scheduler.ts (sent=false,
-- recipient_type='patient', scheduled_time <= NOW()).
CREATE OR REPLACE FUNCTION pending_reminder_tenants()
RETURNS SETOF uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT tenant_id
    FROM scheduled_reminders
   WHERE sent = false
     AND recipient_type = 'patient'
     AND scheduled_time <= NOW();
$$;

-- Tenants com conexoes Google Calendar com webhook expirando antes de
-- p_expiring_before (ou sem webhook). Espelha o WHERE da Query 0 antiga
-- do /api/cron/renew-webhook.
CREATE OR REPLACE FUNCTION expiring_calendar_conn_tenants(p_expiring_before timestamptz)
RETURNS SETOF uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT tenant_id
    FROM calendar_connections
   WHERE provider = 'google'
     AND sync_enabled = true
     AND (webhook_expiration IS NULL OR webhook_expiration < p_expiring_before);
$$;

-- Permissoes: somente o user de runtime executa (mesmo padrao da 070)
REVOKE ALL ON FUNCTION pending_reminder_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pending_reminder_tenants() TO axis_app;

REVOKE ALL ON FUNCTION expiring_calendar_conn_tenants(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expiring_calendar_conn_tenants(timestamptz) TO axis_app;

COMMIT;
