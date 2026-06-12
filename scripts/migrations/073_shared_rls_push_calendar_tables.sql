-- 073_shared_rls_push_calendar_tables.sql
-- Onda 10 / F7 passo 6 (FINAL) — RLS forced em calendar_connections,
-- push_tokens, patient_push_tokens, scheduled_reminders (HUB-05.B FECHADO)
--
-- Contexto:
--   Passo final da Onda 10/F7. Os passos 1-5 eliminaram TODOS os callers
--   sem-GUC nas 4 tabelas:
--     1. reminder.ts recebe client do withTenant (sessions/create).
--     2. push/send exige tenant_id + withTenantClient.
--     3. patient/push/authorize via SECURITY DEFINER (070) + withTenantClient.
--     4. crons reminders/renew-webhook: Pattern S3 + descoberta de tenants
--        via SECURITY DEFINER (071); helpers mortos deletados.
--     5. webhooks Google TCC+ABA: lookup por channel via SECURITY DEFINER
--        (072); demais rotas Google ja eram withTenant/withTenantClient.
--   Mapeamento empirico: zero queries via pool sem GUC restantes.
--
-- ORDEM CRITICA DE DEPLOY — esta migration e a ULTIMA da onda:
--   1. Migrations 070, 071 e 072 APLICADAS em prod.
--   2. Deploys de codigo dos passos 1-5 em prod (crons, webhooks, push).
--   3. SO ENTAO aplicar esta 073.
--   Aplicar antes disso QUEBRA crons (reminders/renew-webhook), webhooks
--   Google e push — app_tenant_id() (058) levanta EXCEPTION sem GUC.
--
-- Pre-condicoes (mesmas garantias da 068):
--   - tenant_id uuid NOT NULL nas 4 tabelas (baseline)
--   - withTenant.ts / withTenantClient usam set_config local=true
--   - app_tenant_id() versionada em 058 (levanta exception se GUC ausente)
--   - axis_app: rolsuper=f, rolbypassrls=f (validado empiricamente em prod)
--   - axis_app ja possui DML nas 4 tabelas (RLS restringe, nao concede —
--     sem GRANTs novos, igual 068)
--   - SECURITY DEFINER 070/071/072 furam a RLS apenas nos lookups pontuais
--
-- Reversivel: ver bloco ROLLBACK comentado abaixo.

-- =============================================================
-- VERIFICACAO POS-APLICACAO (rodar fora desta tx)
-- =============================================================
-- SELECT tablename, rowsecurity, forcerowsecurity
-- FROM pg_tables
-- WHERE schemaname='public'
--   AND tablename IN ('calendar_connections','push_tokens',
--                     'patient_push_tokens','scheduled_reminders');
-- Esperado: 4 linhas, rowsecurity=t e forcerowsecurity=t em todas
--
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname='public'
--   AND tablename IN ('calendar_connections','push_tokens',
--                     'patient_push_tokens','scheduled_reminders');
-- Esperado: 4 linhas, policyname='tenant_isolation' e cmd='ALL'
--
-- Teste de isolamento (como axis_app):
-- SET ROLE axis_app;
-- SELECT COUNT(*) FROM scheduled_reminders;
-- Esperado: ERRO [AXIS RLS] app.tenant_id nao definido na sessao
-- BEGIN;
-- SELECT set_config('app.tenant_id', '<tenant_uuid_real>', true);
-- SELECT COUNT(*) FROM scheduled_reminders;  -- so linhas do tenant
-- ROLLBACK;
-- RESET ROLE;
--
-- Smoke test pos-deploy:
-- curl -H "Authorization: Bearer $CRON_SECRET" <app>/api/cron/reminders
-- curl -H "Authorization: Bearer $CRON_SECRET" <app>/api/cron/renew-webhook
-- Esperado: 200 com success:true (descoberta via 071 funciona sem GUC)

-- =============================================================
-- ROLLBACK (DOWN — em caso de regressao)
-- =============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS tenant_isolation ON calendar_connections;
-- ALTER TABLE calendar_connections DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS tenant_isolation ON push_tokens;
-- ALTER TABLE push_tokens DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS tenant_isolation ON patient_push_tokens;
-- ALTER TABLE patient_push_tokens DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS tenant_isolation ON scheduled_reminders;
-- ALTER TABLE scheduled_reminders DISABLE ROW LEVEL SECURITY;
-- COMMIT;
-- (codigo dos passos 1-5 continua funcionando sem RLS — nao precisa reverter)

BEGIN;

-- =============================================================
-- 1) Pre-requisito: app_tenant_id() existe (migration 058)
-- =============================================================
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_id'
  ) THEN
    RAISE EXCEPTION '[AXIS-073] funcao public.app_tenant_id() ausente. Aplicar migration 058 antes desta.';
  END IF;
END
$check$;

-- =============================================================
-- 2) Pre-requisito: lookups SECURITY DEFINER existem (070/071/072)
-- =============================================================
DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'patient_push_token_lookup')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'pending_reminder_tenants')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'expiring_calendar_conn_tenants')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calendar_webhook_lookup')
  THEN
    RAISE EXCEPTION '[AXIS-073] lookups SECURITY DEFINER ausentes. Aplicar migrations 070, 071 e 072 antes desta.';
  END IF;
END
$check$;

-- =============================================================
-- 3) calendar_connections
-- =============================================================
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_connections FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON calendar_connections;
CREATE POLICY tenant_isolation ON calendar_connections
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 4) push_tokens
-- =============================================================
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON push_tokens;
CREATE POLICY tenant_isolation ON push_tokens
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 5) patient_push_tokens
-- =============================================================
ALTER TABLE patient_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_push_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON patient_push_tokens;
CREATE POLICY tenant_isolation ON patient_push_tokens
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 6) scheduled_reminders
-- =============================================================
ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reminders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON scheduled_reminders;
CREATE POLICY tenant_isolation ON scheduled_reminders
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

COMMIT;
