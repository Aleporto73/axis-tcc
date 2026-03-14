-- =====================================================
-- Migration 028: Fix License Gate
--
-- 1. Atualizar CHECK constraint de product_type para incluir 'tdah'
-- 2. Desativar licenças auto-provisionadas indevidamente
--    (CLERK_FREE_TIER e AUTO_FREE_TIER)
-- 3. Adicionar unique constraint uq_user_product (necessário para Hotmart UPSERT)
-- =====================================================

-- 1. Dropar e recriar CHECK constraint para incluir 'tdah'
ALTER TABLE user_licenses DROP CONSTRAINT IF EXISTS user_licenses_product_type_check;
ALTER TABLE user_licenses ADD CONSTRAINT user_licenses_product_type_check
  CHECK (product_type IN ('aba', 'tcc', 'tdah'));

-- 2. Desativar licenças auto-provisionadas (sem compra real)
-- Afeta apenas licenças criadas por CLERK_FREE_TIER ou AUTO_FREE_TIER
UPDATE user_licenses
SET is_active = false,
    updated_at = NOW()
WHERE hotmart_event IN ('CLERK_FREE_TIER', 'AUTO_FREE_TIER')
  AND is_active = true;

-- 3. Criar unique constraint para Hotmart UPSERT (se não existir)
-- Permite ON CONFLICT ON CONSTRAINT uq_user_product
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_product'
  ) THEN
    ALTER TABLE user_licenses
      ADD CONSTRAINT uq_user_product UNIQUE (tenant_id, product_type);
  END IF;
END $$;

-- =====================================================
-- DONE — 028_fix_license_gate.sql
-- =====================================================
