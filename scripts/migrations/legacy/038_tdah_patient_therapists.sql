-- =========================================================
-- Migration 038: TDAH Patient-Therapist Binding Table
-- =========================================================
-- Motivação: Auditoria 22/03/2026 — AXIS TDAH usava `created_by`
-- como filtro de visibilidade de terapeuta (v1 temporário).
-- Isso impede handoff, equipe multidisciplinar e operação real.
--
-- Solução: tabela N:N `tdah_patient_therapists` (paridade com ABA
-- `learner_therapists`) + view helper para queries de filtro.
--
-- IMPORTANTE: dados existentes são migrados automaticamente:
-- cada `created_by` vira um registro na nova tabela como is_primary=true.
-- =========================================================

-- 1) Tabela de vínculo
CREATE TABLE IF NOT EXISTS tdah_patient_therapists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES tdah_patients(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id),
  role_in_case TEXT NULL,  -- terapeuta_tdah, supervisor, fono, psicopedagoga, neuro
  UNIQUE(tenant_id, patient_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_tdah_pt_tenant ON tdah_patient_therapists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tdah_pt_patient ON tdah_patient_therapists(patient_id);
CREATE INDEX IF NOT EXISTS idx_tdah_pt_profile ON tdah_patient_therapists(profile_id);
CREATE INDEX IF NOT EXISTS idx_tdah_pt_lookup ON tdah_patient_therapists(tenant_id, profile_id);

-- 2) Migrar dados existentes: created_by → vínculo primário
INSERT INTO tdah_patient_therapists (tenant_id, patient_id, profile_id, is_primary, assigned_at, assigned_by, role_in_case)
SELECT
  p.tenant_id,
  p.id,
  p.created_by,
  true,
  p.created_at,
  p.created_by,
  'terapeuta_tdah'
FROM tdah_patients p
WHERE p.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tdah_patient_therapists tpt
    WHERE tpt.patient_id = p.id AND tpt.profile_id = p.created_by AND tpt.tenant_id = p.tenant_id
  );

-- 3) Audit log
INSERT INTO axis_audit_logs (tenant_id, action, entity_type, metadata)
SELECT DISTINCT tenant_id, 'migration_038_tdah_patient_therapists', 'system',
  jsonb_build_object('description', 'Migrated created_by to tdah_patient_therapists', 'migrated_at', NOW()::text)
FROM tdah_patients WHERE created_by IS NOT NULL
LIMIT 1;
