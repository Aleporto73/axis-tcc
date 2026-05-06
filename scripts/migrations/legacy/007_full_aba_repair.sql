-- =====================================================
-- Migration 007: REPARO COMPLETO — Todas as tabelas ABA
--
-- Diagnóstico: O init.sql cria schema TCC. As migrations 001-006
-- adicionam profiles, LGPD, engine_versions, onboarding, licenses.
-- Porém ~20 tabelas ABA referenciadas no código NUNCA foram criadas.
--
-- Esta migration cria TUDO que falta, de forma 100% idempotente
-- (IF NOT EXISTS em tudo). Pode rodar quantas vezes quiser.
--
-- SEM BEGIN/COMMIT — cada comando é independente.
-- Se um falhar, os demais continuam normalmente.
--
-- Corrigido: 2026-03-04 v2
-- =====================================================

-- ─────────────────────────────────────────────────────
-- §1. COLUNAS FALTANTES EM TENANTS
-- (init.sql só cria: id, name, plan, created_at)
-- ─────────────────────────────────────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email VARCHAR;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS crp VARCHAR;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS crp_uf VARCHAR(2);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS clinic_name TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_state VARCHAR(2);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_zip VARCHAR(10);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'free';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_patients INT DEFAULT 1;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_sessions INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_status VARCHAR;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS role VARCHAR;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cancellation_scheduled_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_plan_tier_check;
  ALTER TABLE tenants ADD CONSTRAINT tenants_plan_tier_check
    CHECK (plan_tier IN ('free','founders','clinica_100','clinica_250',
                         'trial','starter','professional','clinic'));
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenants_cancellation
  ON tenants (cancellation_scheduled_at)
  WHERE cancellation_scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_cnpj_unique
  ON tenants (cnpj)
  WHERE cnpj IS NOT NULL;

-- ─────────────────────────────────────────────────────
-- §2. PROFILES (migration 002)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  clerk_user_id VARCHAR NOT NULL UNIQUE,
  role VARCHAR NOT NULL DEFAULT 'terapeuta'
    CHECK (role IN ('admin', 'supervisor', 'terapeuta')),
  name TEXT NOT NULL,
  email VARCHAR,
  crp VARCHAR,
  crp_uf VARCHAR(2),
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES profiles(id),
  specialty TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_by UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS specialty TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_clerk ON profiles(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(tenant_id, role);

-- ─────────────────────────────────────────────────────
-- §3. LEARNERS — Tabela core ABA (precisa existir ANTES de learner_therapists)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  diagnosis TEXT,
  cid_code VARCHAR,
  support_level INT DEFAULT 2,
  school TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learners_tenant ON learners(tenant_id);
CREATE INDEX IF NOT EXISTS idx_learners_active ON learners(tenant_id) WHERE is_active = true AND deleted_at IS NULL;

-- ─────────────────────────────────────────────────────
-- §4. LEARNER_THERAPISTS (migration 002 — vínculo N:N)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learner_therapists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id),
  is_primary BOOLEAN DEFAULT false,
  UNIQUE(learner_id, profile_id)
);

ALTER TABLE learner_therapists ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
ALTER TABLE learner_therapists ADD COLUMN IF NOT EXISTS assigned_by UUID;

CREATE INDEX IF NOT EXISTS idx_lt_profile ON learner_therapists(profile_id);
CREATE INDEX IF NOT EXISTS idx_lt_learner ON learner_therapists(learner_id);
CREATE INDEX IF NOT EXISTS idx_lt_tenant ON learner_therapists(tenant_id);

-- ─────────────────────────────────────────────────────
-- §5. ENGINE_VERSIONS (migration 004)
-- ATENÇÃO: a tabela na VPS pode ter só is_current, ou só is_active,
-- ou ambas, ou nenhuma. Adicionamos ambas para cobrir tudo.
-- O código usa SOMENTE is_current.
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engine_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  ruleset_hash TEXT,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  deprecated_at TIMESTAMP,
  CONSTRAINT uq_engine_version UNIQUE (engine_name, version)
);

