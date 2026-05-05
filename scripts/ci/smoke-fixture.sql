-- =====================================================
-- AXIS — Smoke Fixture (CI ONLY)
--
-- Schema mínimo para validar que os 3 cron jobs SQL ABA executam
-- sem erro de schema (coluna inexistente, FK quebrada, etc.).
-- Captura exatamente o tipo de bug TDAH-04 fantasma representava.
--
-- NÃO USAR EM PROD. Não é o schema real (sem RLS, sem triggers,
-- sem FKs complexas, sem constraints de produção).
--
-- Cobertura: 11 tabelas referenciadas pelos cron jobs:
--   check_expiration.sql:    integrity_flags, provider_credentials,
--                            profiles, learner_coverage_profiles, learners
--   expire_attestations.sql: session_attestations, sessions_aba,
--                            learner_coverage_profiles, payer_requirement_profiles,
--                            integrity_flags
--   purge_geo.sql:           session_presence_proofs, session_attachments,
--                            axis_audit_logs
-- =====================================================

BEGIN;

-- Extensão crítica: pgp_sym_encrypt em purge_geo.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Tabelas core ────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions_aba (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  learner_id UUID NOT NULL
);

-- ─── integrity_flags (UPSERT target) ──────────────────

CREATE TABLE IF NOT EXISTS integrity_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  rule_code TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_detected_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open',
  auto_resolved BOOLEAN DEFAULT false,
  reviewed_at TIMESTAMPTZ
);

-- Unique partial index (UPSERT target dos 3 INSERTs em check_expiration + expire_attestations)
CREATE UNIQUE INDEX IF NOT EXISTS integrity_flags_unique_open
  ON integrity_flags (tenant_id, entity_type, entity_id, rule_code)
  WHERE status IN ('open', 'reviewing');

-- ─── check_expiration tabelas ─────────────────────────

CREATE TABLE IF NOT EXISTS provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  council_type TEXT,
  council_number TEXT,
  council_valid_until TIMESTAMPTZ,
  credential_status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS learner_coverage_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  learner_id UUID NOT NULL,
  payer_name TEXT,
  end_date DATE,
  authorization_code TEXT,
  status TEXT DEFAULT 'active',
  payer_profile_id UUID
);

-- ─── expire_attestations tabelas ──────────────────────

CREATE TABLE IF NOT EXISTS session_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  session_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  attestor_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payer_requirement_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  requires_guardian_attestation BOOLEAN DEFAULT false,
  guardian_attestation_deadline_hours INT DEFAULT 72
);

-- ─── purge_geo tabelas ────────────────────────────────

CREATE TABLE IF NOT EXISTS session_presence_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  latitude_encrypted BYTEA,
  longitude_encrypted BYTEA,
  ip_address_encrypted BYTEA,
  distance_to_site_meters NUMERIC,
  accuracy_meters NUMERIC,
  altitude_meters NUMERIC
);

CREATE TABLE IF NOT EXISTS session_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  extracted_geo_encrypted BYTEA
);

CREATE TABLE IF NOT EXISTS axis_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT,
  actor TEXT,
  action TEXT,
  entity_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Dados de teste mínimos ───────────────────────────

-- Tenant fixo para todos os testes
DO $$
DECLARE
  v_tenant UUID := '00000000-0000-0000-0000-000000000001';
  v_profile UUID := '00000000-0000-0000-0000-000000000002';
  v_learner UUID := '00000000-0000-0000-0000-000000000003';
  v_session UUID := '00000000-0000-0000-0000-000000000004';
  v_payer UUID := '00000000-0000-0000-0000-000000000005';
BEGIN
  INSERT INTO profiles (id, tenant_id, name)
    VALUES (v_profile, v_tenant, 'Smoke Profile') ON CONFLICT DO NOTHING;
  INSERT INTO learners (id, tenant_id, name)
    VALUES (v_learner, v_tenant, 'Smoke Learner') ON CONFLICT DO NOTHING;
  INSERT INTO sessions_aba (id, tenant_id, learner_id)
    VALUES (v_session, v_tenant, v_learner) ON CONFLICT DO NOTHING;
  INSERT INTO payer_requirement_profiles (id, tenant_id, requires_guardian_attestation)
    VALUES (v_payer, v_tenant, true) ON CONFLICT DO NOTHING;

  -- check_expiration: 1 conselho VENCIDO (gera flag) + 1 cobertura EXPIRADA (gera flag)
  INSERT INTO provider_credentials (tenant_id, profile_id, council_type, council_number, council_valid_until, credential_status)
    VALUES (v_tenant, v_profile, 'CRP', '12345', NOW() - INTERVAL '10 days', 'active') ON CONFLICT DO NOTHING;
  INSERT INTO learner_coverage_profiles (tenant_id, learner_id, payer_name, end_date, status, payer_profile_id)
    VALUES (v_tenant, v_learner, 'Smoke Payer', (NOW() - INTERVAL '5 days')::date, 'active', v_payer) ON CONFLICT DO NOTHING;

  -- expire_attestations: 1 atestação PENDENTE > 72h (deve expirar)
  INSERT INTO session_attestations (tenant_id, session_id, status, attestor_type, created_at)
    VALUES (v_tenant, v_session, 'pending', 'guardian', NOW() - INTERVAL '4 days') ON CONFLICT DO NOTHING;

  -- purge_geo: 1 row > 2 anos (deve anonimizar) + 1 attachment > 2 anos
  INSERT INTO session_presence_proofs (tenant_id, created_at, latitude_encrypted, longitude_encrypted, ip_address_encrypted, distance_to_site_meters)
    VALUES (
      v_tenant,
      NOW() - INTERVAL '3 years',
      pgp_sym_encrypt('-23.5505', current_setting('app.encryption_key')),
      pgp_sym_encrypt('-46.6333', current_setting('app.encryption_key')),
      pgp_sym_encrypt('192.168.1.1', current_setting('app.encryption_key')),
      150.5
    ) ON CONFLICT DO NOTHING;
  INSERT INTO session_attachments (tenant_id, created_at, extracted_geo_encrypted)
    VALUES (
      v_tenant,
      NOW() - INTERVAL '3 years',
      pgp_sym_encrypt('{"lat":-23,"lng":-46}', current_setting('app.encryption_key'))
    ) ON CONFLICT DO NOTHING;
END $$;

COMMIT;
