-- Migration 050: transcript_segments
-- Fase 9 — Armazena segments do faster-whisper com timestamps
-- para renderização visual da transcrição em blocos de 30s.

CREATE TABLE IF NOT EXISTS transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  segment_index INTEGER NOT NULL,
  start_seconds NUMERIC(10,3) NOT NULL,
  end_seconds NUMERIC(10,3) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_transcript_segments_transcript
  ON transcript_segments(transcript_id, segment_index);
CREATE INDEX idx_transcript_segments_tenant
  ON transcript_segments(tenant_id);

ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON transcript_segments
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY worker_access ON transcript_segments
  USING (current_setting('app.worker_mode', true) = 'true')
  WITH CHECK (current_setting('app.worker_mode', true) = 'true');
