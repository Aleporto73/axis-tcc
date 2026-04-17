-- =====================================================
-- Migration 033: Sprint 0 — Operadora Ready (v2.7.0)
--
-- Infraestrutura base para camada institucional:
-- 1. Extensão pgcrypto (criptografia de dados sensíveis)
-- 2. Tabela service_sites (locais de atendimento)
-- 3. ALTER sessions_aba (declared_site_id + service_mode)
--
-- 100% ADITIVA — não altera motor CSO-ABA v2.6.1
-- Idempotente (IF NOT EXISTS em tudo)
-- SEM BEGIN/COMMIT — cada comando independente
--
-- Ref: skill_axis_aba_v270.md (Sprint 0 + Sprint 1 parcial)
-- Data: 2026-03-20
-- =====================================================

-- ─────────────────────────────────────────────────────
-- §1. EXTENSÃO PGCRYPTO
-- Necessária para pgp_sym_encrypt/pgp_sym_decrypt
-- Usada em: lat/long, IP, endereços, canvas_data, EXIF
-- ─────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────
-- §2. SERVICE_SITES — Locais esperados de atendimento
-- Cada tenant cadastra seus locais (clínica, domicílio, escola, etc.)
-- Lat/Long em claro nesta tabela (dados do LOCAL, não do paciente)
-- Endereço criptografado (pode conter dados pessoais — domicílio)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_name TEXT NOT NULL,
  site_type TEXT NOT NULL DEFAULT 'clinic'
    CHECK (site_type IN ('clinic', 'home', 'school', 'telehealth', 'community', 'other')),
  address_encrypted BYTEA NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  radius_meters INTEGER NOT NULL DEFAULT 200
    CHECK (radius_meters >= 50 AND radius_meters <= 5000),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_service_sites_tenant
  ON service_sites(tenant_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_service_sites_type
  ON service_sites(tenant_id, site_type);

-- ─────────────────────────────────────────────────────
-- §3. ALTER SESSIONS_ABA — Vincular sessão a local + modo
-- declared_site_id: FK para service_sites (NULL = não declarado)
-- service_mode: presencial, domiciliar, escolar, telehealth
-- ─────────────────────────────────────────────────────
ALTER TABLE sessions_aba
  ADD COLUMN IF NOT EXISTS declared_site_id UUID REFERENCES service_sites(id);

ALTER TABLE sessions_aba
  ADD COLUMN IF NOT EXISTS service_mode TEXT DEFAULT 'presencial'
    CHECK (service_mode IN ('presencial', 'domiciliar', 'escolar', 'telehealth'));

-- Índice para filtros por modo de serviço
CREATE INDEX IF NOT EXISTS idx_sessions_aba_service_mode
  ON sessions_aba(tenant_id, service_mode);

CREATE INDEX IF NOT EXISTS idx_sessions_aba_site
  ON sessions_aba(declared_site_id)
  WHERE declared_site_id IS NOT NULL;

-- ─────────────────────────────────────────────────────
-- §4. RLS — Row Level Security para service_sites
-- Mesmo padrão das demais tabelas ABA
-- ─────────────────────────────────────────────────────
ALTER TABLE service_sites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS service_sites_tenant_isolation ON service_sites;
  CREATE POLICY service_sites_tenant_isolation ON service_sites
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────
-- §5. SEED — Tipo "telehealth" default para todos os tenants
-- Cria um site_type=telehealth para cada tenant que ainda não tem
-- ─────────────────────────────────────────────────────
INSERT INTO service_sites (tenant_id, site_name, site_type, radius_meters)
SELECT t.id, 'Telehealth', 'telehealth', 200
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM service_sites ss
  WHERE ss.tenant_id = t.id AND ss.site_type = 'telehealth'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- FIM Migration 033
-- Próxima: 034 (presence_proofs + attestations + bundles + attachments)
-- =====================================================
