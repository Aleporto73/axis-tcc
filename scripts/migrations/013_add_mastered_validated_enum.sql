-- =====================================================
-- Migration 013: Adicionar 'mastered_validated' ao ENUM aba_protocol_status
-- Contexto: O ENUM no banco só tinha 10 valores. O código usa
-- 'mastered_validated' como estado intermediário entre generalização
-- e manutenção (Bible S3.2 regra 6). Sem esse valor, a auto-transição
-- após 6/6 generalização falha com:
--   "invalid input value for enum aba_protocol_status"
-- =====================================================

-- Adicionar valor ao ENUM (idempotente — só adiciona se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'mastered_validated'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'aba_protocol_status')
  ) THEN
    ALTER TYPE aba_protocol_status ADD VALUE 'mastered_validated' AFTER 'generalization';
  END IF;
END
$$;
