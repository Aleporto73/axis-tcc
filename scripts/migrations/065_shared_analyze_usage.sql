-- 065_shared_analyze_usage.sql
-- AXIS - Item 2 Onda 7 - Quota + audit de chamadas LLM analyze-clinical/analyze-tcc
--
-- Contexto:
--   Auditoria do Item 2 (governance analyze-clinical) revelou que as 2 rotas
--   analyze-* (analyze-clinical, analyze-tcc) chamam OpenAI (gpt-4o-mini) sem:
--     - quota por tenant (custo descontrolado em planos free)
--     - audit log (uso por tenant nao rastreavel)
--     - persistencia da analise
--   Helper transcription-limit.ts ja existe pra transcribe-audio mas nao
--   cobre analyze. Esta tabela espelha o pattern de transcription_usage
--   mas em modelo per-row (mais flexivel pra audit detalhado, query de
--   quota usa COUNT). Volume estimado: 50/mes/tenant x 1000 tenants x
--   12 meses = 600K rows/ano - irrelevante pra storage.
--
-- Schema:
--   id                UUID PK
--   tenant_id         UUID NOT NULL FK->tenants (CASCADE)
--   user_id           VARCHAR NOT NULL (clerk_user_id, padrao axis_audit_logs)
--   route             VARCHAR(32) NOT NULL CHECK ('analyze-clinical'|'analyze-tcc')
--   tokens_used       INT NOT NULL DEFAULT 0 (response.usage.total_tokens)
--   model             VARCHAR(64) NOT NULL DEFAULT 'gpt-4o-mini'
--   patient_id        UUID NULL FK->patients (SET NULL on delete - audit preservado)
--   transcript_length INT NULL (chars do input - audit/analytics)
--   created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
--
-- Indexes:
--   idx_analyze_usage_tenant_created  (tenant_id, created_at DESC) - quota query
--   idx_analyze_usage_route            (tenant_id, route, created_at DESC) - dashboard breakdown
--
-- RLS: tenant_isolation FOR ALL USING/WITH CHECK = app_tenant_id()
--   (padrao pos-Item 11E unificado em todo o schema TDAH+TCC+ABA).
--
-- Pre-requisito: app_tenant_id() versionada (migration 058).
--
-- Uso do helper (src/services/analyze-limit.ts):
--   getAnalyzeUsage(client, tenantId) -> { requests_used, limit, is_free, ... }
--     - Free: limit = 50 requests/30 dias rolling
--     - Pago: limit = null (ilimitado)
--   recordAnalyzeUsage(client, params) -> INSERT 1 row apos sucesso OpenAI
--
-- Reversao manual:
--   BEGIN;
--   DROP TABLE IF EXISTS analyze_usage CASCADE;
--   COMMIT;
--
-- Backup PRE-aplicacao recomendado:
--   pg_dump --schema=public -t analyze_usage > /root/backups/065_pre/<env>_<ts>.sql
--   (no-op em ambiente novo - tabela ainda nao existe)

BEGIN;

-- Pre-requisito: app_tenant_id() existe (migration 058)
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_id'
  ) THEN
    RAISE EXCEPTION '[AXIS-065] funcao public.app_tenant_id() ausente. Aplicar migration 058 antes desta.';
  END IF;
END
$check$;

-- =============================================================
-- 1) Tabela analyze_usage
-- =============================================================
CREATE TABLE IF NOT EXISTS analyze_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           VARCHAR NOT NULL,
  route             VARCHAR(32) NOT NULL
    CHECK (route IN ('analyze-clinical','analyze-tcc')),
  tokens_used       INT NOT NULL DEFAULT 0,
  model             VARCHAR(64) NOT NULL DEFAULT 'gpt-4o-mini',
  patient_id        UUID NULL REFERENCES patients(id) ON DELETE SET NULL,
  transcript_length INT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 2) Indexes
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_analyze_usage_tenant_created
  ON analyze_usage(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analyze_usage_route
  ON analyze_usage(tenant_id, route, created_at DESC);

-- =============================================================
-- 3) RLS forced+enabled (padrao pos-Item 11E)
-- =============================================================
ALTER TABLE analyze_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyze_usage FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON analyze_usage;
CREATE POLICY tenant_isolation ON analyze_usage
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 4) Validacao POS: tabela criada com RLS forced
-- =============================================================
DO $verify$
DECLARE
  v_rls_forced BOOLEAN;
  v_policy_exists BOOLEAN;
BEGIN
  SELECT relforcerowsecurity INTO v_rls_forced
    FROM pg_class WHERE relname = 'analyze_usage' AND relkind = 'r';

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'analyze_usage'
       AND policyname = 'tenant_isolation'
       AND qual LIKE '%app_tenant_id()%'
  ) INTO v_policy_exists;

  IF NOT v_rls_forced THEN
    RAISE EXCEPTION '[AXIS-065 POS] FALHA: analyze_usage sem RLS forced';
  END IF;

  IF NOT v_policy_exists THEN
    RAISE EXCEPTION '[AXIS-065 POS] FALHA: policy tenant_isolation com app_tenant_id() ausente';
  END IF;

  RAISE NOTICE '[AXIS-065 POS] OK: analyze_usage criada, RLS forced, policy app_tenant_id()';
END
$verify$;

COMMIT;
