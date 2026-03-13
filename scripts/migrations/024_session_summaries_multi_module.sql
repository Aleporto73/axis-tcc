-- =====================================================
-- Migration 024: session_summaries multi-módulo
-- Torna session_summaries compatível com TDAH
-- Remove FK rígida para sessions_aba, adiciona source_module
-- =====================================================

-- Remover FK rígida de session_id (se existir) para permitir sessões TDAH
ALTER TABLE session_summaries DROP CONSTRAINT IF EXISTS session_summaries_session_id_fkey;

-- Adicionar source_module para distinguir ABA vs TDAH
ALTER TABLE session_summaries ADD COLUMN IF NOT EXISTS source_module VARCHAR(10) DEFAULT 'aba';

-- Index para filtrar por módulo
CREATE INDEX IF NOT EXISTS idx_session_summaries_module ON session_summaries(source_module);
