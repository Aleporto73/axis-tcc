-- =====================================================
-- AXIS ABA v2.7.0 — Sprint 4: Perfis por Pagador
-- Ref: skill_axis_aba_v270.md
--
-- Cria:
--   1. payer_requirement_profiles — regras por operadora
--   2. FK de learner_coverage_profiles.payer_profile_id
--
-- Regra Bible v2.7.0:
--   "Alteração de perfil de pagador é versionada"
--   Cada perfil define o que a operadora exige: geo, atestação,
--   foto, cobertura, frequência de relatório, formatos, etc.
-- =====================================================

-- 1. Tabela: payer_requirement_profiles
CREATE TABLE IF NOT EXISTS payer_requirement_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Identificação
  payer_name TEXT NOT NULL,
  payer_code TEXT NULL,

  -- Requisitos de presença
  requires_geo BOOLEAN NOT NULL DEFAULT false,
  geo_level TEXT NOT NULL DEFAULT 'none'
    CHECK (geo_level IN ('none', 'light', 'standard', 'strict')),

  -- Requisitos de atestação
  requires_guardian_attestation BOOLEAN NOT NULL DEFAULT false,
  guardian_attestation_deadline_hours INTEGER NOT NULL DEFAULT 72,

  -- Requisitos de evidência
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  requires_attachment_per_guide BOOLEAN NOT NULL DEFAULT false,

  -- Relatórios
  report_frequency_days INTEGER NOT NULL DEFAULT 90,
  report_template TEXT NOT NULL DEFAULT 'standard',

  -- Documentação obrigatória
  requires_team_roster BOOLEAN NOT NULL DEFAULT true,
  requires_prescription BOOLEAN NOT NULL DEFAULT true,
  requires_pei BOOLEAN NOT NULL DEFAULT false,
  requires_coverage_auth BOOLEAN NOT NULL DEFAULT false,

  -- Padrões técnicos
  cid_version TEXT NOT NULL DEFAULT 'CID-10'
    CHECK (cid_version IN ('CID-10', 'CID-11', 'both')),
  max_file_size_mb INTEGER NOT NULL DEFAULT 10,
  accepted_formats TEXT[] NOT NULL DEFAULT '{pdf,jpg,png}',

  -- Checklist customizável
  checklist_items JSONB NULL,

  -- Metadata
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE payer_requirement_profiles ENABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX IF NOT EXISTS idx_payer_req_profiles_tenant
  ON payer_requirement_profiles(tenant_id);

CREATE INDEX IF NOT EXISTS idx_payer_req_profiles_active
  ON payer_requirement_profiles(tenant_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_payer_req_profiles_name
  ON payer_requirement_profiles(tenant_id, payer_name);

-- 2. FK de learner_coverage_profiles → payer_requirement_profiles
-- A coluna payer_profile_id já existe (Sprint 2), agora adicionamos a FK
ALTER TABLE learner_coverage_profiles
  ADD CONSTRAINT fk_coverage_payer_profile
  FOREIGN KEY (payer_profile_id)
  REFERENCES payer_requirement_profiles(id)
  ON DELETE SET NULL;

-- =====================================================
-- Verificação
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✓ payer_requirement_profiles criada';
  RAISE NOTICE '✓ FK learner_coverage_profiles.payer_profile_id → payer_requirement_profiles';
  RAISE NOTICE '✓ Sprint 4 migration completa';
END $$;
