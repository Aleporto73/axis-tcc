-- =====================================================
-- Migration 034: Sprint 1 — Prova de Presença (v2.7.0)
--
-- 4 tabelas novas:
-- 1. session_presence_proofs (geo check-in/check-out)
-- 2. session_attestations (atestações digitais)
-- 3. session_evidence_bundles (pacote de evidência)
-- 4. session_attachments (fotos/docs)
--
-- 100% ADITIVA — não toca motor CSO-ABA v2.6.1
-- Idempotente (IF NOT EXISTS em tudo)
-- SEM BEGIN/COMMIT — cada comando independente
--
-- Ref: skill_axis_aba_v270.md (Sprint 1 — Prova de Presença)
-- Depende: Migration 033 (pgcrypto + service_sites)
-- Data: 2026-03-20
-- =====================================================

-- ─────────────────────────────────────────────────────
-- §1. SESSION_PRESENCE_PROOFS
-- Geolocalização de check-in e check-out.
--
-- Campos criptografados (pgcrypto): latitude, longitude, ip_address
-- Campos em claro (usados em regras/filtros): accuracy_meters,
--   distance_to_site_meters, confidence_status
--
-- Regras de classificação (Bible v2.7.0):
--   accuracy <= 50m E distância <= raio → valid
--   accuracy 50-100m → valid (nota moderada)
--   accuracy 100-500m → warning
--   accuracy > 500m → exception (justificativa obrigatória)
--   GPS negado → exception (exception_reason obrigatório)
--   telehealth → valid sem geo
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_presence_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions_aba(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Tipo de prova
  proof_type TEXT NOT NULL
    CHECK (proof_type IN ('checkin', 'checkout')),

  -- Geolocalização (CRIPTOGRAFADO — dados sensíveis do terapeuta)
  latitude_encrypted BYTEA NULL,
  longitude_encrypted BYTEA NULL,

  -- Em claro — necessário para regras de classificação e queries
  accuracy_meters DECIMAL(8,2) NULL,
  altitude_meters DECIMAL(8,2) NULL,
  distance_to_site_meters DECIMAL(8,2) NULL,

  -- Origem da captura
  capture_source TEXT NOT NULL DEFAULT 'browser_gps'
    CHECK (capture_source IN ('browser_gps', 'app_gps', 'manual_override')),

  -- Classificação (em claro — filtros e dashboards)
  confidence_status TEXT NOT NULL DEFAULT 'valid'
    CHECK (confidence_status IN ('valid', 'warning', 'exception')),
  exception_reason TEXT NULL,

  -- Integridade
  device_hash TEXT NULL,
  ip_address_encrypted BYTEA NULL,
  raw_payload_hash TEXT NULL,

  -- Vínculo com local esperado
  declared_site_id UUID REFERENCES service_sites(id) NULL,

  -- Quem e quando
  captured_at TIMESTAMPTZ NOT NULL,
  captured_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Um check-in e um check-out por sessão
  UNIQUE(session_id, proof_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_presence_proofs_session
  ON session_presence_proofs(session_id);

CREATE INDEX IF NOT EXISTS idx_presence_proofs_tenant
  ON session_presence_proofs(tenant_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_presence_proofs_status
  ON session_presence_proofs(tenant_id, confidence_status)
  WHERE confidence_status != 'valid';

CREATE INDEX IF NOT EXISTS idx_presence_proofs_site
  ON session_presence_proofs(declared_site_id)
  WHERE declared_site_id IS NOT NULL;

-- ─────────────────────────────────────────────────────
-- §2. SESSION_ATTESTATIONS
-- Atestações digitais de terapeuta, supervisor e responsável.
--
-- Bible v2.7.0 regras:
--   1. Terapeuta: automática ao fechar sessão (logado = autenticado)
--   2. Responsável: email com magic_link via Resend
--   3. Prazo: configurável (padrão 72h)
--   4. Expirada → status 'expired', sessão NÃO bloqueia
--   5. IMUTÁVEL após registro
--
-- Canal v2.7.0: email + magic_link (SMS/WhatsApp fora do escopo)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions_aba(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Quem atesta
  attestor_type TEXT NOT NULL
    CHECK (attestor_type IN ('therapist', 'supervisor', 'guardian')),
  attestor_id TEXT NOT NULL,
  attestor_name TEXT NOT NULL,
  attestor_document_masked TEXT NULL,

  -- Método de atestação
  attestation_method TEXT NOT NULL
    CHECK (attestation_method IN (
      'system_login', 'otp_email', 'magic_link',
      'canvas_signature', 'external_certificate', 'certified_timestamp'
    )),

  -- Hash de integridade (SHA256 de session_id + attestor_id + timestamp)
  attestation_hash TEXT NOT NULL,

  -- Dados sensíveis (CRIPTOGRAFADO)
  ip_address_encrypted BYTEA NULL,
  user_agent TEXT NULL,
  canvas_data_encrypted BYTEA NULL,

  -- Token para magic_link (responsável)
  magic_link_token TEXT NULL,

  -- Status e prazos
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('completed', 'pending', 'expired')),
  attested_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Uma atestação por tipo de attestor por sessão
  UNIQUE(session_id, attestor_type, attestor_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_attestations_session
  ON session_attestations(session_id);

CREATE INDEX IF NOT EXISTS idx_attestations_tenant
  ON session_attestations(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attestations_pending
  ON session_attestations(status, expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_attestations_magic_link
  ON session_attestations(magic_link_token)
  WHERE magic_link_token IS NOT NULL;

-- ─────────────────────────────────────────────────────
-- §3. SESSION_EVIDENCE_BUNDLES
-- Pacote de evidência por sessão. Imutável — correção cria nova versão.
--
-- Componentes (Bible v2.7.0):
--   - Snapshot clínico (CSO) — sempre
--   - Prova presença (geo) — depende do pagador
--   - Atestação terapeuta — sempre
--   - Atestação responsável — depende do pagador
--   - Anexos — depende do pagador
--   - Local declarado — sempre
--   - Metadados técnicos — sempre
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_evidence_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions_aba(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Hash de integridade (SHA256 de todos os componentes ordenados)
  bundle_hash TEXT NOT NULL,

  -- Componentes incluídos (lista de {type, ref_id, individual_hash})
  components JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Status do pacote
  status TEXT NOT NULL DEFAULT 'partial'
    CHECK (status IN ('complete', 'partial', 'exception')),

  -- Itens faltantes (para dashboard de conformidade)
  missing_items TEXT[] DEFAULT '{}',

  -- Versionamento (nova versão = NOVA LINHA, supersedes_id aponta anterior)
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_id UUID REFERENCES session_evidence_bundles(id) NULL,

  -- Geração
  generated_at TIMESTAMPTZ NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'system'
    CHECK (generated_by IN ('system', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_evidence_bundles_session
  ON session_evidence_bundles(session_id);

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_tenant
  ON session_evidence_bundles(tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_status
  ON session_evidence_bundles(tenant_id, status)
  WHERE status != 'complete';

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_latest
  ON session_evidence_bundles(session_id, version DESC);

-- ─────────────────────────────────────────────────────
-- §4. SESSION_ATTACHMENTS
-- Anexos de sessão (fotos, documentos).
--
-- Bible v2.7.0:
--   - EXIF bruto NUNCA armazenado
--   - Extrair apenas lat/lng/timestamp do EXIF
--   - Hash detecta duplicatas (DUPLICATE_PHOTO flag)
--   - Max 10MB. Formatos: JPG, PNG, PDF
--   - IMUTÁVEL após upload
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions_aba(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Tipo e metadados do arquivo
  attachment_type TEXT NOT NULL
    CHECK (attachment_type IN ('photo_checkin', 'photo_checkout', 'document', 'prescription', 'other')),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL
    CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
  mime_type TEXT NOT NULL
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  storage_path TEXT NOT NULL,

  -- Geo extraído do EXIF (CRIPTOGRAFADO — só lat/lng/timestamp)
  extracted_geo_encrypted BYTEA NULL,

  -- Quem e quando
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_attachments_session
  ON session_attachments(session_id);

CREATE INDEX IF NOT EXISTS idx_attachments_tenant
  ON session_attachments(tenant_id, uploaded_at DESC);

-- Detecção de duplicatas pelo hash do arquivo
CREATE INDEX IF NOT EXISTS idx_attachments_hash
  ON session_attachments(tenant_id, file_hash);

-- ─────────────────────────────────────────────────────
-- §5. RLS — Row Level Security (todas as tabelas)
-- Padrão: tenant_id = current_setting('app.tenant_id', true)
-- (GUC setado por withTenant() em src/database/with-tenant.ts)
-- ─────────────────────────────────────────────────────

-- session_presence_proofs
ALTER TABLE session_presence_proofs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS presence_proofs_tenant_isolation ON session_presence_proofs;
  CREATE POLICY presence_proofs_tenant_isolation ON session_presence_proofs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN others THEN NULL;
END $$;

-- session_attestations
ALTER TABLE session_attestations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS attestations_tenant_isolation ON session_attestations;
  CREATE POLICY attestations_tenant_isolation ON session_attestations
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN others THEN NULL;
END $$;

-- session_evidence_bundles
ALTER TABLE session_evidence_bundles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS evidence_bundles_tenant_isolation ON session_evidence_bundles;
  CREATE POLICY evidence_bundles_tenant_isolation ON session_evidence_bundles
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN others THEN NULL;
END $$;

-- session_attachments
ALTER TABLE session_attachments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS attachments_tenant_isolation ON session_attachments;
  CREATE POLICY attachments_tenant_isolation ON session_attachments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────
-- §6. SECURITY DEFINER FUNCTIONS
-- Para acesso público (magic_link de atestação do responsável)
-- Mesmo padrão do Portal Família (Migration 014)
-- ─────────────────────────────────────────────────────

-- Lookup atestação por magic_link_token (público — sem auth)
CREATE OR REPLACE FUNCTION fn_attestation_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  session_id UUID,
  attestor_type TEXT,
  attestor_name TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.session_id,
    sa.attestor_type,
    sa.attestor_name,
    sa.status,
    sa.expires_at
  FROM session_attestations sa
  WHERE sa.magic_link_token = p_token
    AND sa.status = 'pending'
    AND (sa.expires_at IS NULL OR sa.expires_at > NOW());
END;
$$;

-- Completar atestação por magic_link_token (público — sem auth)
CREATE OR REPLACE FUNCTION fn_complete_attestation(
  p_token TEXT,
  p_ip_encrypted BYTEA,
  p_user_agent TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_attestation_id UUID;
BEGIN
  UPDATE session_attestations
  SET
    status = 'completed',
    attested_at = NOW(),
    ip_address_encrypted = p_ip_encrypted,
    user_agent = p_user_agent
  WHERE magic_link_token = p_token
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING id INTO v_attestation_id;

  IF v_attestation_id IS NULL THEN
    RAISE EXCEPTION 'Atestação não encontrada, já completada ou expirada';
  END IF;

  RETURN v_attestation_id;
END;
$$;

-- =====================================================
-- FIM Migration 034
-- Criadas: 4 tabelas + RLS + 2 SECURITY DEFINER functions
-- Próxima: 035 (cobertura + claim packets + provider credentials)
-- =====================================================
