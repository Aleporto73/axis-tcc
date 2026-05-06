-- 063_shared_migrate_tcc_aba_rls_to_app_tenant_id.sql
-- AXIS - Onda 7 Item 11E - Migracao RLS TCC/ABA: padrao antigo -> app_tenant_id()
--
-- Contexto:
--   Em 30/04/2026 manha, apos aplicar migration 062 (Fase B.3 TDAH) e 061
--   (RESET app.tenant_id default global - Item 11C), o scheduler
--   (src/services/scheduler.ts via cron/reminders) comecou a logar erro
--   recorrente: "unrecognized configuration parameter app.tenant_id".
--
--   Auditoria em prod (Etapa 1 Item 11E) revelou estado bipartido:
--     - 13 tabelas TDAH ja em padrao novo (app_tenant_id) - migrations 057/060/062
--     - 42 tabelas TCC/ABA em padrao antigo (current_setting):
--         * 37 Perfil A "fragil"   - sem missing_ok=true, lancam erro sem GUC
--         * 5  Perfil B "silencioso" - com missing_ok=true, retornam 0 rows
--
--   Causa do erro do scheduler: tabela patients tem Perfil A. Scheduler executa
--   pool.query cross-tenant sem set_config. Antes do 11C, o default global
--   '00000000-...' satisfazia current_setting silenciosamente. Apos o RESET,
--   policy explode quando avaliada.
--
-- Escopo desta migration:
--   ALTER POLICY (in-place, zero gap) em 42 policies de TCC/ABA, trocando
--   USING/WITH CHECK para app_tenant_id(). Resultado: padrao unico em todo o
--   schema (TDAH + TCC + ABA), fail-loud uniforme com mensagem clara
--   '[AXIS RLS] app.tenant_id nao definido na sessao'.
--
-- Pre-requisito:
--   Migration 058 aplicada (funcao public.app_tenant_id()). Esta migration
--   verifica e falha cedo se ausente.
--
-- Mudanca semantica adicional (Perfil B):
--   As 5 policies do Perfil B (service_sites, session_*) tinham apenas USING.
--   Esta migration introduz WITH CHECK = USING - defesa-em-profundidade
--   simetrica, alinhando com padrao TDAH Fase A/B (057, 060, 062).
--   Smoke pos-deploy deve observar se algum INSERT/UPDATE em Perfil B comeca
--   a falhar (esperado: zero - WITH CHECK so bloqueia escrita com tenant_id
--   divergente do GUC, o que ja seria bug em qualquer caller correto).
--
-- Idempotencia:
--   - Pula linhas ja em padrao novo (qual referencia app_tenant_id()).
--   - Pula linhas onde a policy nao existe (ambiente novo / restore parcial).
--   - ALTER POLICY in-place: zero gap em FORCE RLS, sem janela de visibilidade.
--   - Re-rodar a migration nao causa efeito - todas viram skip.
--
-- Reversao (snippet para incidente - nao versionado como arquivo separado):
--   BEGIN;
--   DO $$
--   DECLARE rec RECORD;
--   BEGIN
--     FOR rec IN VALUES
--       ('case_bases','tenant_isolation'), ('claim_packets','claim_packets_tenant_isolation'),
--       -- (... 42 pares - usar a lista abaixo no INSERT INTO tmp_063_policies ...)
--       ('session_presence_proofs','presence_proofs_tenant_isolation')
--     LOOP
--       EXECUTE format(
--         'ALTER POLICY %I ON public.%I USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)',
--         rec.column2, rec.column1);
--     END LOOP;
--   END $$;
--   COMMIT;
--   (Nota: reversao restaura WITH CHECK em todas, mesmo Perfil B que originalmente
--   nao tinha. Para reversao bit-a-bit semantica, dropar WITH CHECK das 5 do
--   Perfil B usando ALTER POLICY ... USING (...) sem clausula WITH CHECK.)
--
-- Backup PRE-aplicacao recomendado:
--   pg_dump --data-only --schema=public > /root/backups/063_pre_rls/<env>_<ts>.sql
--   (defesa - se algo correr mal, dados intactos; policies revertem por ALTER)
--
-- Caller cross-tenant nao resolvido nesta migration:
--   src/services/scheduler.ts continuara errando, agora com mensagem clara
--   '[AXIS RLS] app.tenant_id nao definido' em vez do erro PG cru.
--   Tratamento do scheduler fica no Item 11F (separado), pattern S3:
--   agrupar por tenant + withTenantClient (mesmo de scan-integrity).

