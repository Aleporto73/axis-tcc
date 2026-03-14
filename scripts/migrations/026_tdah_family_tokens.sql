-- =====================================================
-- Migration 026: TDAH Family Portal Tokens
-- Portal família com acesso via token (sem Clerk auth)
-- Bible visibility: Progresso resumido, DRC, sessões futuras
-- ❌ Scores CSO, ❌ Snapshots, ❌ Layer AuDHD
-- =====================================================

CREATE TABLE IF NOT EXISTS tdah_family_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES tdah_patients(id),
  guardian_id UUID REFERENCES tdah_guardians(id),

  -- Token único para acesso (64 chars hex)
  token VARCHAR(64) NOT NULL UNIQUE,

  -- Dados do responsável
  guardian_name VARCHAR(255) NOT NULL,
  guardian_email VARCHAR(255),
  relationship VARCHAR(50),

  -- Consentimento LGPD
  consent_accepted_at TIMESTAMPTZ,
  consent_version VARCHAR(10) DEFAULT '1.0',

  -- Controle de acesso
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,              -- NULL = 90 dias default
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_family_tokens_token ON tdah_family_tokens(token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_family_tokens_patient ON tdah_family_tokens(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_family_tokens_guardian ON tdah_family_tokens(guardian_id);

-- Log de acesso família (append-only)
CREATE TABLE IF NOT EXISTS tdah_family_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  token_id UUID NOT NULL REFERENCES tdah_family_tokens(id),
  patient_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,       -- 'view_portal', 'view_drc', 'view_sessions'
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_access_log_token ON tdah_family_access_log(token_id, created_at DESC);
