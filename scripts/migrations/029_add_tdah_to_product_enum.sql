-- =====================================================
-- Migration 029: Adicionar 'tdah' ao enum aba_product_type
--
-- O banco de produção usa ENUM aba_product_type (não TEXT CHECK).
-- Precisamos adicionar 'tdah' como valor válido.
-- =====================================================

-- 1. Adicionar 'tdah' ao enum (IF NOT EXISTS para idempotência)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'tdah'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'aba_product_type')
  ) THEN
    ALTER TYPE aba_product_type ADD VALUE 'tdah';
  END IF;
END $$;

-- 2. Dropar CHECK constraint duplicado (migration 028 pode ter criado com TEXT)
ALTER TABLE user_licenses DROP CONSTRAINT IF EXISTS user_licenses_product_type_check;

-- 3. Garantir unique constraint para Hotmart UPSERT
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
-- DONE — 029_add_tdah_to_product_enum.sql
-- =====================================================