BEGIN;

-- =============================================================
-- 1) Pre-requisito: app_tenant_id() existe (migration 058)
-- =============================================================
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_id'
  ) THEN
    RAISE EXCEPTION '[AXIS-063] funcao public.app_tenant_id() ausente. Aplicar migration 058 antes desta.';
  END IF;
END
$check$;

-- =============================================================
-- 2) Tabela canonica das 42 policies a migrar (TCC/ABA, Onda 7 Item 11E)
-- =============================================================
CREATE TEMP TABLE tmp_063_policies (
  tbl    TEXT NOT NULL,
  pol    TEXT NOT NULL,
  perfil CHAR(1) NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_063_policies (tbl, pol, perfil) VALUES
  -- Perfil A: 37 frageis (sem missing_ok=true)
  ('case_bases',                'tenant_isolation',                            'A'),
  ('claim_packets',             'claim_packets_tenant_isolation',              'A'),
  ('clinical_records',          'tenant_isolation',                            'A'),
  ('clinical_states',           'tenant_isolation',                            'A'),
  ('clinical_states_aba',       'tenant_isolation',                            'A'),
  ('convenio_reports',          'tenant_isolation',                            'A'),
  ('exposure_hierarchies',      'tenant_isolation',                            'A'),
  ('family_portal_access',      'tenant_isolation',                            'A'),
  ('generalization_probes',     'tenant_isolation',                            'A'),
  ('guardian_consents',         'tenant_isolation',                            'A'),
  ('guardians',                 'tenant_isolation',                            'A'),
  ('integrity_flags',           'integrity_flags_tenant_isolation',            'A'),
  ('learner_coverage_profiles', 'learner_coverage_profiles_tenant_isolation',  'A'),
  ('learner_protocols',         'tenant_isolation',                            'A'),
  ('learner_support_levels',    'tenant_isolation',                            'A'),
  ('learners',                  'tenant_isolation',                            'A'),
  ('maintenance_probes',        'tenant_isolation',                            'A'),
  ('patients',                  'tenant_isolation',                            'A'),
  ('payer_submissions',         'payer_submissions_tenant_isolation',          'A'),
  ('pei_plans',                 'tenant_isolation',                            'A'),
  ('provider_credentials',      'provider_credentials_tenant_isolation',       'A'),
  ('report_snapshots',          'tenant_isolation',                            'A'),
  ('session_behaviors',         'tenant_isolation',                            'A'),
  ('session_notes',             'tenant_isolation',                            'A'),
  ('session_reports',           'tenant_isolation',                            'A'),
  ('session_snapshots',         'tenant_isolation',                            'A'),
  ('session_summaries',         'tenant_isolation',                            'A'),
  ('session_targets',           'tenant_isolation',                            'A'),
  ('sessions',                  'tenant_isolation',                            'A'),
  ('sessions_aba',              'tenant_isolation',                            'A'),
  ('suggestion_decisions',      'tenant_isolation',                            'A'),
  ('suggestion_log_aba',        'tenant_isolation',                            'A'),
  ('suggestions',               'tenant_isolation',                            'A'),
  ('tcc_analyses',              'tenant_isolation',                            'A'),
  ('transcript_segments',       'tenant_isolation',                            'A'),
  ('transcription_jobs',        'tenant_isolation',                            'A'),
  ('transcripts',               'tenant_isolation',                            'A'),
  -- Perfil B: 5 silenciosas (com missing_ok=true)
  ('service_sites',             'service_sites_tenant_isolation',              'B'),
  ('session_attachments',       'attachments_tenant_isolation',                'B'),
  ('session_attestations',      'attestations_tenant_isolation',               'B'),
  ('session_evidence_bundles',  'evidence_bundles_tenant_isolation',           'B'),
  ('session_presence_proofs',   'presence_proofs_tenant_isolation',            'B');

-- =============================================================
-- 3) Validacao PRE: estado das 42 antes da migracao (informativo)
-- =============================================================
DO $pre$
DECLARE
  v_total   INT;
  v_old     INT;
  v_new     INT;
  v_missing INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM tmp_063_policies;

  SELECT COUNT(*) INTO v_old
    FROM tmp_063_policies t
    JOIN pg_policies p ON p.schemaname='public' AND p.tablename=t.tbl AND p.policyname=t.pol
   WHERE p.qual LIKE '%current_setting%''app.tenant_id''%';

  SELECT COUNT(*) INTO v_new
    FROM tmp_063_policies t
    JOIN pg_policies p ON p.schemaname='public' AND p.tablename=t.tbl AND p.policyname=t.pol
   WHERE p.qual LIKE '%app_tenant_id()%';

  SELECT COUNT(*) INTO v_missing
    FROM tmp_063_policies t
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_policies p
      WHERE p.schemaname='public' AND p.tablename=t.tbl AND p.policyname=t.pol
   );

  RAISE NOTICE '[AXIS-063 PRE] total=% antigas=% novas=% ausentes=%',
    v_total, v_old, v_new, v_missing;
