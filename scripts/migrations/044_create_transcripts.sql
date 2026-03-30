-- ─── TRANSCRIPTS ──────────────────────────────────
-- Tabela para armazenar transcrições de áudio das sessões TCC.
-- Referenciada por: transcribe route, analyze-tcc, sessions/finish, patients/delete.

CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  session_id UUID REFERENCES sessions(id),
  session_date DATE,
  text TEXT,
  quality_score FLOAT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_session ON transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_tenant ON transcripts(tenant_id);

-- RLS
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON transcripts;
CREATE POLICY tenant_isolation ON transcripts
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
