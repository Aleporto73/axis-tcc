-- =====================================================
-- Migration 004: Seed Engine Versions
-- Conforme Bible S2 — Motor de Sugestões CSO-ABA
--   Versão inicial v3.0 com pesos equilibrados:
--     SAS = 0.25, PIS = 0.25, BSS = 0.25, TCM = 0.25
-- Idempotente: usa IF NOT EXISTS + ON CONFLICT
-- =====================================================

BEGIN;

-- ─── Tabela de versões do motor ─────────────────────
CREATE TABLE IF NOT EXISTS engine_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  weights JSONB NOT NULL,
  ruleset_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  deprecated_at TIMESTAMP,
  CONSTRAINT uq_engine_version UNIQUE (engine_name, version)
);

CREATE INDEX IF NOT EXISTS idx_engine_versions_active
  ON engine_versions (engine_name)
  WHERE is_active = true;

-- ─── Documentação ───────────────────────────────────
COMMENT ON TABLE engine_versions IS 'Registro versionado dos motores de sugestão (Bible S2)';
COMMENT ON COLUMN engine_versions.engine_name IS 'Identificador do motor (ex: CSO-ABA)';
COMMENT ON COLUMN engine_versions.version IS 'Semver do motor (ex: v3.0)';
COMMENT ON COLUMN engine_versions.weights IS 'Pesos dos sub-scores: SAS, PIS, BSS, TCM';
COMMENT ON COLUMN engine_versions.ruleset_hash IS 'SHA-256 do conjunto de regras associado';
COMMENT ON COLUMN engine_versions.is_active IS 'Apenas uma versão ativa por engine_name';
COMMENT ON COLUMN engine_versions.deprecated_at IS 'Data de descontinuação (NULL = vigente)';

-- ─── Seed: CSO-ABA v3.0 (pesos equilibrados) ───────
INSERT INTO engine_versions (engine_name, version, description, weights, is_active)
VALUES (
  'CSO-ABA',
  'v3.0',
  'Motor de sugestões CSO-ABA com pesos equilibrados — Bible S2',
  '{"SAS": 0.25, "PIS": 0.25, "BSS": 0.25, "TCM": 0.25}'::jsonb,
  true
)
ON CONFLICT (engine_name, version) DO NOTHING;

COMMIT;