END
$pre$;

-- =============================================================
-- 4) Migracao: ALTER POLICY in-place para app_tenant_id()
-- =============================================================
DO $migrate$
DECLARE
  rec RECORD;
  v_migrated INT := 0;
  v_skipped  INT := 0;  -- ja em padrao novo
  v_missing  INT := 0;  -- policy nao existe
BEGIN
  FOR rec IN SELECT tbl, pol, perfil FROM tmp_063_policies ORDER BY perfil, tbl LOOP

    -- Idempotencia: ja em padrao novo
    IF EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename=rec.tbl AND policyname=rec.pol
         AND qual LIKE '%app_tenant_id()%'
    ) THEN
      RAISE NOTICE '[AXIS-063] skip [%] %/% (ja em padrao novo)', rec.perfil, rec.tbl, rec.pol;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Idempotencia: policy ausente (ambiente novo / restore parcial)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename=rec.tbl AND policyname=rec.pol
    ) THEN
      RAISE NOTICE '[AXIS-063] skip [%] %/% (policy ausente)', rec.perfil, rec.tbl, rec.pol;
      v_missing := v_missing + 1;
      CONTINUE;
    END IF;

    -- Migrar in-place
    EXECUTE format(
      'ALTER POLICY %I ON public.%I USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())',
      rec.pol, rec.tbl
    );
    RAISE NOTICE '[AXIS-063] alter [%] %/% -> app_tenant_id()', rec.perfil, rec.tbl, rec.pol;
    v_migrated := v_migrated + 1;
  END LOOP;

  RAISE NOTICE '[AXIS-063 RESUMO] migradas=% skip-novo=% skip-ausente=% (escopo total=42)',
    v_migrated, v_skipped, v_missing;
END
$migrate$;

-- =============================================================
-- 5) Validacao POS: zero policies do escopo ainda em padrao antigo
-- =============================================================
DO $post$
DECLARE
  v_old_remaining INT;
BEGIN
  SELECT COUNT(*) INTO v_old_remaining
    FROM tmp_063_policies t
    JOIN pg_policies p ON p.schemaname='public' AND p.tablename=t.tbl AND p.policyname=t.pol
   WHERE p.qual LIKE '%current_setting%''app.tenant_id''%';

  IF v_old_remaining > 0 THEN
    RAISE EXCEPTION '[AXIS-063 POS] FALHA: % policies ainda em padrao antigo apos migracao', v_old_remaining;
  END IF;

  RAISE NOTICE '[AXIS-063 POS] OK: zero policies em padrao antigo no escopo da migration';
END
$post$;

COMMIT;
