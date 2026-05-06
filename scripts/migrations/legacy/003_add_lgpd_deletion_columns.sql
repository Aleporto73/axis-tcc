-- =====================================================
-- Migration 003: LGPD Deletion Columns
-- Source: add_lgpd_deletion_columns.sql
-- Conforme Bible S13.2:
--   Período de retenção: 90 dias
--   Após 90 dias: anonimização irreversível
-- Idempotente: usa IF NOT EXISTS
-- =====================================================

BEGIN;

-- ─── Colunas de controle LGPD na tabela tenants ───
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS cancellation_scheduled_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ DEFAULT NULL;

-- ─── Índice para queries de status ────────────────
CREATE INDEX IF NOT EXISTS idx_tenants_cancellation
  ON tenants (cancellation_scheduled_at)
  WHERE cancellation_scheduled_at IS NOT NULL;

-- ─── Documentação ─────────────────────────────────
COMMENT ON COLUMN tenants.cancellation_scheduled_at IS 'Data de agendamento da exclusão LGPD (início dos 90 dias de retenção)';
COMMENT ON COLUMN tenants.cancelled_at IS 'Data efetiva de cancelamento da conta';
COMMENT ON COLUMN tenants.anonymized_at IS 'Data da anonimização irreversível (após 90 dias)';

COMMIT;
