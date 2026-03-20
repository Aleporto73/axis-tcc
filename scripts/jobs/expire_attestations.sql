-- =====================================================
-- AXIS ABA v2.7.0 — Job: expire_attestations
-- Frequência: Diário
-- Ação: Marca atestações pendentes expiradas
--
-- Ref: skill_axis_aba_v270.md — Jobs Operacionais
--   "expire_attestations | Diário | Marca atestações expiradas"
--
-- Workflow de exceção:
--   "Email magic_link → deadline 72h → 'expired' →
--    sessão NÃO bloqueia → bundle 'partial' + flag"
--
-- Default deadline: 72h (pode ser customizado por pagador)
-- =====================================================

BEGIN;

-- 1. Marcar atestações de responsável pendentes > deadline horas como expiradas
-- Default: 72h se não há perfil de pagador vinculado
UPDATE session_attestations sa
SET
  status = 'expired',
  updated_at = NOW()
WHERE sa.status = 'pending'
  AND sa.attestor_type = 'guardian'
  AND sa.created_at < NOW() - INTERVAL '72 hours';

-- 2. Para atestações com pagador que define deadline customizado:
-- Expira baseado em guardian_attestation_deadline_hours do perfil do pagador
UPDATE session_attestations sa
SET
  status = 'expired',
  updated_at = NOW()
FROM sessions_aba s
JOIN learner_coverage_profiles lcp ON lcp.learner_id = s.learner_id
  AND lcp.status = 'active'
JOIN payer_requirement_profiles prp ON prp.id = lcp.payer_profile_id
  AND prp.requires_guardian_attestation = true
WHERE sa.session_id = s.id
  AND sa.status = 'pending'
  AND sa.attestor_type = 'guardian'
  AND sa.created_at < NOW() - (prp.guardian_attestation_deadline_hours || ' hours')::interval;

-- 3. Gerar flag para atestações expiradas (NO_ATTESTATION)
INSERT INTO integrity_flags (
  tenant_id, entity_type, entity_id, rule_code, severity,
  description, metadata, first_detected_at, last_detected_at, status
)
SELECT
  sa.tenant_id,
  'session',
  sa.session_id,
  'NO_ATTESTATION',
  'info',
  'Atestação do responsável expirou sem assinatura',
  jsonb_build_object(
    'attestation_id', sa.id,
    'attestor_type', sa.attestor_type,
    'created_at', sa.created_at::text,
    'expired_at', NOW()::text
  ),
  NOW(),
  NOW(),
  'open'
FROM session_attestations sa
WHERE sa.status = 'expired'
  AND sa.attestor_type = 'guardian'
  AND sa.updated_at >= NOW() - INTERVAL '1 day'
ON CONFLICT (tenant_id, entity_type, entity_id, rule_code)
  WHERE status IN ('open', 'reviewing')
DO UPDATE SET
  last_detected_at = NOW(),
  metadata = EXCLUDED.metadata;

COMMIT;
