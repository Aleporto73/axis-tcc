-- =====================================================
-- Migration 025: TDAH Teacher Access Tokens
-- Portal do professor com acesso simplificado via token
-- Bible §14: Perfil professor (acesso simplificado)
-- Visibility: DRC registra + progresso resumido apenas
-- =====================================================

-- Tabela de tokens de acesso para professores
CREATE TABLE IF NOT EXISTS tdah_teacher_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES tdah_patients(id),

  -- Token único para acesso (64 chars hex)
  token VARCHAR(64) NOT NULL UNIQUE,

  -- Dados do professor (snapshot no momento do convite)
  teacher_name VARCHAR(255) NOT NULL,
  teacher_email VARCHAR(255),
  school_name VARCHAR(255),

  -- Controle de acesso
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,           -- NULL = sem expiração

  -- Auditoria
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id),

  -- Constraints
  CONSTRAINT fk_teacher_token_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_teacher_token_patient FOREIGN KEY (patient_id) REFERENCES tdah_patients(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_teacher_tokens_token ON tdah_teacher_tokens(token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_teacher_tokens_patient ON tdah_teacher_tokens(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_teacher_tokens_active ON tdah_teacher_tokens(tenant_id, is_active) WHERE is_active = true;

-- Log de acesso do professor (append-only, auditoria)
CREATE TABLE IF NOT EXISTS tdah_teacher_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  token_id UUID NOT NULL REFERENCES tdah_teacher_tokens(id),
  patient_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,       -- 'view_drc', 'submit_drc', 'view_progress'
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_access_log_token ON tdah_teacher_access_log(token_id, created_at DESC);

-- =====================================================
-- DONE — 025_tdah_teacher_tokens.sql
-- =====================================================
