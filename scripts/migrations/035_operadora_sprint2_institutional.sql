-- =====================================================
-- Migration 035: Sprint 2 — Camada Institucional (v2.7.0)
--
-- 5 tabelas novas:
-- 1. learner_coverage_profiles (cobertura por pagador)
-- 2. claim_packets (pacote documental para operadora)
-- 3. claim_packet_items (itens de cada pacote)
-- 4. payer_submissions (registros de envio)
-- 5. provider_credentials (cadastro institucional)
--
-- 1 extensão:
-- ALTER learner_therapists (role_in_case, weekly_hours, start/end_date)
--
-- 100% ADITIVA — não toca motor CSO-ABA v2.6.1
-- Idempotente (IF NOT EXISTS em tudo)
-- SEM BEGIN/COMMIT — cada comando independente
--
-- Ref: skill_axis_aba_v270.md (Sprint 2 — Camada Institucional)
-- Depende: Migration 034 (Sprint 1 presence)
-- Data: 2026-03-20
-- =====================================================


-- ─────────────────────────────────────────────────────
-- §1. LEARNER_COVERAGE_PROFILES
-- Cobertura do aprendiz por pagador/operadora.
--
-- Vincula learner → payer_requirement_profiles (Sprint 4).
-- Enquanto payer_requirement_profiles não existir,
-- payer_profile_id aceita NULL.
--
-- Regras:
--   - Multi-cobertura permitida (mesmo aprendiz, múltiplos pagadores)
--   - status: active, pending, expired, suspended
--   - authorization_code: guia/autorização do convênio
--   - authorized_hours_week: horas aprovadas semanalmente
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_coverage_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payer_profile_id UUID NULL,  -- FK → payer_requirement_profiles (Sprint 4)
  payer_name TEXT NOT NULL,    -- nome legível até Sprint 4 existir
  authorization_code TEXT NULL,
  authorized_hours_week DECIMAL(4,1) NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','pending','expired','suspended')),
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coverage_learner
  ON learner_coverage_profiles(learner_id);
CREATE INDEX IF NOT EXISTS idx_coverage_tenant
  ON learner_coverage_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coverage_status
  ON learner_coverage_profiles(status);
CREATE INDEX IF NOT EXISTS idx_coverage_payer
  ON learner_coverage_profiles(payer_profile_id)
  WHERE payer_profile_id IS NOT NULL;

-- RLS
ALTER TABLE learner_coverage_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'learner_coverage_profiles'
      AND policyname = 'learner_coverage_profiles_tenant_isolation'
  ) THEN
    CREATE POLICY learner_coverage_profiles_tenant_isolation
      ON learner_coverage_profiles
      FOR ALL
      USING (tenant_id = current_setting('app.tenant_id')::uuid);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- §2. CLAIM_PACKETS
-- Pacote documental enviado à operadora.
--
-- Agrupa sessões de um período para faturamento/prestação.
-- Hash garante integridade.
-- IMUTÁVEL após 'submitted' — ajuste = nova versão.
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS claim_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  coverage_id UUID NULL REFERENCES learner_coverage_profiles(id),
  packet_type TEXT NOT NULL DEFAULT 'monthly'
    CHECK (packet_type IN ('monthly','quarterly','guide','custom')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  packet_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (packet_status IN ('draft','ready','submitted','returned','accepted','disputed')),
  packet_hash TEXT NULL,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  sessions_with_full_proof INTEGER NOT NULL DEFAULT 0,
  sessions_with_partial_proof INTEGER NOT NULL DEFAULT 0,
  sessions_with_exception INTEGER NOT NULL DEFAULT 0,
  completeness_pct DECIMAL(5,2) NULL,
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_id UUID NULL REFERENCES claim_packets(id),
  generated_at TIMESTAMPTZ NULL,
  generated_by UUID NULL REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ NULL,
  returned_at TIMESTAMPTZ NULL,
  return_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_packets_tenant
  ON claim_packets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_claim_packets_learner
  ON claim_packets(learner_id);
CREATE INDEX IF NOT EXISTS idx_claim_packets_coverage
  ON claim_packets(coverage_id)
  WHERE coverage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_claim_packets_status
  ON claim_packets(packet_status);
CREATE INDEX IF NOT EXISTS idx_claim_packets_period
  ON claim_packets(period_start, period_end);

ALTER TABLE claim_packets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'claim_packets'
      AND policyname = 'claim_packets_tenant_isolation'
  ) THEN
    CREATE POLICY claim_packets_tenant_isolation
      ON claim_packets
      FOR ALL
      USING (tenant_id = current_setting('app.tenant_id')::uuid);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- §3. CLAIM_PACKET_ITEMS
