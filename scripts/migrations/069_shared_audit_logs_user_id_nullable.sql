-- Migration 069: axis_audit_logs.user_id nullable para system jobs
-- Onda 10 — HUB-09 09.6 (smoke CI revelou bug latente em prod)
--
-- Contexto:
--   scripts/jobs/purge_geo.sql (cron LGPD compliance) insere em
--   axis_audit_logs com user_id=NULL + actor='system' para registrar
--   acao automatizada do sistema. Schema atual (baseline) define
--   user_id text NOT NULL, entao o INSERT falha com SQLSTATE 23502.
--
--   Em prod o bug e LATENTE: validacao em 06/05/2026 confirmou
--   0 execucoes com sucesso de purge_geo. Smoke CI (HUB-09) exercitou
--   o cron contra schema real e expos o bug que existia desde sempre.
--
-- Solucao:
--   Relaxar user_id para nullable + COMMENT documentando semantica.
--   NULL = acao system/cron, NOT NULL = acao user.
--
-- Por que SEM CHECK constraint:
--   Validacao prod 06/05/2026: 187 logs com actor='system' tem
--   user_id preenchido (convencao historica). Adicionar CHECK
--   actor='system' AND user_id IS NULL quebraria backfill de dados.
--   Optamos pela solucao minima (DROP NOT NULL) preservando
--   compat com dados existentes.
--
-- Idempotente:
--   ALTER COLUMN ... DROP NOT NULL e no-op se ja nullable.
--   COMMENT ON COLUMN sobrescreve sem erro.

BEGIN;

-- 1) Permitir user_id nullable (libera purge_geo e futuros system jobs)
ALTER TABLE axis_audit_logs
  ALTER COLUMN user_id DROP NOT NULL;

-- 2) Documentar semantica nova
COMMENT ON COLUMN axis_audit_logs.user_id IS
  'ID do usuario que executou a acao. NULL apenas quando actor=system (cron jobs LGPD compliance, purge_geo, etc). Logs com actor=system anteriores podem ter user_id preenchido (convencao historica). Nao adicionada CHECK constraint para preservar compat com 187 logs system-com-user pre-existentes.';

COMMIT;
