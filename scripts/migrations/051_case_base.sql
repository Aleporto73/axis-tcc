-- Migration 051: Base do Caso TCC
-- Formulário estruturado com 4 campos TCC por paciente.
-- Todos os campos opcionais. UNIQUE(patient_id, tenant_id) garante 1 por paciente por tenant.

CREATE TABLE IF NOT EXISTS case_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  chief_complaint TEXT,
  identified_pattern TEXT,
  triggers TEXT,
  core_belief TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(patient_id, tenant_id)
);

CREATE INDEX idx_case_bases_patient ON case_bases(patient_id);
CREATE INDEX idx_case_bases_tenant ON case_bases(tenant_id);

ALTER TABLE case_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_bases FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON case_bases
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
