-- Migration 017: Adicionar maintenance_started_at em learner_protocols
-- Timestamp de quando o protocolo entra no estado "maintenance" (início das sondas).
-- Distinto de maintained_at, que marca quando TODAS as sondas passaram.

ALTER TABLE learner_protocols
  ADD COLUMN IF NOT EXISTS maintenance_started_at TIMESTAMPTZ;

-- Preencher retroativamente para protocolos que já estão em maintenance/maintained
UPDATE learner_protocols
  SET maintenance_started_at = COALESCE(mastered_validated_at, mastered_at, updated_at)
  WHERE status IN ('maintenance', 'maintained') AND maintenance_started_at IS NULL;