-- Garantir que ambas colunas existam (idempotente)
ALTER TABLE engine_versions ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT false;
ALTER TABLE engine_versions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Index usa is_current (que é o que o código consulta)
CREATE INDEX IF NOT EXISTS idx_engine_versions_current
  ON engine_versions (engine_name)
  WHERE is_current = true;

-- Seed CSO-ABA v3.0 — SEM referência a colunas que possam não existir
-- Primeiro tenta inserir, se já existe atualiza is_current
INSERT INTO engine_versions (engine_name, version, description, weights, is_current)
VALUES (
  'CSO-ABA',
  'v3.0',
  'Motor de sugestões CSO-ABA com pesos equilibrados — Bible S2',
  '{"SAS": 0.25, "PIS": 0.25, "BSS": 0.25, "TCM": 0.25}'::jsonb,
  true
)
ON CONFLICT (engine_name, version) DO UPDATE SET is_current = true;

-- ─────────────────────────────────────────────────────
-- §6. USER_LICENSES (migration 006)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  clerk_user_id TEXT,
  product_type TEXT,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  hotmart_transaction TEXT,
  hotmart_event TEXT,
  hotmart_offer TEXT,
  hotmart_plan TEXT,
  buyer_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS hotmart_transaction TEXT;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS hotmart_event TEXT;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS hotmart_offer TEXT;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS hotmart_plan TEXT;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS buyer_email TEXT;

