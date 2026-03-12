-- =====================================================
-- Migration 020: Colunas clínicas do paciente TCC
--
-- O modal de edição de paciente (PUT /api/patients/[id])
-- usa gender, diagnosis e medication, mas essas colunas
-- não existiam na tabela patients.
--
-- Idempotente: usa IF NOT EXISTS
-- =====================================================

BEGIN;

ALTER TABLE patients ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS diagnosis TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medication TEXT;

COMMENT ON COLUMN patients.gender IS 'Gênero do paciente (opcional)';
COMMENT ON COLUMN patients.diagnosis IS 'Diagnóstico clínico (opcional)';
COMMENT ON COLUMN patients.medication IS 'Medicação em uso (opcional)';

COMMIT;
