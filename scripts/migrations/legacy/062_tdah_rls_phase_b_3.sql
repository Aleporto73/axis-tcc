-- 062_tdah_rls_phase_b_3.sql
-- Item 11 Onda 7 - RLS Fase B.3 em 5 tabelas internas TDAH (baixo risco)
-- Padrao: tenant_isolation FOR ALL USING/WITH CHECK = app_tenant_id()
--
-- Contexto: apos Fase A (5 tabelas nucleo, commit 9c99182) e Fase B.1
-- (3 tabelas portais publicos, commit 6b97ac8 mergeado), restavam 7
-- tabelas tdah_* sem RLS. Decisao 11D (commit 69f5014) tirou
-- tdah_teacher_tokens e tdah_family_tokens da fila permanentemente
-- (Caminho A: hex64 UNIQUE + chicken-and-egg). Sobram 5 tabelas
-- internas, todas servidas apenas por rotas autenticadas Clerk com
-- middleware withTenant/withRole - baixo risco, sem chicken-and-egg.
--
-- Pre-condicoes verificadas empiricamente em prod (30/04/2026 manha):
--   - tenant_id NOT NULL nas 5 tabelas (information_schema)
--   - Zero rows orfas (rows totais = sum por tenant_id distinto)
--   - 18 rotas autenticadas tocam estas tabelas (com overlap):
--       tdah_token_transactions: 3 rotas
--       tdah_guardians:          6 rotas
--       tdah_patient_therapists: 7 rotas + src/database/with-role.ts + 2 testes
--       tdah_plans:              2 rotas
--       tdah_plan_goals:         2 rotas
--     TODAS cobertas por withTenant/withRole - middleware seta GUC
--     app.tenant_id antes de qualquer query nas tabelas RLS-protected.
--   - Nada de chicken-and-egg: rotas autenticadas resolvem tenant_id
--     via Clerk auth + cookie axis_active_tenant ANTES de tocar DB.
--   - app_tenant_id() versionada em migration 058 (commit d98285a)
--   - Default global app.tenant_id removido em prod via 061 (commit
--     cc41ece) - fail-loud restaurado
--
-- ATENCAO ESPECIAL - tdah_patient_therapists:
--   Esta tabela e BASE do sistema de roles TDAH (lida em
--   src/database/with-role.ts). Ativar RLS nela afeta autorizacao,
--   nao so isolamento de dados. Smoke staging deve cobrir explicitamente:
--     - Login como terapeuta com vinculo N:N a paciente -> deve funcionar
--     - Verificar canAccessTdahPatient() ainda retorna true/false correto
--     - Verificar tdahPatientFilter() em queries de listagem
--   Se with-role.ts nao tiver tenant_id setado quando consulta
--   tdah_patient_therapists (improvavel - withTenant precede withRole),
--   RLS bloqueia e quebra autorizacao silenciosamente (return null/empty).
--
-- Reversao manual (nao incluida no script pra nao quebrar validate-migrations):
--   BEGIN;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_token_transactions;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_guardians;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_patient_therapists;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_plans;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_plan_goals;
--   ALTER TABLE tdah_token_transactions DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_token_transactions NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_guardians DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_guardians NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_patient_therapists DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_patient_therapists NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_plans DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_plans NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_plan_goals DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_plan_goals NO FORCE ROW LEVEL SECURITY;
--   COMMIT;
-- (Use apenas em rollback completo da Fase B.3.)

BEGIN;

-- =============================================================
-- 1) tdah_token_transactions
-- =============================================================
ALTER TABLE tdah_token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_token_transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_token_transactions;
CREATE POLICY tenant_isolation ON tdah_token_transactions
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 2) tdah_guardians
-- =============================================================
ALTER TABLE tdah_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_guardians FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_guardians;
CREATE POLICY tenant_isolation ON tdah_guardians
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 3) tdah_patient_therapists  [ATENCAO: base do sistema de roles]
-- =============================================================
-- Esta tabela e lida em src/database/with-role.ts. RLS aqui afeta
-- autorizacao (canAccessTdahPatient, tdahPatientFilter), nao so
-- isolamento. Pre-condicao: withTenant SEMPRE precede withRole no
-- pipeline de middleware - GUC app.tenant_id estara setado quando
-- with-role.ts consultar esta tabela.
ALTER TABLE tdah_patient_therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_patient_therapists FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_patient_therapists;
CREATE POLICY tenant_isolation ON tdah_patient_therapists
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 4) tdah_plans
-- =============================================================
ALTER TABLE tdah_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_plans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_plans;
CREATE POLICY tenant_isolation ON tdah_plans
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 5) tdah_plan_goals
-- =============================================================
ALTER TABLE tdah_plan_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_plan_goals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_plan_goals;
CREATE POLICY tenant_isolation ON tdah_plan_goals
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

COMMIT;
