-- Migration 049: session_reports (relatório clínico + insights)
-- Data: 2026-04-15
-- Ref: AXIS TCC Sessão v2 — FASE 1 Backend

CREATE TABLE IF NOT EXISTS session_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Campos do relatório
  headline TEXT,
  objectives TEXT,
  summary TEXT,
  intervention TEXT,
  observations TEXT,
  closing TEXT,

  -- Insights (JSONB)
  insights JSONB DEFAULT '{}',

  -- Metadados
  status VARCHAR(20) DEFAULT 'draft',
  generated_by VARCHAR(20) DEFAULT 'ai',
  ai_model VARCHAR(50),
  generation_prompt_hash VARCHAR(64),

  -- Controle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  exported_at TIMESTAMPTZ,
  export_count INT DEFAULT 0,

  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_session_reports_tenant ON session_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_session_reports_session ON session_reports(session_id);

ALTER TABLE session_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON session_reports
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- NOTA: worker_access REMOVIDO por segurança — geração IA usa withTenant() com tenant_id explícito.
