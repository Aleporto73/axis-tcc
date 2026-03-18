-- =====================================================
-- Migration 030: Limpar licenças fantasma criadas pelo auto-provisioning
--
-- CONTEXTO:
--   Commit 0b49f49 (12/03/2026) introduziu auto-provisioning no Clerk
--   webhook que criava licenças TCC+ABA para TODOS os signups.
--   Commit 21520e4 (14/03/2026) removeu esse comportamento.
--
--   Licenças criadas entre 12/03 e 14/03 com hotmart_event = 'CLERK_FREE_TIER'
--   são fantasma — o user nunca pediu esses produtos.
--
-- AÇÃO:
--   Desativa licenças com hotmart_event = 'CLERK_FREE_TIER' que NÃO têm
--   hotmart_plan (nunca foram upgradadas via compra real).
--   Licenças que foram posteriormente upgradadas (hotmart_plan IS NOT NULL)
--   são preservadas.
--
-- REVERSÍVEL: atualiza valid_until e is_active, não deleta.
-- =====================================================

BEGIN;

-- 1. Desativar licenças fantasma (CLERK_FREE_TIER sem compra real)
UPDATE user_licenses
SET is_active = false,
    valid_until = NOW(),
    hotmart_event = 'CLERK_FREE_TIER_REVOKED',
    updated_at = NOW()
WHERE hotmart_event = 'CLERK_FREE_TIER'
  AND hotmart_plan IS NULL
  AND hotmart_transaction IS NULL;

-- 2. Audit log para rastreabilidade
INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
SELECT
  tenant_id,
  clerk_user_id,
  'migration_030',
  'PHANTOM_LICENSE_REVOKED',
  'user_licenses',
  json_build_object(
    'product_type', product_type,
    'original_event', 'CLERK_FREE_TIER',
    'reason', 'Licença criada automaticamente no signup (bug 0b49f49). Usuário nunca solicitou este produto.'
  )::text,
  NOW()
FROM user_licenses
WHERE hotmart_event = 'CLERK_FREE_TIER_REVOKED'
  AND updated_at >= NOW() - INTERVAL '1 minute';

COMMIT;
