-- =====================================================
-- Migration 019: Colunas de perfil do paciente TCC
--
-- A tabela patients original (001) era minimalista.
-- O módulo TCC precisa de: full_name, email, phone,
-- birth_date, notes para o cadastro de pacientes.
--
-- Idempotente: usa IF NOT EXISTS
-- =====================================================

BEGIN;

ALTER TABLE patients ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS notes TEXT;

-- Preencher full_name com external_ref para pacientes existentes que não têm nome
UPDATE patients SET full_name = external_ref WHERE full_name IS NULL AND external_ref IS NOT NULL;

-- Índice para busca por nome
CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients (tenant_id, full_name);

COMMENT ON COLUMN patients.full_name IS 'Nome completo do paciente (TCC)';
COMMENT ON COLUMN patients.email IS 'Email do paciente (opcional, usado para portal família)';
COMMENT ON COLUMN patients.phone IS 'Telefone do paciente (opcional)';
COMMENT ON COLUMN patients.birth_date IS 'Data de nascimento (opcional)';
COMMENT ON COLUMN patients.notes IS 'Observações livres do profissional';

COMMIT;
