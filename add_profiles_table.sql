-- =====================================================
-- AXIS ABA - MIGRATION: Multi-Terapeuta (Profiles + Roles)
-- Version: v2.6.1-profiles
-- Conforme AXIS ABA Bible v2.6.1
-- =====================================================

-- =====================
-- PROFILES (MULTI-USER POR TENANT)
-- =====================
-- Cada user Clerk tem um profile vinculado a um tenant (clínica)
-- Role: admin (dono/gestor), supervisor (supervisão clínica), terapeuta (execução)

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  clerk_user_id VARCHAR NOT NULL UNIQUE,
  role VARCHAR NOT NULL DEFAULT 'terapeuta'
    CHECK (role IN ('admin', 'supervisor', 'terapeuta')),
  name TEXT NOT NULL,
  email VARCHAR,
  crp VARCHAR,
  crp_uf VARCHAR(2),
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_clerk ON profiles(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(tenant_id, role);

-- =====================
-- LEARNER_THERAPISTS (VÍNCULO N:N)
-- =====================
-- Cada aprendiz pode ter vários terapeutas
-- Terapeuta só vê aprendizes vinculados a ele
-- Supervisor e Admin veem todos

CREATE TABLE IF NOT EXISTS learner_therapists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id),
  is_primary BOOLEAN DEFAULT false,
  UNIQUE(learner_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_lt_profile ON learner_therapists(profile_id);
CREATE INDEX IF NOT EXISTS idx_lt_learner ON learner_therapists(learner_id);
CREATE INDEX IF NOT EXISTS idx_lt_tenant ON learner_therapists(tenant_id);

-- =====================
-- MIGRAÇÃO DE DADOS EXISTENTES
-- =====================
-- Cada tenant existente vira admin do próprio tenant
-- Preserva dados: name, email, crp, crp_uf

INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, crp, crp_uf, is_active, created_at)
SELECT
  id AS tenant_id,
  clerk_user_id,
  'admin' AS role,
  COALESCE(name, 'Profissional') AS name,
  email,
  crp,
  crp_uf,
  true AS is_active,
  COALESCE(created_at, NOW())
FROM tenants
WHERE clerk_user_id IS NOT NULL
ON CONFLICT (clerk_user_id) DO NOTHING;

-- Vincular aprendizes existentes ao admin do tenant
-- (admin herda todos os aprendizes como terapeuta primário)
INSERT INTO learner_therapists (tenant_id, learner_id, profile_id, is_primary, assigned_at)
SELECT
  l.tenant_id,
  l.id AS learner_id,
  p.id AS profile_id,
  true AS is_primary,
  NOW()
FROM learners l
JOIN profiles p ON p.tenant_id = l.tenant_id AND p.role = 'admin'
ON CONFLICT (learner_id, profile_id) DO NOTHING;

-- =====================
-- AUDIT: Registrar migração
-- =====================
-- Nota: axis_audit_logs pode não ter todas as colunas esperadas.
-- Inserção condicional via DO block.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'axis_audit_logs') THEN
    INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
    SELECT
      p.tenant_id,
      p.clerk_user_id,
      'system',
      'PROFILE_CREATED',
      'profile',
      json_build_object('migration', 'add_profiles_table', 'role', 'admin', 'source', 'existing_tenant')::text,
      NOW()
    FROM profiles p;
  END IF;
END
$$;
