-- =====================================================
-- Migration 006: Tabela user_licenses (Billing Hotmart)
--
--   Armazena licenças ativas dos usuários, criadas/gerenciadas
--   pelo webhook Hotmart (/api/webhook/hotmart).
--
--   Referenciada em:
--     - app/aba/layout.tsx (gate de acesso ao módulo)
--     - app/api/user/licenses/route.ts (API consulta)
--     - app/api/webhook/hotmart/route.ts (cria/atualiza)
--
--   Idempotente: usa IF NOT EXISTS
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS user_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculo com tenant e usuário
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  clerk_user_id TEXT NOT NULL,

  -- Tipo de produto ('aba' | 'tcc')
  product_type TEXT NOT NULL CHECK (product_type IN ('aba', 'tcc')),

  -- Estado da licença
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ DEFAULT NULL,

  -- Dados Hotmart (idempotência + rastreabilidade)
  hotmart_transaction TEXT,
  hotmart_event TEXT,
  hotmart_offer TEXT,
  hotmart_plan TEXT,
  buyer_email TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir colunas caso a tabela já exista de versão anterior
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS hotmart_transaction TEXT;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS hotmart_event TEXT;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS hotmart_offer TEXT;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS hotmart_plan TEXT;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS buyer_email TEXT;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Índice para gate de acesso (layout.tsx): busca por clerk_user_id + product_type
CREATE INDEX IF NOT EXISTS idx_user_licenses_clerk_product
  ON user_licenses (clerk_user_id, product_type)
  WHERE is_active = true;

-- Índice para webhook: busca por tenant_id + hotmart_transaction (idempotência)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_licenses_hotmart_tx
  ON user_licenses (tenant_id, hotmart_transaction)
  WHERE hotmart_transaction IS NOT NULL;

-- Índice para API licenses: busca por tenant_id + clerk_user_id + is_active
CREATE INDEX IF NOT EXISTS idx_user_licenses_tenant_user
  ON user_licenses (tenant_id, clerk_user_id)
  WHERE is_active = true;

-- Índice para desativação em massa por tipo (webhook cancelamento)
CREATE INDEX IF NOT EXISTS idx_user_licenses_tenant_type_active
  ON user_licenses (tenant_id, product_type)
  WHERE is_active = true;

COMMENT ON TABLE user_licenses IS 'Licenças de produto gerenciadas via webhook Hotmart. Cada compra gera um registro; cancelamentos desativam (is_active=false).';
COMMENT ON COLUMN user_licenses.hotmart_transaction IS 'ID de transação Hotmart (purchase.transaction ou subscription.subscriber.code) para idempotência';
COMMENT ON COLUMN user_licenses.valid_until IS 'NULL = sem expiração (assinatura ativa). Preenchido no cancelamento.';

-- ─── Seed: licença free automática para tenants existentes ───
-- Garante que tenants já cadastrados não fiquem bloqueados.
-- Cria uma licença ABA "free" (sem hotmart_transaction) para cada tenant
-- que já tem pelo menos um profile ativo.
INSERT INTO user_licenses (tenant_id, clerk_user_id, product_type, is_active, valid_from, hotmart_event, buyer_email)
SELECT
  t.id,
  p.clerk_user_id,
  'aba',
  true,
  NOW(),
  'SEED_FREE_TIER',
  p.email
FROM tenants t
JOIN profiles p ON p.tenant_id = t.id AND p.is_active = true AND p.role = 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM user_licenses ul
  WHERE ul.tenant_id = t.id AND ul.product_type = 'aba'
)
ON CONFLICT DO NOTHING;

-- ─── Atualizar CHECK constraint de plan_tier nos tenants ───
-- Migration 005 criou: CHECK (plan_tier IN ('trial','starter','professional','clinic'))
-- Agora alinhado com landing page: free, founders, clinica_100, clinica_250
-- DROP + ADD pra atualizar (idempotente com DO $$ BEGIN ... EXCEPTION)
DO $$
BEGIN
  ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_plan_tier_check;
  ALTER TABLE tenants ADD CONSTRAINT tenants_plan_tier_check
    CHECK (plan_tier IN ('free','founders','clinica_100','clinica_250',
                         'trial','starter','professional','clinic'));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Constraint plan_tier já atualizada';
END $$;

-- Migrar dados existentes de tiers antigos para novos
UPDATE tenants SET plan_tier = 'free' WHERE plan_tier = 'trial';
UPDATE tenants SET plan_tier = 'founders' WHERE plan_tier = 'starter';
UPDATE tenants SET plan_tier = 'clinica_100' WHERE plan_tier = 'professional';
UPDATE tenants SET plan_tier = 'clinica_250' WHERE plan_tier = 'clinic';

-- Atualizar max_patients para refletir os novos limites
UPDATE tenants SET max_patients = 1 WHERE plan_tier = 'free' AND (max_patients IS NULL OR max_patients < 1);
UPDATE tenants SET max_patients = 100 WHERE plan_tier = 'founders' AND (max_patients IS NULL OR max_patients < 100);
UPDATE tenants SET max_patients = 100 WHERE plan_tier = 'clinica_100' AND (max_patients IS NULL OR max_patients < 100);
UPDATE tenants SET max_patients = 250 WHERE plan_tier = 'clinica_250' AND (max_patients IS NULL OR max_patients < 250);

COMMIT;
