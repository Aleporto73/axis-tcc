-- =====================================================
-- AXIS ABA v2.7.0 — Job: check_expiration
-- Frequência: Diário
-- Ação: Flags para conselhos/coberturas vencendo em <=30 dias
--
-- Ref: skill_axis_aba_v270.md — Jobs Operacionais
--   "check_expiration | Diário | Flags para conselhos/coberturas
--    vencendo em <=30 dias"
--
-- Gera integrity_flags com UPSERT para:
--   - EXPIRED_COUNCIL: conselho profissional vencido ou vencendo
--   - EXPIRED_COVERAGE: cobertura expirada mas status 'active'
-- =====================================================

BEGIN;

-- 1. Conselhos vencidos ou vencendo (<=30 dias)
INSERT INTO integrity_flags (
  tenant_id, entity_type, entity_id, rule_code, severity,
  description, metadata, first_detected_at, last_detected_at, status
)
SELECT
  pc.tenant_id,
  'provider',
  pc.id,
  'EXPIRED_COUNCIL',
  CASE
    WHEN pc.council_valid_until < NOW() THEN 'warning'
    ELSE 'warning'
  END,
  CASE
    WHEN pc.council_valid_until < NOW() THEN
      'Conselho ' || pc.council_type || ' ' || pc.council_number || ' vencido em ' || pc.council_valid_until::date
    ELSE
      'Conselho ' || pc.council_type || ' ' || pc.council_number || ' vence em ' || pc.council_valid_until::date
  END,
  jsonb_build_object(
    'council_type', pc.council_type,
    'council_number', pc.council_number,
    'expiry_date', pc.council_valid_until::date,
    'profile_name', p.name,
    'days_until_expiry', EXTRACT(DAY FROM pc.council_valid_until - NOW())::int
  ),
  NOW(),
  NOW(),
  'open'
FROM provider_credentials pc
JOIN profiles p ON p.id = pc.profile_id
WHERE pc.council_valid_until IS NOT NULL
  AND pc.council_valid_until <= NOW() + INTERVAL '30 days'
  AND pc.credentialing_status != 'inactive'
ON CONFLICT (tenant_id, entity_type, entity_id, rule_code)
  WHERE status IN ('open', 'reviewing')
DO UPDATE SET
  last_detected_at = NOW(),
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- 2. Coberturas expiradas mas ainda 'active'
INSERT INTO integrity_flags (
  tenant_id, entity_type, entity_id, rule_code, severity,
  description, metadata, first_detected_at, last_detected_at, status
)
SELECT
  lcp.tenant_id,
  'coverage',
  lcp.id,
  'EXPIRED_COVERAGE',
  'warning',
  'Cobertura ' || lcp.payer_name || ' expirou em ' || lcp.end_date,
  jsonb_build_object(
    'payer_name', lcp.payer_name,
    'end_date', lcp.end_date::text,
    'learner_name', l.name,
    'authorization_code', COALESCE(lcp.authorization_code, 'N/A')
  ),
  NOW(),
  NOW(),
  'open'
FROM learner_coverage_profiles lcp
JOIN learners l ON l.id = lcp.learner_id
WHERE lcp.status = 'active'
  AND lcp.end_date IS NOT NULL
  AND lcp.end_date < NOW()
ON CONFLICT (tenant_id, entity_type, entity_id, rule_code)
  WHERE status IN ('open', 'reviewing')
DO UPDATE SET
  last_detected_at = NOW(),
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- 3. Auto-resolver flags de cobertura que foram corrigidas
UPDATE integrity_flags
SET
  status = 'resolved',
  auto_resolved = true,
  reviewed_at = NOW()
WHERE rule_code = 'EXPIRED_COVERAGE'
  AND status IN ('open', 'reviewing')
  AND entity_id NOT IN (
    SELECT lcp.id
    FROM learner_coverage_profiles lcp
    WHERE lcp.status = 'active'
      AND lcp.end_date IS NOT NULL
      AND lcp.end_date < NOW()
  );

COMMIT;
