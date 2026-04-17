-- =====================================================
-- Migration 052: Fix GUC mismatch em policies Operadora (v2.7.0)
--
-- BUG EM PRODUÇÃO (16/04/2026):
--   Requisições a service_sites, session_presence_proofs,
--   session_attestations, session_evidence_bundles e session_attachments
--   estouravam SQLSTATE 42704:
--     ERROR: unrecognized configuration parameter "app.current_org"
--
-- CAUSA RAIZ:
--   As policies originais (migrations 033 e 034) liam
--   current_setting('app.current_org')::uuid — mas withTenant()
--   (src/database/with-tenant.ts, linha 188) seta 'app.tenant_id',
--   não 'app.current_org'. GUC name mismatch.
--
-- FIX:
--   1. DROP das 5 policies quebradas e CREATE com o GUC correto
--      ('app.tenant_id') — convenção dominante (13+ migrations usam).
--   2. Adiciona missing_ok=true em current_setting() como defesa em
--      profundidade: se o GUC não for setado em alguma sessão futura,
--      a policy retorna NULL e bloqueia a row em vez de estourar 42704.
--
-- SEGURANÇA:
--   - 100% ADITIVA / IDEMPOTENTE. Só troca policies.
--   - Não toca dados, motor CSO v2.6.1, ou schema.
--   - Reversível: recriar policies com 'app.current_org' volta ao estado anterior.
--
-- Ref: skill_axis_aba_v270.md (Sprint 0 + Sprint 1)
-- Depende: Migrations 033, 034 (criaram as tabelas e as policies antigas)
-- Data: 2026-04-16
-- =====================================================


-- ─────────────────────────────────────────────────────
-- §1. service_sites (Sprint 0 — migration 033)
-- ─────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS service_sites_tenant_isolation ON service_sites;
  CREATE POLICY service_sites_tenant_isolation ON service_sites
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN others THEN NULL;
END $$;


-- ─────────────────────────────────────────────────────
-- §2. session_presence_proofs (Sprint 1 — migration 034)
-- ─────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS presence_proofs_tenant_isolation ON session_presence_proofs;
  CREATE POLICY presence_proofs_tenant_isolation ON session_presence_proofs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN others THEN NULL;
END $$;


-- ─────────────────────────────────────────────────────
-- §3. session_attestations (Sprint 1 — migration 034)
-- ─────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS attestations_tenant_isolation ON session_attestations;
  CREATE POLICY attestations_tenant_isolation ON session_attestations
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN others THEN NULL;
END $$;


-- ─────────────────────────────────────────────────────
-- §4. session_evidence_bundles (Sprint 1 — migration 034)
-- ─────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS evidence_bundles_tenant_isolation ON session_evidence_bundles;
  CREATE POLICY evidence_bundles_tenant_isolation ON session_evidence_bundles
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN others THEN NULL;
END $$;


-- ─────────────────────────────────────────────────────
-- §5. session_attachments (Sprint 1 — migration 034)
-- ─────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS attachments_tenant_isolation ON session_attachments;
  CREATE POLICY attachments_tenant_isolation ON session_attachments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN others THEN NULL;
END $$;


-- =====================================================
-- VERIFICAÇÃO PÓS-DEPLOY (executar manualmente após migrar):
--
--   SELECT schemaname, tablename, policyname, qual
--   FROM pg_policies
--   WHERE tablename IN (
--     'service_sites','session_presence_proofs','session_attestations',
--     'session_evidence_bundles','session_attachments'
--   );
--
--   Esperado: nenhuma linha com 'app.current_org' em `qual`.
--   Todas devem ter `app.tenant_id`.
-- =====================================================
-- FIM Migration 052
-- =====================================================
