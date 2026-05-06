-- =====================================================
-- Migration 036: Sprint 3 — Integridade (v2.7.0)
--
-- 1 tabela nova:
-- 1. integrity_flags (alertas de conformidade)
--
-- 100% ADITIVA — não toca motor CSO-ABA v2.6.1
-- Idempotente (IF NOT EXISTS em tudo)
-- SEM BEGIN/COMMIT — cada comando independente
--
-- Ref: skill_axis_aba_v270.md (Sprint 3 — Integridade)
-- Depende: Migration 035 (Sprint 2 institucional)
-- Data: 2026-03-20
-- =====================================================


-- ─────────────────────────────────────────────────────
-- §1. INTEGRITY_FLAGS
-- Alertas de conformidade e integridade do sistema.
--
-- Regras de detecção (Bible v2.7.0):
--   OVERLAP_SESSIONS: critical — 2 sessões simultâneas mesmo terapeuta
--   IMPOSSIBLE_TRAVEL: critical — checkout A → checkin B <15min, >20km
--   UNEXPECTED_LOCATION: warning — geo > raio x 3
--   DUPLICATE_PHOTO: critical — mesmo hash em sessões diferentes
--   RETROEDIT_ATTEMPT: critical — editar sessão fechada
--   EXCESSIVE_DURATION: warning — sessão > 6h
--   RECURRENT_EXCEPTION: warning — >30% exceções no mês
--   MISSING_GEO_REQUIRED: warning — sem geo quando pagador exige
--   EXPIRED_COUNCIL: warning — conselho vencido
--   EXPIRED_COVERAGE: warning — cobertura expirada
--   INACTIVE_PROVIDER: warning — inativo atendendo
--   NO_ATTESTATION: info — sem atestação quando pagador exige
--   INCOMPLETE_PACKET: warning — itens obrigatórios faltantes
--   HOURS_EXCEEDED: warning — horas > autorizadas
--
-- Princípios:
--   - Flag critical NÃO pode ser waived sem review_notes
--   - Detecção diária via scan job
--   - UPSERT (first/last_detected_at)
--   - auto_resolved para flags que se corrigem sozinhas
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integrity_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('session','provider','packet','learner','coverage')),
  entity_id UUID NOT NULL,
  rule_code TEXT NOT NULL,
  severity TEXT NOT NULL
    CHECK (severity IN ('info','warning','critical')),
  description TEXT NOT NULL,
  metadata JSONB NULL,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewing','resolved','waived')),
  reviewed_by UUID NULL REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ NULL,
  review_notes TEXT NULL,
  auto_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries frequentes
CREATE INDEX IF NOT EXISTS idx_integrity_flags_tenant
  ON integrity_flags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integrity_flags_entity
  ON integrity_flags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_integrity_flags_rule
  ON integrity_flags(rule_code);
CREATE INDEX IF NOT EXISTS idx_integrity_flags_severity
  ON integrity_flags(severity);
CREATE INDEX IF NOT EXISTS idx_integrity_flags_status
  ON integrity_flags(status);
CREATE INDEX IF NOT EXISTS idx_integrity_flags_open
  ON integrity_flags(tenant_id, status)
  WHERE status IN ('open', 'reviewing');

-- UNIQUE para UPSERT (mesmo entity + rule = atualizar last_detected_at)
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrity_flags_upsert
  ON integrity_flags(tenant_id, entity_type, entity_id, rule_code)
  WHERE status IN ('open', 'reviewing');

-- RLS
ALTER TABLE integrity_flags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integrity_flags'
      AND policyname = 'integrity_flags_tenant_isolation'
  ) THEN
    CREATE POLICY integrity_flags_tenant_isolation
      ON integrity_flags
      FOR ALL
      USING (tenant_id = current_setting('app.tenant_id')::uuid);
  END IF;
END $$;


-- =====================================================
-- FIM — Migration 036 Sprint 3 Integridade
-- Tabela: integrity_flags
-- =====================================================
