-- 060_tdah_rls_phase_b_1_corrected.sql
-- Item 11 Onda 7 - RLS Fase B.1 CORRIGIDA em 3 tabelas TDAH
-- Padrao: tenant_isolation FOR ALL USING/WITH CHECK = app_tenant_id()
--
-- Contexto: 059_tdah_rls_phase_b_1.sql (commit da21614) tentou ativar
-- RLS em 4 tabelas (tdah_drc, tdah_protocols, tdah_teacher_tokens,
-- tdah_teacher_access_log). Falhou no smoke escola GET com HTTP 500
-- "[AXIS RLS] app.tenant_id nao definido na sessao" porque
-- tdah_teacher_tokens e' lida em validateToken Etapa 1 ANTES de saber
-- tenant_id (chicken-and-egg). Aviso ja constava nos comentarios dos
-- proprios portais escola/[token]/route.ts e escola/[token]/drc/route.ts
-- mas foi ignorado na 059.
--
-- Rollback de 059 em staging: DROP POLICY + DISABLE+NO FORCE em todas as
-- 4 tabelas. Staging voltou HTTP 200. Prod nunca recebeu 059.
--
-- Esta migration (060) corrige excluindo tdah_teacher_tokens. Tokens
-- (teacher + family) precisam design dedicado: validateToken Etapa 1 le
-- token SEM tenant_id setado, RLS bloqueia. Decisao futura (sub-fase
-- dedicada antes da B.4):
--   (a) Tokens permanecem fora de RLS - UUID hex64 globalmente unico,
--       SELECT cego sem WHERE tenant_id nao revela cross-tenant porque
--       nao ha como adivinhar token de outro tenant; OU
--   (b) Policy especial - RLS BYPASS em SELECT por token, mas FORCE em
--       UPDATE/INSERT/DELETE.
-- Decisao adiada para sessao dedicada.
--
-- Pre-condicoes verificadas em prod (29/04/2026):
--   - tenant_id NOT NULL nas 3 tabelas (information_schema)
--   - Zero rows orfas (COUNT FILTER WHERE tenant_id IS NULL = 0)
--   - 19 rotas autenticadas /api/tdah/* todas cobertas por withTenant
--   - 3 portais publicos com wrap Caminho 2 v3 (set_config app.tenant_id)
--   - app_tenant_id() versionada em migration 058
--   - Smoke escola GET prod HTTP 200 pos-Fase-B.0 (commit 9d14f21)
--   - Staging confirmou: rollback 059 deixou ambiente verde
--
-- Reversao manual (nao incluida no script pra nao quebrar validate-migrations):
--   BEGIN;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_drc;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_protocols;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_teacher_access_log;
--   ALTER TABLE tdah_drc DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_drc NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_protocols DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_protocols NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_teacher_access_log DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_teacher_access_log NO FORCE ROW LEVEL SECURITY;
--   COMMIT;

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
-- 3) tdah_teacher_access_log
-- =============================================================
ALTER TABLE tdah_teacher_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_teacher_access_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_teacher_access_log;
CREATE POLICY tenant_isolation ON tdah_teacher_access_log
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

COMMIT;
