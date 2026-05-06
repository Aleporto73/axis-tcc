-- =====================================================
-- Migration 055: DROP profiles.cpf
--
-- Contexto:
--   Migration 031 (29/10/2025) adicionou profiles.cpf como
--   obrigatorio para bloquear multi-contas (1 CPF = 1 conta).
--
--   Fase 12.1 (18/04/2026) pivotou o modelo comercial:
--   CPF deixou de ser coletado. Bloqueio de abuso agora e
--   feito via limite de 300 min de transcricao lifetime
--   por conta.
--
--   Esta migration elimina a coluna porque:
--   1. Nao e mais coletada (Fase 12.1 em producao)
--   2. Perdeu sua finalidade original (bloqueio multi-conta)
--   3. LGPD Art. 15 II: dados pessoais devem ser eliminados
--      quando a finalidade for alcancada ou nao existir mais.
--
--   3 registros pre-12.1 com CPF preenchido serao apagados
--   junto com a coluna. Usuarios afetados:
--     - marianatorido@hotmail.com (cadastro 31/03/2026)
--     - psinote10@gmail.com (cadastro 12/03/2026)
--     - psi.victorlopes@gmail.com (cadastro 07/04/2026)
-- =====================================================

BEGIN;

-- 1. Dropar indice unico (depende da coluna)
DROP INDEX IF EXISTS idx_profiles_cpf_unique;

-- 2. Dropar coluna
ALTER TABLE profiles DROP COLUMN IF EXISTS cpf;

COMMIT;