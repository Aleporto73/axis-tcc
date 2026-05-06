-- =====================================================
-- Migration 012: Adicionar colunas de timestamp do ciclo de vida
-- Contexto: learner_protocols só tinha activated_at e mastered_at.
-- O PATCH route precisa das demais colunas para registrar
-- quando cada transição ocorreu (Bible S3).
-- =====================================================

-- Colunas faltantes no ciclo de vida
ALTER TABLE learner_protocols ADD COLUMN IF NOT EXISTS generalized_at TIMESTAMPTZ;
ALTER TABLE learner_protocols ADD COLUMN IF NOT EXISTS mastered_validated_at TIMESTAMPTZ;
ALTER TABLE learner_protocols ADD COLUMN IF NOT EXISTS maintained_at TIMESTAMPTZ;
ALTER TABLE learner_protocols ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE learner_protocols ADD COLUMN IF NOT EXISTS discontinued_at TIMESTAMPTZ;
ALTER TABLE learner_protocols ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- discontinuation_reason também era usado no PATCH mas não existia
ALTER TABLE learner_protocols ADD COLUMN IF NOT EXISTS discontinuation_reason TEXT;
