-- =====================================================
-- Migration 018: Multi-Tenant Profiles
-- Permite que um clerk_user_id tenha profiles em múltiplos tenants.
-- Necessário para cenário: dono de clínica A convidado como terapeuta em clínica B.
-- =====================================================

-- 1. Remover constraint UNIQUE em clerk_user_id (permite múltiplos tenants por user)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_clerk_user_id_key;

-- 2. Adicionar UNIQUE composto (clerk_user_id + tenant_id) — mesmo user não pode ter 2 profiles no mesmo tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_clerk_tenant
  ON profiles(clerk_user_id, tenant_id);

-- 3. Manter índice simples por clerk_user_id para lookups rápidos
-- (idx_profiles_clerk já existe da criação original, verificar)
CREATE INDEX IF NOT EXISTS idx_profiles_clerk ON profiles(clerk_user_id);

-- 4. Índice por email para ativação de convites pendentes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(LOWER(email));
