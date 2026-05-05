-- 068_shared_events_rls_forced.sql
-- Onda 9 Bloco G.1 — RLS forced em events (HUB-05.A FECHADO)
--
-- Contexto:
--   PONTOS_ATENCAO_ARQUITETURAL.md HUB-05.A FECHADO em 05/05/2026.
--   events tem tenant_id NOT NULL desde migration 001 e 100% dos
--   callers runtime estao em withTenant (mapeamento empirico Bloco G PRE-CHECK):
--     - app/api/events/create
--     - app/api/patients/[id]/evolution
--     - app/api/patients/[id] (DELETE em transacao)
--     - app/api/sessions/[id]/finish
--     - app/api/sessions/[id]/report/generate
--   Sem callers cross-tenant em runtime.
--
-- Pre-condicoes verificadas em 05/05/2026:
--   - tenant_id NOT NULL em events (001:148)
--   - withTenant.ts usa set_config local=true
--   - 100% callers runtime cobertos por withTenant
--   - app_tenant_id() versionada em 058 (levanta exception se GUC ausente)
--   - axis_app: rolsuper=f, rolbypassrls=f (validado empiricamente em prod)
--
-- HUB-05.B (calendar_connections) adiado para Onda 10 — exige refator
-- previo de 5 rotas (cron renew-webhook, webhooks Google TCC+ABA, OAuth
-- callbacks TCC+ABA, sessions/create createGoogleCalendarEvent).
--
-- Reversivel: ver bloco ROLLBACK comentado abaixo.

-- =============================================================
-- VERIFICACAO POS-APLICACAO (rodar fora desta tx)
-- =============================================================
-- SELECT tablename, rowsecurity, forcerowsecurity
-- FROM pg_tables
-- WHERE schemaname='public' AND tablename='events';
-- Esperado: 1 linha, rowsecurity=t e forcerowsecurity=t
--
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname='public' AND tablename='events';
-- Esperado: 1 linha, policyname='tenant_isolation' e cmd='ALL'

-- =============================================================
-- ROLLBACK (DOWN — em caso de regressao)
-- =============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS tenant_isolation ON events;
-- ALTER TABLE events DISABLE ROW LEVEL SECURITY;
-- COMMIT;

BEGIN;

-- =============================================================
-- 1) Pre-requisito: app_tenant_id() existe (migration 058)
-- =============================================================
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_id'
  ) THEN
    RAISE EXCEPTION '[AXIS-068] funcao public.app_tenant_id() ausente. Aplicar migration 058 antes desta.';
  END IF;
END
$check$;

-- =============================================================
-- 2) events
-- =============================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON events;
CREATE POLICY tenant_isolation ON events
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

COMMIT;