-- Itens individuais de cada pacote.
--
-- Cada item referencia um documento ou evidência.
-- Hash individual para rastreabilidade.
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS claim_packet_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id UUID NOT NULL REFERENCES claim_packets(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL
    CHECK (item_type IN (
      'clinical_report','session_evidence','prescription',
      'pei','team_roster','consent','coverage_auth','other'
    )),
  item_ref_id UUID NULL,
  item_hash TEXT NULL,
  item_status TEXT NOT NULL DEFAULT 'included'
    CHECK (item_status IN ('included','missing','expired','not_applicable')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_packet_items_packet
  ON claim_packet_items(packet_id);
CREATE INDEX IF NOT EXISTS idx_packet_items_type
  ON claim_packet_items(item_type);
CREATE INDEX IF NOT EXISTS idx_packet_items_ref
  ON claim_packet_items(item_ref_id)
  WHERE item_ref_id IS NOT NULL;


-- ─────────────────────────────────────────────────────
-- §4. PAYER_SUBMISSIONS
-- Registro de envios para operadoras.
--
-- Cada envio referencia um claim_packet + versão.
-- Rastreia resposta (accepted/rejected/partial).
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payer_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id UUID NOT NULL REFERENCES claim_packets(id) ON DELETE CASCADE,
  packet_version INTEGER NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  submission_method TEXT NOT NULL DEFAULT 'portal'
    CHECK (submission_method IN ('portal','email','physical','api')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_by UUID NOT NULL REFERENCES profiles(id),
  response_status TEXT NULL
    CHECK (response_status IS NULL OR response_status IN ('pending','accepted','rejected','partial')),
  response_at TIMESTAMPTZ NULL,
  response_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_packet
  ON payer_submissions(packet_id);
CREATE INDEX IF NOT EXISTS idx_submissions_tenant
  ON payer_submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status
  ON payer_submissions(response_status)
  WHERE response_status IS NOT NULL;

ALTER TABLE payer_submissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payer_submissions'
      AND policyname = 'payer_submissions_tenant_isolation'
  ) THEN
    CREATE POLICY payer_submissions_tenant_isolation
      ON payer_submissions
      FOR ALL
      USING (tenant_id = current_setting('app.tenant_id')::uuid);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- §5. PROVIDER_CREDENTIALS
-- Cadastro institucional de prestadores.
-- 1:1 com profiles (UNIQUE profile_id).
--
-- Dados de conselho profissional, credenciamento,
-- formação e role no time.
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  council_type TEXT NOT NULL DEFAULT 'CRP'
    CHECK (council_type IN ('CRP','CRFa','CREFITO','CRM','BCBA','other')),
  council_number TEXT NOT NULL,
  council_uf TEXT NOT NULL,
  council_valid_until DATE NULL,
  specializations TEXT[] DEFAULT '{}',
  education_level TEXT NOT NULL DEFAULT 'graduacao'
    CHECK (education_level IN ('graduacao','especializacao','mestrado','doutorado')),
  role_in_team TEXT NOT NULL DEFAULT 'terapeuta'
    CHECK (role_in_team IN ('supervisor','terapeuta','fono','to','psicopedagoga')),
  weekly_hours_total DECIMAL(4,1) NULL,
  is_credentialed BOOLEAN NOT NULL DEFAULT false,
  credential_code TEXT NULL,
  credential_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (credential_status IN ('active','pending','expired','blocked')),
  documents_complete BOOLEAN NOT NULL DEFAULT false,
  last_verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_cred_profile
  ON provider_credentials(profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_cred_tenant
  ON provider_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provider_cred_status
  ON provider_credentials(credential_status);
CREATE INDEX IF NOT EXISTS idx_provider_cred_council_exp
  ON provider_credentials(council_valid_until)
  WHERE council_valid_until IS NOT NULL;

ALTER TABLE provider_credentials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_credentials'
      AND policyname = 'provider_credentials_tenant_isolation'
  ) THEN
    CREATE POLICY provider_credentials_tenant_isolation
      ON provider_credentials
      FOR ALL
      USING (tenant_id = current_setting('app.tenant_id')::uuid);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- §6. EXTENSÃO learner_therapists
-- Adiciona campos institucionais ao vínculo existente.
--
-- Mantém nome canônico e estrutura original.
-- Novos campos são NULL-safe (tudo opcional).
-- ─────────────────────────────────────────────────────

ALTER TABLE learner_therapists
  ADD COLUMN IF NOT EXISTS role_in_case TEXT NULL
    CHECK (role_in_case IS NULL OR role_in_case IN (
      'supervisor_clinico','terapeuta_aba','fono','to','psicopedagoga'
    ));

ALTER TABLE learner_therapists
  ADD COLUMN IF NOT EXISTS weekly_hours DECIMAL(4,1) NULL;

ALTER TABLE learner_therapists
  ADD COLUMN IF NOT EXISTS start_date DATE NULL;

ALTER TABLE learner_therapists
  ADD COLUMN IF NOT EXISTS end_date DATE NULL;


-- =====================================================
-- FIM — Migration 035 Sprint 2 Institucional
-- Tabelas: learner_coverage_profiles, claim_packets,
--   claim_packet_items, payer_submissions,
--   provider_credentials
-- Extensão: learner_therapists (+4 colunas)
-- =====================================================
