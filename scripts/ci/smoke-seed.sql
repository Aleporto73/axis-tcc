-- =====================================================
-- AXIS — Smoke Seed (CI ONLY)
-- HUB-09 (Onda 10): substitui scripts/ci/smoke-fixture.sql
--
-- Schema completo vem de baseline + migrations vivas (aplicados
-- pelos steps anteriores do job smoke):
--   1. scripts/migrations/000_shared_baseline.sql (97 tabelas)
--   2. scripts/migrations/067_shared_tenants_status.sql (idempotente)
--   3. scripts/migrations/068_shared_events_rls_forced.sql (idempotente)
--
-- Este arquivo contém APENAS os seeds mínimos para os 3 cron jobs
-- SQL ABA (check_expiration, expire_attestations, purge_geo).
--
-- Cobertura: 5 UUIDs fixos + 9 INSERTs = ~10 rows distribuídas em
-- 8 tabelas (profiles, learners, sessions_aba, payer_requirement_profiles,
-- provider_credentials, learner_coverage_profiles, session_attestations,
-- session_presence_proofs, session_attachments).
--
-- NÃO USAR EM PROD. ON CONFLICT DO NOTHING para idempotência se re-rodado.
-- =====================================================

BEGIN;

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
