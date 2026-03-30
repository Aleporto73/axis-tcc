-- =====================================================
-- Migration 045: Background transcription jobs
-- Contexto: Transcrição assíncrona com worker separado.
-- Banco = índice/metadados. Disco = conteúdo pesado.
-- =====================================================

BEGIN;

-- ─── Tabela de jobs de transcrição ───
CREATE TABLE IF NOT EXISTS transcription_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  session_id        UUID NOT NULL REFERENCES sessions(id),
  patient_id        UUID NOT NULL REFERENCES patients(id),

  -- Estado
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','completed','failed')),
  progress          INTEGER NOT NULL DEFAULT 0
                    CHECK (progress BETWEEN 0 AND 100),

  -- Áudio (referência, não conteúdo)
  audio_path        TEXT NOT NULL,
  original_filename TEXT,
  file_size_bytes   BIGINT,

  -- Resultado
  transcript_id     UUID,
  error_message     TEXT,

  -- Retry
  attempts          INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 3,

  -- Lock + heartbeat do worker
  locked_at         TIMESTAMPTZ,
  worker_id         TEXT,
  heartbeat_at      TIMESTAMPTZ,

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ
);

-- Índice parcial: worker busca apenas pending, ordenado por created_at
CREATE INDEX IF NOT EXISTS idx_tjobs_pending
  ON transcription_jobs (created_at)
  WHERE status = 'pending';

-- Índice parcial: recovery de jobs travados
CREATE INDEX IF NOT EXISTS idx_tjobs_processing
  ON transcription_jobs (locked_at)
  WHERE status = 'processing';

-- Lookup por sessão
CREATE INDEX IF NOT EXISTS idx_tjobs_session
  ON transcription_jobs (session_id);

-- Constraint: máximo 1 job ativo por sessão
CREATE UNIQUE INDEX IF NOT EXISTS idx_tjobs_one_active_per_session
  ON transcription_jobs (session_id)
  WHERE status IN ('pending', 'processing');

-- RLS
ALTER TABLE transcription_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcription_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON transcription_jobs;
CREATE POLICY tenant_isolation ON transcription_jobs
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- ─── Expandir tabela transcripts (texto vai para disco) ───
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS transcript_path TEXT;
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS text_preview TEXT;
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS char_count INTEGER DEFAULT 0;

COMMIT;
