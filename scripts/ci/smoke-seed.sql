-- =====================================================
-- AXIS — Smoke Seed (CI ONLY)
-- HUB-09 (Onda 10): substitui scripts/ci/smoke-fixture.sql
-- Refatorado para schema REAL (97 tabelas, 48 RLS forced).
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
-- Cobertura: 6 UUIDs fixos + 10 INSERTs em 10 tabelas:
--   tenants, profiles, learners, sessions_aba, payer_requirement_profiles,
--   provider_credentials, learner_coverage_profiles, session_attestations,
--   session_presence_proofs, session_attachments.
--
-- Ordem de inserção respeitando FKs (tenants -> profiles/learners ->
-- sessions_aba/payer -> provider_credentials/coverage -> attestations/proofs/attachments).
--
-- CHECK constraints validados contra baseline:
--   - proof_type: 'checkin' (NÃO 'gps' como em versões antigas)
--   - attestor_type: 'guardian'
--   - attestation_method: 'system_login'
--   - attachment_type: 'photo_checkin'
--   - mime_type: 'image/jpeg'
--   - file_size_bytes: 1024 (entre 1 e 10485760)
--   - council_type: 'CRP'
--   - credential_status: 'active'
--
-- Idempotência: ON CONFLICT DO NOTHING em todos os INSERTs.
-- NÃO USAR EM PROD.
-- =====================================================

BEGIN;

-- ─── Dados de teste mínimos ───────────────────────────

DO $$
DECLARE
  v_tenant    UUID := '00000000-0000-0000-0000-000000000001';
  v_profile   UUID := '00000000-0000-0000-0000-000000000002';
  v_learner   UUID := '00000000-0000-0000-0000-000000000003';
  v_session   UUID := '00000000-0000-0000-0000-000000000004';
  v_payer     UUID := '00000000-0000-0000-0000-000000000005';
BEGIN
  -- 1) Tenant raiz (FK target de TUDO)
  INSERT INTO tenants (id, name)
    VALUES (v_tenant, 'Smoke Tenant')
    ON CONFLICT DO NOTHING;
  -- defaults: status='active', plan_tier='free', role='professional'

  -- 2) Profile (clerk_user_id NOT NULL)
  INSERT INTO profiles (id, tenant_id, clerk_user_id, name)
    VALUES (v_profile, v_tenant, 'smoke-clerk-user', 'Smoke Profile')
    ON CONFLICT DO NOTHING;
  -- defaults: role='terapeuta', is_active=true

  -- 3) Learner (birth_date NOT NULL)
  INSERT INTO learners (id, tenant_id, name, birth_date)
    VALUES (v_learner, v_tenant, 'Smoke Learner', '2020-01-01'::date)
    ON CONFLICT DO NOTHING;
  -- defaults: support_level=2, is_active=true

  -- 4) Session ABA (therapist_id + scheduled_at NOT NULL)
  INSERT INTO sessions_aba (id, tenant_id, learner_id, therapist_id, scheduled_at)
    VALUES (
      v_session, v_tenant, v_learner,
      'smoke-therapist',
      NOW() - INTERVAL '1 hour'
    )
    ON CONFLICT DO NOTHING;
  -- defaults: status='scheduled', service_mode='presencial'

  -- 5) Payer requirement profile (defaults cobrem maioria das NOT NULLs)
  INSERT INTO payer_requirement_profiles (id, tenant_id, payer_name, requires_guardian_attestation)
    VALUES (v_payer, v_tenant, 'Smoke Payer Profile', true)
    ON CONFLICT DO NOTHING;

  -- 6) check_expiration: provider_credentials VENCIDO (council_valid_until passado)
  --    full_name + council_uf NOT NULL
  INSERT INTO provider_credentials (
      tenant_id, profile_id, full_name,
      council_type, council_number, council_uf,
      council_valid_until, credential_status
    )
    VALUES (
      v_tenant, v_profile, 'Smoke Professional',
      'CRP', '12345', 'SP',
      (NOW() - INTERVAL '10 days')::date, 'active'
    )
    ON CONFLICT DO NOTHING;

  -- 7) check_expiration: learner_coverage_profiles EXPIRADO
  --    start_date NOT NULL
  INSERT INTO learner_coverage_profiles (
      tenant_id, learner_id, payer_profile_id, payer_name,
      start_date, end_date, status
    )
    VALUES (
      v_tenant, v_learner, v_payer, 'Smoke Payer',
      '2025-01-01'::date,
      (NOW() - INTERVAL '5 days')::date,
      'active'
    )
    ON CONFLICT DO NOTHING;

  -- 8) expire_attestations: 1 atestação PENDENTE > 72h (deve expirar)
  --    attestor_id, attestor_name, attestation_method, attestation_hash NOT NULL
  INSERT INTO session_attestations (
      tenant_id, session_id, status, attestor_type,
      attestor_id, attestor_name, attestation_method, attestation_hash,
      created_at
    )
    VALUES (
      v_tenant, v_session, 'pending', 'guardian',
      'smoke-guardian-id', 'Smoke Guardian', 'system_login', 'smoke-attest-hash-12345',
      NOW() - INTERVAL '4 days'
    )
    ON CONFLICT DO NOTHING;

  -- 9) purge_geo: session_presence_proofs > 2 anos (deve anonimizar)
  --    session_id, proof_type, captured_at, captured_by NOT NULL
  --    proof_type CHECK: 'checkin' ou 'checkout'
  INSERT INTO session_presence_proofs (
      tenant_id, session_id, proof_type,
      captured_at, captured_by, created_at,
      latitude_encrypted, longitude_encrypted, ip_address_encrypted,
      distance_to_site_meters
    )
    VALUES (
      v_tenant, v_session, 'checkin',
      NOW() - INTERVAL '3 years', v_profile, NOW() - INTERVAL '3 years',
      pgp_sym_encrypt('-23.5505', current_setting('app.encryption_key')),
      pgp_sym_encrypt('-46.6333', current_setting('app.encryption_key')),
      pgp_sym_encrypt('192.168.1.1', current_setting('app.encryption_key')),
      150.5
    )
    ON CONFLICT DO NOTHING;

  -- 10) purge_geo: session_attachments > 2 anos (deve anonimizar geo)
  --     9 NOT NULLs: session_id, attachment_type, file_name, file_hash,
  --     file_size_bytes, mime_type, storage_path, uploaded_by, uploaded_at
  --     CHECK: attachment_type, mime_type, file_size_bytes (1..10485760)
  INSERT INTO session_attachments (
      tenant_id, session_id, attachment_type,
      file_name, file_hash, file_size_bytes, mime_type, storage_path,
      uploaded_by, uploaded_at, created_at,
      extracted_geo_encrypted
    )
    VALUES (
      v_tenant, v_session, 'photo_checkin',
      'smoke-photo.jpg', 'sha256:smoke-attach-hash', 1024, 'image/jpeg', '/smoke/path/photo.jpg',
      v_profile, NOW() - INTERVAL '3 years', NOW() - INTERVAL '3 years',
      pgp_sym_encrypt('{"lat":-23,"lng":-46}', current_setting('app.encryption_key'))
    )
    ON CONFLICT DO NOTHING;
END $$;

COMMIT;
