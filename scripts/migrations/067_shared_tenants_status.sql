-- Migration 067: tenants.status para controle de fallback admin
-- Onda 9 Bloco F — fechar HUB-04 sem deletar dados (auditoria AXIS rígida)
--
-- Contexto: HUB-04 documentava que withTenant fallback admin entrava
-- silencioso para 11 tenants órfãos (sem profiles ativos), atribuindo
-- role='admin' + planTier='free'. Risco prático = ZERO hoje (zero
-- usuários comerciais afetados), mas débito documentado.
--
-- Solução AXIS-compliant (não DELETE):
--   1. Adicionar tenants.status (active|orphan|inactive)
--   2. Marcar tenants sem profiles como 'orphan'
--   3. with-tenant.ts (Etapa F.2) checa status, rejeita se != 'active'
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + UPDATE só onde status='active'.

BEGIN;

-- 1) Adicionar coluna status (default 'active' pra não quebrar nada)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'orphan', 'inactive'));

-- 2) Marcar órfãos atuais (zero profiles ATIVOS associados) como 'orphan'
-- Critério: tenant existe mas nenhum profile aponta pra ele
UPDATE tenants t
SET status = 'orphan'
WHERE NOT EXISTS (
  SELECT 1 FROM profiles WHERE profiles.tenant_id = t.id
)
AND status = 'active';

-- 3) Index para query rápida no fallback de with-tenant
CREATE INDEX IF NOT EXISTS idx_tenants_status_clerk
  ON tenants(status, clerk_user_id)
  WHERE status = 'active';

-- 4) Comentário documentação
COMMENT ON COLUMN tenants.status IS
  'Status do tenant: active (uso normal), orphan (sem profiles, fallback admin rejeita), inactive (suspenso). Mudanças via UPDATE, não DELETE — auditoria rígida AXIS.';

COMMIT;
