-- Migration 054 — audio_duration_seconds em transcripts
-- Fase 13.1: duracao real do audio (fonte de verdade para minutos usados)
--
-- Preenchida pelo worker com segments[last].end do faster-whisper.
-- Registros antigos ficam NULL → fallback para calculo manual em getSessionDuration().

ALTER TABLE transcripts
  ADD COLUMN IF NOT EXISTS audio_duration_seconds NUMERIC(10,3);

COMMENT ON COLUMN transcripts.audio_duration_seconds IS
  'Duracao real do audio em segundos, extraida do ultimo segment do ASR. NULL para transcripts legados.';

-- Index para queries de agregacao por sessao (minimo custo, sem UNIQUE)
CREATE INDEX IF NOT EXISTS idx_transcripts_session_duration
  ON transcripts(session_id)
  WHERE audio_duration_seconds IS NOT NULL;
