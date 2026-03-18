-- =====================================================
-- Migration 031: Adiciona CPF e CRP na tabela profiles
-- Contexto: Onboarding TCC exige CPF + CRP obrigatórios
-- CPF com índice único (impede duplicatas)
-- =====================================================

BEGIN;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crp VARCHAR(20);

-- Índice único para CPF (ignora nulos e vazios)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf_unique
ON profiles(cpf)
WHERE cpf IS NOT NULL AND cpf != '';

COMMIT;
