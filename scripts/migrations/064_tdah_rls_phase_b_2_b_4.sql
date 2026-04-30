-- 064_tdah_rls_phase_b_2_b_4.sql
-- Item 11 Onda 7 - Finalizacao TDAH: Fases B.2 (familia) + B.4 (trivial) unificadas
-- Padrao: tenant_isolation FOR ALL USING/WITH CHECK = app_tenant_id()
--
-- Contexto:
--   Apos Fase A (5 tabelas nucleo, migration 057), Fase B.1 (3 tabelas
--   portais, migration 060), Fase B.3 (5 tabelas internas, migration 062),
--   Items 11C (RESET default global, 061) e 11D (tokens permanentemente
--   fora de RLS por design), Item 11E (modernizacao 42 policies TCC/ABA,
--   migration 063), restavam 4 tabelas tdah_* sem RLS:
--
--     Fase B.2 - "familia" (3 tabelas, 0 rows):
--       - tdah_family_access_log
--       - tdah_routines
--       - tdah_token_economy
--
--     Fase B.4 - "trivial" (1 tabela, 3 rows em 3 tenants):
--       - tdah_audhd_log
--
--   Esta migration unifica B.2 + B.4 num unico arquivo: o escopo restante
--   e pequeno, todas as tabelas tem perfil de risco baixo (callers via
--   rotas autenticadas Clerk + portal familia com wrap Caminho 2), e
--   nenhuma tem chicken-and-egg.
--
-- Tabelas EXCLUIDAS desta migration (por design):
--   - tdah_protocol_library: SEM coluna tenant_id (library shared/global,
--     conteudo lido por todos os tenants). RLS nao se aplica a tabelas
--     sem tenant_id - filtragem por contexto fica em WHERE manual nos
--     callers que precisam (ver Item 11G no docs/audits/onda7_backlog.md).
--   - tdah_teacher_tokens / tdah_family_tokens: Item 11D Caminho A,
--     permanentemente fora de RLS (hex64 UNIQUE + chicken-and-egg).
--
-- Pre-condicoes verificadas empiricamente em prod (30/04/2026 tarde):
--   - tenant_id NOT NULL nas 4 tabelas (information_schema)
--   - Zero rows orfas (rows totais = sum por tenant_id distinto)
--   - Callers (10 rotas com overlap):
--       tdah_family_access_log: app/api/familia/[token]/route.ts (wrap
--                              Caminho 2), app/api/tdah/familia/tokens/route.ts,
--                              app/api/tdah/lgpd/export/route.ts,
--                              app/api/tdah/lgpd/delete/route.ts,
--                              app/api/tdah/patients/[id]/route.ts
--       tdah_routines:         app/api/tdah/routines/route.ts,
--                              app/api/tdah/routines/[id]/route.ts,
--                              app/api/tdah/lgpd/export/route.ts,
--                              app/api/tdah/lgpd/delete/route.ts,
--                              app/api/familia/[token]/route.ts
--       tdah_token_economy:    app/api/tdah/token-economy/route.ts,
--                              app/api/tdah/token-economy/[id]/route.ts,
--                              app/api/tdah/token-economy/[id]/transactions/route.ts,
--                              app/api/familia/[token]/route.ts,
--                              app/api/tdah/lgpd/*
--       tdah_audhd_log:        rotas tdah/patients/[id]/* + lgpd/*
--     TODAS cobertas por withTenant (rotas autenticadas Clerk) ou wrap
--     Caminho 2 (BEGIN + set_config('app.tenant_id', $1, true) + COMMIT)
--     no portal familia [token]. Zero callers categoria b (sem GUC).
--
--   - app_tenant_id() versionada em migration 058 (commit d98285a)
--   - Default global app.tenant_id removido em prod via 061 (commit
--     cc41ece) - fail-loud restaurado
--   - 42 policies TCC/ABA modernizadas em 063 (Item 11E, commit b27c5b3)
--
-- ATENCAO ESPECIAL - tdah_audhd_log:
--   Bible v2.5 secao 6: layer AuDHD desativada preserva historico
--   append-only. tdah_audhd_log registra cada mudanca de status
--   (previous_status, new_status, changed_by, reason, engine_version).
--   RLS aqui nao bloqueia INSERT por design (append-only mantido) - mas
--   ISOLA por tenant_id, garantindo que um tenant nao ve historico
--   AuDHD de outro. Smoke staging deve validar:
--     - INSERT com GUC do tenant correto -> sucesso
--     - SELECT com GUC do tenant correto -> ve so seu historico
--     - SELECT cross-tenant (GUC errado) -> 0 rows
--
-- ATENCAO ESPECIAL - tdah_token_economy:
--   Item 18 da Onda 5.6 (commit 3c1f17e) corrigiu race condition com
--   transacao atomica + FOR UPDATE. RLS aqui forca o FOR UPDATE a
--   respeitar tenant_isolation. Smoke deve validar que UPDATE concorrente
--   continua funcionando dentro do mesmo tenant (axis_app sem bypass).
--
-- ATENCAO ESPECIAL - tdah_family_access_log:
--   Tabela append-only de auditoria (acesso ao portal familia). E
--   gravada via wrap Caminho 2 no portal publico. Em rotas autenticadas
--   (LGPD export/delete, gestao admin), gravada via withTenant. RLS
--   garante que portal familia de um tenant nao registra log em outro.
--
-- Idempotencia:
--   - DROP POLICY IF EXISTS antes de CREATE POLICY (mesmo padrao 057/060/062)
--   - ENABLE ROW LEVEL SECURITY e idempotente em si (no-op se ja ativo)
--   - FORCE ROW LEVEL SECURITY tambem (no-op se ja ativo)
--   - Re-rodar a migration: zero efeito colateral
--
-- Reversao manual (snippet, nao versionado como arquivo):
--   BEGIN;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_family_access_log;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_routines;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_token_economy;
--   DROP POLICY IF EXISTS tenant_isolation ON tdah_audhd_log;
--   ALTER TABLE tdah_family_access_log DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_family_access_log NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_routines           DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_routines           NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_token_economy      DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_token_economy      NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_audhd_log          DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE tdah_audhd_log          NO FORCE ROW LEVEL SECURITY;
--   COMMIT;
--
-- Backup PRE-aplicacao recomendado:
--   pg_dump --data-only --schema=public > /root/backups/064_pre_b_2_b_4/<env>_<ts>.sql
--   (defesa - tdah_audhd_log tem 3 rows reais; B.2 tem 0 rows mas mesma rotina)
--
-- Apos esta migration, Item 11 Onda 7 esta totalmente fechado:
--   - Tabelas TDAH com RLS:    13 + 4 = 17 tabelas
--   - Tabelas TCC/ABA com RLS: 42 modernizadas (Item 11E, migration 063)
--   - Tabelas FORA de RLS por design:
--       * tdah_teacher_tokens, tdah_family_tokens (Item 11D, hex64 UNIQUE)
--       * tdah_protocol_library (Item 11G, library shared sem tenant_id)
--   - Default global app.tenant_id: removido (Item 11C, migration 061)
--   - app_tenant_id() function: versionada (migration 058)
--   - Carry-forward Item 11F: scheduler cross-tenant ainda quebra com
--     mensagem AXIS RLS clara - tratamento dedicado pendente.

BEGIN;

-- =============================================================
-- Pre-requisito: app_tenant_id() existe (migration 058)
-- =============================================================
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_id'
  ) THEN
    RAISE EXCEPTION '[AXIS-064] funcao public.app_tenant_id() ausente. Aplicar migration 058 antes desta.';
  END IF;
END
$check$;

-- =============================================================
-- 1) tdah_family_access_log  [Fase B.2 - familia]
-- =============================================================
ALTER TABLE tdah_family_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_family_access_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_family_access_log;
CREATE POLICY tenant_isolation ON tdah_family_access_log
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 2) tdah_routines  [Fase B.2 - familia/casa]
-- =============================================================
ALTER TABLE tdah_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_routines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_routines;
CREATE POLICY tenant_isolation ON tdah_routines
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 3) tdah_token_economy  [Fase B.2 - economia de fichas]
-- =============================================================
-- Atencao: Item 18 Onda 5.6 (commit 3c1f17e) usa transacao atomica
-- com FOR UPDATE para anti-race. RLS forca FOR UPDATE a respeitar
-- tenant_isolation - axis_app (nao-superuser) nao bypassa.
ALTER TABLE tdah_token_economy ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_token_economy FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_token_economy;
CREATE POLICY tenant_isolation ON tdah_token_economy
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- =============================================================
-- 4) tdah_audhd_log  [Fase B.4 - historico AuDHD append-only]
-- =============================================================
-- Atencao: Bible v2.5 secao 6 - append-only preservado. RLS isola
-- por tenant_id sem bloquear INSERT (FOR ALL com WITH CHECK valida
-- na escrita; UPDATE/DELETE proibidos pela aplicacao, nao pela
-- policy). 3 rows em prod distribuidas em 3 tenants - smoke deve
-- validar isolamento cross-tenant empiricamente.
ALTER TABLE tdah_audhd_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdah_audhd_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tdah_audhd_log;
CREATE POLICY tenant_isolation ON tdah_audhd_log
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

COMMIT;
