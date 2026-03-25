-- =====================================================
-- Migration 043: Corrigir portal_get_summaries() — Schema Mismatch
--
-- A function portal_get_summaries (criada na migration 014) referencia
-- colunas que não existem na tabela session_summaries:
--   - ss.content  → coluna real: ss.summary_text
--   - ss.status = 'approved' → coluna real: ss.is_approved (boolean) + ss.sent_at
--
-- O portal deve mostrar resumos ENVIADOS (que já foram aprovados + enviados
-- para a família). Filtro correto: sent_at IS NOT NULL.
--
-- Idempotente: CREATE OR REPLACE.
-- Data: 2026-03-24
-- =====================================================

CREATE OR REPLACE FUNCTION portal_get_summaries(p_learner_id uuid, p_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  content text,           -- mantém nome da coluna de saída por retrocompatibilidade com frontend portal
  approved_at timestamptz,
  scheduled_at timestamptz,
  duration_minutes integer
)
SECURITY DEFINER
LANGUAGE sql
STABLE
AS $$
  SELECT ss.id,
         ss.summary_text AS content,   -- mapeia coluna real → nome esperado pelo frontend
         ss.approved_at,
         s.scheduled_at,
         s.duration_minutes
  FROM session_summaries ss
  JOIN sessions_aba s ON s.id = ss.session_id
  WHERE ss.learner_id = p_learner_id AND ss.tenant_id = p_tenant_id
    AND ss.sent_at IS NOT NULL         -- só resumos enviados (substitui ss.status = 'approved')
  ORDER BY s.scheduled_at DESC
  LIMIT 10;
$$;

COMMENT ON FUNCTION portal_get_summaries IS
  'Retorna resumos de sessão enviados para o portal familiar. '
  'Filtro: sent_at IS NOT NULL (resumos que completaram approve + send). '
  'Coluna de saída "content" mapeia summary_text por retrocompatibilidade.';
