-- =====================================================
-- Migration 021: Colunas faltantes na tabela sessions (TCC)
--
-- O código de criação de sessão (sessions/create) e
-- listagem (sessions/route.ts) usa colunas que existem
-- na sessions_aba (007) mas podem não existir na sessions TCC.
--
-- Idempotente: usa IF NOT EXISTS
-- =====================================================

BEGIN;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS google_event_id VARCHAR;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS google_meet_link VARCHAR;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS calendar_source TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS time_source TEXT DEFAULT 'manual';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS patient_response TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS external_etag TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMP;

COMMIT;
