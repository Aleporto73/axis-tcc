-- 059_tdah_rls_phase_b_1.sql
-- Item 11 Onda 7 - RLS Fase B.1 em 4 tabelas TDAH (portais publicos)
-- Padrao: tenant_isolation FOR ALL USING/WITH CHECK = app_tenant_id()
--
-- Pre-condicoes verificadas empiricamente em prod (29/04/2026):
--   - tenant_id NOT NULL nas 4 tabelas (information_schema)
--   - Zero rows orfas (COUNT FILTER WHERE tenant_id IS NULL = 0)
--   - 19 rotas autenticadas /api/tdah/* todas cobertas por withTenant/withRole
--   - 3 portais publicos (familia, escola, escola/drc) com wrap Caminho 2 v3
--     (BEGIN + set_config('app.tenant_id', $1, true) + COMMIT em 2 pontos cada)
--   - app_tenant_id() versionada em migration 058 (no-op em prod, ja existia)
--   - Build prod OK pos-Fase-B.0 (commit 9d14f21), smoke escola HTTP 200
--
-- Reversao manual (nao incluida no script pra nao quebrar validate-migrations):
--   BEGIN;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_drc;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_protocols;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_teacher_tokens;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_teacher_access_log;
--   ALTER TABLE tdah_drc DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_protocols DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_teacher_tokens DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_teacher_access_log DISABLE ROW LEVEL SECURITY;
--   COMMIT;
-- (Use apenas em rollback completo da Fase B.1.)

BEGIN;

-- =============================================================
-- 1) tdah_drc
-- =============================================================
ALTER TABLE tdah_drc ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_drc FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_drc;
CREATE POLICY tenant_isolation ON tdah_drc
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 2) tdah_protocols
-- =============================================================
ALTER TABLE tdah_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_protocols FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_protocols;
CREATE POLICY tenant_isolation ON tdah_protocols
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 3) tdah_teacher_tokens
-- =============================================================
ALTER TABLE tdah_teacher_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_teacher_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_teacher_tokens;
CREATE POLICY tenant_isolation ON tdah_teacher_tokens
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 4) tdah_teacher_access_log
-- =============================================================
ALTER TABLE tdah_teacher_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_teacher_access_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_teacher_access_log;
CREATE POLICY tenant_isolation ON tdah_teacher_access_log
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

COMMIT;
