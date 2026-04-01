-- =====================================================
-- Migration 040: Tabela system_alerts
-- Monitoramento interno de erros e falhas do sistema
--
-- Registra alertas de rotas criticas, webhooks falhando,
-- falhas de auth, health check down, etc.
-- Nao armazena PII nem texto clinico.
--
-- Usado pelo painel admin (/admin) e pelo /api/health
-- =====================================================

CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL CHECK (module IN ('axis-tcc', 'axis-aba', 'axis-tdah', 'shared')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  source TEXT NOT NULL,
  code TEXT,
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_created
  ON system_alerts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_alerts_unresolved
  ON system_alerts (resolved, severity)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_system_alerts_module
  ON system_alerts (module, created_at DESC);

COMMENT ON TABLE system_alerts IS
  'Alertas internos do sistema. Nunca contém PII ou texto clínico.';
