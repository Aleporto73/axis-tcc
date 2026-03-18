-- =====================================================
-- Migration 032: Tabela de uso de transcrição
-- Contexto: FREE TCC = 120 min/mês, PAGO = ilimitado
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS transcription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- formato "2026-03"
  minutes_used INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, month)
);

CREATE INDEX IF NOT EXISTS idx_transcription_usage_tenant_month
ON transcription_usage(tenant_id, month);

COMMIT;
