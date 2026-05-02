-- 057_tdah_rls_phase_a.sql
-- Item 11 Onda 7 - RLS Fase A em 5 tabelas nucleo TDAH
-- Padrao: tenant_isolation FOR ALL USING/WITH CHECK = app_tenant_id()
--
-- Pre-condicoes verificadas em 29/04/2026:
--   - tenant_id NOT NULL nas 5 tabelas
--   - withTenant.ts usa set_config local=true
--   - 100% rotas /api/tdah/* cobertas por withTenant
--   - app_tenant_id() levanta exception se GUC ausente
--   - axis_app: rolsuper=f, rolbypassrls=f (validado empiricamente em staging)
--   - axis_app tem SELECT/INSERT/UPDATE/DELETE nas 5 tabelas
--   - Baseline pre-RLS: tdah_patients = 12 rows (axis_app sem GUC)
--
-- Reversivel: ver blocos VERIFICACAO POS-APLICACAO e ROLLBACK (DOWN) abaixo (comentados).

-- =============================================================
-- VERIFICACAO POS-APLICACAO (rodar fora desta tx)
-- =============================================================
-- SELECT tablename, rowsecurity, forcerowsecurity
-- FROM pg_tables
-- WHERE schemaname='public'
--   AND tablename IN ('tdah_patients','tdah_sessions','tdah_observations','tdah_events','tdah_snapshots')
-- ORDER BY tablename;
-- Esperado: 5 linhas, rowsecurity=t e forcerowsecurity=t para todas
--
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname='public' AND tablename LIKE 'tdah_%'
-- ORDER BY tablename;
-- Esperado: 5 linhas, todas com policyname='tenant_isolation' e cmd='ALL'


-- =============================================================
-- ROLLBACK (DOWN - em caso de regressao)
-- =============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS tenant_isolation ON tdah_patients;
-- DROP POLICY IF EXISTS tenant_isolation ON tdah_sessions;
-- DROP POLICY IF EXISTS tenant_isolation ON tdah_observations;
-- DROP POLICY IF EXISTS tenant_isolation ON tdah_events;
-- DROP POLICY IF EXISTS tenant_isolation ON tdah_snapshots;
-- ALTER TABLE tdah_patients DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE tdah_sessions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE tdah_observations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE tdah_events DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE tdah_snapshots DISABLE ROW LEVEL SECURITY;
-- COMMIT;

BEGIN;

-- =============================================================
-- 1) tdah_patients
-- =============================================================
ALTER TABLE tdah_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_patients FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_patients;
CREATE POLICY tenant_isolation ON tdah_patients
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 2) tdah_sessions
-- =============================================================
ALTER TABLE tdah_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_sessions;
CREATE POLICY tenant_isolation ON tdah_sessions
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 3) tdah_observations
-- =============================================================
ALTER TABLE tdah_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_observations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_observations;
CREATE POLICY tenant_isolation ON tdah_observations
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 4) tdah_events
-- =============================================================
ALTER TABLE tdah_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_events;
CREATE POLICY tenant_isolation ON tdah_events
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 5) tdah_snapshots
-- =============================================================
ALTER TABLE tdah_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_snapshots FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_snapshots;
CREATE POLICY tenant_isolation ON tdah_snapshots
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

COMMIT;