CREATE INDEX IF NOT EXISTS idx_user_licenses_clerk_product
  ON user_licenses (clerk_user_id, product_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_licenses_tenant_user
  ON user_licenses (tenant_id, clerk_user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_licenses_tenant_type_active
  ON user_licenses (tenant_id, product_type) WHERE is_active = true;

-- ─────────────────────────────────────────────────────
-- §7. AXIS_AUDIT_LOGS (NUNCA FOI CRIADA — referenciada em 60+ files)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS axis_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id VARCHAR,
  actor VARCHAR DEFAULT 'system',
  action VARCHAR NOT NULL,
  entity_type VARCHAR,
  entity_id UUID,
  metadata JSONB,
  axis_version VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_axis_audit_logs_tenant
  ON axis_audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_axis_audit_logs_action
  ON axis_audit_logs (action);

-- ─────────────────────────────────────────────────────
-- §8. SESSIONS_ABA — Sessões ABA
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions_aba (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  therapist_id VARCHAR NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status VARCHAR NOT NULL DEFAULT 'scheduled',
  location TEXT,
  notes TEXT,
  duration_minutes INT,
  google_event_id VARCHAR,
  google_meet_link VARCHAR,
  patient_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_aba_tenant ON sessions_aba(tenant_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_aba_learner ON sessions_aba(learner_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_aba_therapist ON sessions_aba(therapist_id);
CREATE INDEX IF NOT EXISTS idx_sessions_aba_status ON sessions_aba(status);

-- ─────────────────────────────────────────────────────
-- §9. EBP_PRACTICES — Práticas baseadas em evidência
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ebp_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ebp_practices (name, description)
SELECT v.name, v.description FROM (VALUES
  ('DTT', 'Discrete Trial Training — ensino por tentativas discretas'),
  ('NET', 'Natural Environment Teaching — ensino em ambiente natural'),
  ('PRT', 'Pivotal Response Training — treino de respostas pivotais'),
  ('FCT', 'Functional Communication Training — treino de comunicação funcional'),
  ('PECS', 'Picture Exchange Communication System'),
  ('Social Stories', 'Histórias sociais para habilidades sociais'),
  ('Video Modeling', 'Modelação por vídeo'),
  ('Task Analysis', 'Análise de tarefas com encadeamento'),
  ('Self-Management', 'Autogerenciamento comportamental'),
  ('Extinction', 'Extinção de comportamento inadequado'),
  ('DRA', 'Differential Reinforcement of Alternative Behavior'),
  ('DRO', 'Differential Reinforcement of Other Behavior'),
  ('NCR', 'Noncontingent Reinforcement'),
  ('Prompt Fading', 'Esvanecimento gradual de dicas'),
  ('Shaping', 'Modelagem por aproximações sucessivas')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM ebp_practices WHERE ebp_practices.name = v.name);

-- ─────────────────────────────────────────────────────
-- §10. PEI_PLANS — Planos Educacionais Individualizados
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pei_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_date DATE,
  period_start DATE,
  period_end DATE,
  status VARCHAR DEFAULT 'active',
  created_by VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pei_plans_learner ON pei_plans(learner_id);

-- ─────────────────────────────────────────────────────
-- §11. PEI_GOALS — Objetivos dentro do PEI
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pei_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pei_plan_id UUID NOT NULL REFERENCES pei_plans(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  title TEXT NOT NULL,
  domain VARCHAR,
  description TEXT,
  target_pct INT DEFAULT 80,
  notes TEXT,
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pei_goals_plan ON pei_goals(pei_plan_id);

-- ─────────────────────────────────────────────────────
-- §12. LEARNER_PROTOCOLS — Protocolos ativos por aprendiz
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learner_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  domain TEXT,
  objective TEXT,
  ebp_practice_id UUID REFERENCES ebp_practices(id),
  status VARCHAR DEFAULT 'active',
  mastery_criteria_pct INT DEFAULT 80,
  mastery_criteria_sessions INT DEFAULT 3,
  mastery_criteria_trials INT DEFAULT 10,
  measurement_type VARCHAR,
  protocol_library_id UUID,
  pei_goal_id UUID REFERENCES pei_goals(id),
  protocol_engine_version VARCHAR,
  created_by VARCHAR,
  activated_at TIMESTAMPTZ,
  mastered_at TIMESTAMPTZ,
  generalization_status VARCHAR,
  regression_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lp_learner ON learner_protocols(learner_id);
CREATE INDEX IF NOT EXISTS idx_lp_tenant ON learner_protocols(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lp_status ON learner_protocols(status);

-- ─────────────────────────────────────────────────────
-- §13. CLINICAL_STATES_ABA — Estado clínico CSO-ABA
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinical_states_aba (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  cso_aba NUMERIC,
  cso_band VARCHAR,
  sas INT,
  pis INT,
  bss INT,
  tcm INT,
  engine_version VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csa_learner ON clinical_states_aba(learner_id, created_at DESC);

-- ─────────────────────────────────────────────────────
-- §14. SESSION_SNAPSHOTS — Snapshots CSO por sessão
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions_aba(id),
  learner_id UUID NOT NULL REFERENCES learners(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cso_aba INT,
  sas INT,
  pis INT,
  bss INT,
  tcm INT,
  cso_band VARCHAR,
  engine_version VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ss_session ON session_snapshots(session_id);

-- ─────────────────────────────────────────────────────
-- §15. SESSION_TARGETS — Alvos trabalhados por sessão
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  session_id UUID NOT NULL REFERENCES sessions_aba(id),
  protocol_id UUID REFERENCES learner_protocols(id),
  target_name TEXT,
  trials_correct INT,
  trials_total INT,
  prompt_level VARCHAR,
  score NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_st_session ON session_targets(session_id);

-- ─────────────────────────────────────────────────────
-- §16. SESSION_BEHAVIORS — Registros ABC por sessão
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_behaviors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  session_id UUID NOT NULL REFERENCES sessions_aba(id),
  antecedent TEXT,
  behavior TEXT,
  consequence TEXT,
  intensity VARCHAR,
  function_hypothesis TEXT,
  "timestamp" TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sb_session ON session_behaviors(session_id);

-- ─────────────────────────────────────────────────────
-- §17. MAINTENANCE_PROBES — Sondas de manutenção
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_probes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  protocol_id UUID NOT NULL REFERENCES learner_protocols(id),
  learner_id UUID NOT NULL REFERENCES learners(id),
  week_number INT,
  label TEXT,
  scheduled_at TIMESTAMPTZ,
  status VARCHAR DEFAULT 'pending',
  result VARCHAR,
  trials_total INT,
  trials_correct INT,
  score_pct NUMERIC,
  prompt_level VARCHAR,
  notes TEXT,
  evaluated_by VARCHAR,
  evaluated_at TIMESTAMPTZ,
  probe_number INT,
  weeks_after_mastery INT,
  completed_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_protocol ON maintenance_probes(protocol_id);
CREATE INDEX IF NOT EXISTS idx_mp_learner ON maintenance_probes(learner_id);

-- ─────────────────────────────────────────────────────
-- §18. GENERALIZATION_PROBES — Sondas de generalização
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generalization_probes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  protocol_id UUID NOT NULL REFERENCES learner_protocols(id),
  stimulus_variation VARCHAR,
  context_variation VARCHAR,
  applicator VARCHAR,
  environment VARCHAR,
  score NUMERIC,
  passed BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gp_protocol ON generalization_probes(protocol_id);

-- ─────────────────────────────────────────────────────
-- §19. GUARDIANS — Responsáveis legais dos aprendizes
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  learner_id UUID NOT NULL REFERENCES learners(id),
  name TEXT NOT NULL,
  email VARCHAR,
  phone VARCHAR,
  relationship VARCHAR,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardians_learner ON guardians(learner_id);

-- ─────────────────────────────────────────────────────
-- §20. GUARDIAN_CONSENTS — Termos LGPD dos responsáveis
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guardian_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  guardian_id UUID NOT NULL REFERENCES guardians(id),
  learner_id UUID NOT NULL REFERENCES learners(id),
  consent_type VARCHAR,
  consent_version VARCHAR,
  ip_address VARCHAR,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gc_guardian ON guardian_consents(guardian_id);

-- ─────────────────────────────────────────────────────
-- §21. NOTIFICATIONS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  recipient_id VARCHAR,
  user_id VARCHAR,
  type VARCHAR,
  title TEXT,
  message TEXT,
  status VARCHAR DEFAULT 'pending',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id, recipient_id);

-- ─────────────────────────────────────────────────────
-- §22. SESSION_SUMMARIES — Resumos de sessão
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  session_id UUID REFERENCES sessions_aba(id),
  learner_id UUID REFERENCES learners(id),
  summary_text TEXT,
  is_approved BOOLEAN DEFAULT false,
  approved_by VARCHAR,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ss2_session ON session_summaries(session_id);

-- ─────────────────────────────────────────────────────
-- §23. REPORT_SNAPSHOTS — Relatórios gerados
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  learner_id UUID REFERENCES learners(id),
  report_type VARCHAR,
  period_start DATE,
  period_end DATE,
  data_hash VARCHAR,
  pdf_url VARCHAR,
  generated_by VARCHAR,
  generated_at TIMESTAMPTZ,
  engine_version VARCHAR
);

CREATE INDEX IF NOT EXISTS idx_rs_learner ON report_snapshots(learner_id);

-- ─────────────────────────────────────────────────────
-- §24. FAMILY_PORTAL_ACCESS — Portal familiar
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  guardian_id UUID REFERENCES guardians(id),
  learner_id UUID REFERENCES learners(id),
  is_active BOOLEAN DEFAULT true,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────
-- §25. EMAIL_LOGS — Log de emails enviados
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  recipient VARCHAR,
  subject TEXT,
  status VARCHAR,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- §26. TABELAS DO ONBOARDING (migration 005)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  doc_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INT,
  mime_type TEXT,
  uploaded_by UUID,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_documents_tenant
  ON clinic_documents (tenant_id, doc_type);

CREATE TABLE IF NOT EXISTS compliance_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  accepted BOOLEAN DEFAULT false,
  accepted_by UUID,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_compliance_item UNIQUE (tenant_id, item_key)
);

CREATE TABLE IF NOT EXISTS protocol_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  objective TEXT NOT NULL,
  ebp_practice_name TEXT DEFAULT '',
  measurement_type TEXT DEFAULT 'discrete_trial',
  default_mastery_pct INT DEFAULT 80,
  default_mastery_sessions INT DEFAULT 3,
  default_mastery_trials INT DEFAULT 10,
  difficulty_level INT DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE protocol_library ADD COLUMN IF NOT EXISTS ebp_practice_name TEXT;
ALTER TABLE protocol_library ADD COLUMN IF NOT EXISTS measurement_type TEXT DEFAULT 'discrete_trial';
ALTER TABLE protocol_library ADD COLUMN IF NOT EXISTS default_mastery_pct INT DEFAULT 80;
ALTER TABLE protocol_library ADD COLUMN IF NOT EXISTS default_mastery_sessions INT DEFAULT 3;
ALTER TABLE protocol_library ADD COLUMN IF NOT EXISTS default_mastery_trials INT DEFAULT 10;
ALTER TABLE protocol_library ADD COLUMN IF NOT EXISTS difficulty_level INT DEFAULT 1;
ALTER TABLE protocol_library ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE protocol_library ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS onboarding_progress (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  current_step INT NOT NULL DEFAULT 0,
  total_steps INT NOT NULL DEFAULT 8,
  steps_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  clinic_data JSONB DEFAULT '{}'::jsonb,
  rt_data JSONB DEFAULT '{}'::jsonb,
  plan_data JSONB DEFAULT '{}'::jsonb,
  compliance_data JSONB DEFAULT '{}'::jsonb,
  skipped BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- §27. MIGRAÇÃO DE DADOS — Profiles para tenants existentes
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'clerk_user_id'
  ) THEN
    INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, crp, crp_uf, is_active, created_at)
    SELECT
      id AS tenant_id,
      clerk_user_id,
      'admin' AS role,
      COALESCE(name, 'Profissional') AS name,
      email,
      crp,
      crp_uf,
      true AS is_active,
      COALESCE(created_at, NOW())
    FROM tenants
    WHERE clerk_user_id IS NOT NULL
    ON CONFLICT (clerk_user_id) DO NOTHING;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────
-- §28. SEED — Licenças free para tenants existentes
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  INSERT INTO user_licenses (tenant_id, clerk_user_id, product_type, is_active, valid_from, hotmart_event, buyer_email)
  SELECT
    t.id,
    p.clerk_user_id,
    'aba',
    true,
    NOW(),
    'SEED_FREE_TIER',
    p.email
  FROM tenants t
  JOIN profiles p ON p.tenant_id = t.id AND p.is_active = true AND p.role = 'admin'
  WHERE NOT EXISTS (
    SELECT 1 FROM user_licenses ul
    WHERE ul.tenant_id = t.id AND ul.product_type = 'aba'
  );
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Seed licenses skipped: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────
-- §29. ATUALIZAR max_patients para planos existentes
-- ─────────────────────────────────────────────────────
UPDATE tenants SET max_patients = 1 WHERE plan_tier = 'free' AND (max_patients IS NULL OR max_patients < 1);
UPDATE tenants SET max_patients = 100 WHERE plan_tier = 'founders' AND (max_patients IS NULL OR max_patients < 100);
UPDATE tenants SET max_patients = 100 WHERE plan_tier = 'clinica_100' AND (max_patients IS NULL OR max_patients < 100);
UPDATE tenants SET max_patients = 250 WHERE plan_tier = 'clinica_250' AND (max_patients IS NULL OR max_patients < 250);

-- ─────────────────────────────────────────────────────
-- DONE! Verificar com:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
-- ─────────────────────────────────────────────────────
