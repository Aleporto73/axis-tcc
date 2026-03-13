-- =====================================================
-- Migration 022: AXIS TDAH — Schema Completo
-- Conforme AXIS_TDAH_BIBLE v2.5
-- Motor CSO-TDAH v1.0.0 (3 blocos: Base + Executiva + AuDHD)
--
-- Idempotente: usa IF NOT EXISTS + ON CONFLICT
-- Não cria RLS policies (isolamento via withTenant, padrão AXIS)
-- =====================================================

BEGIN;

-- ─────────────────────────────────────────────────────
-- §1. ENUMS TDAH
-- ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE audhd_layer_status_enum AS ENUM ('off', 'active_core', 'active_full');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tdah_snapshot_type_enum AS ENUM ('session_close', 'clinical_review', 'monitoring_cycle', 'manual_override');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tdah_final_band_enum AS ENUM ('sem_dados', 'critico', 'atencao', 'bom', 'excelente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tdah_confidence_enum AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tdah_session_context_enum AS ENUM ('clinical', 'home', 'school');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────
-- §2. tdah_patients — Pacientes TDAH
-- Baseada em learners (ABA), adaptada para TDAH + Layer AuDHD
-- Bible §1-§5, §9 (Layer AuDHD), Anexo F
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tdah_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Dados básicos
  name VARCHAR(255) NOT NULL,
  birth_date DATE,
  gender VARCHAR(20),
  diagnosis TEXT,
  cid_code VARCHAR(20),
  support_level VARCHAR(20),

  -- Layer AuDHD (Bible §9, Anexo F)
  -- Default: active_core (Bible §5.4 "recomendado para baseline")
  audhd_layer_status audhd_layer_status_enum NOT NULL DEFAULT 'active_core',
  audhd_layer_activated_by UUID REFERENCES profiles(id),
  audhd_layer_activated_at TIMESTAMPTZ DEFAULT NOW(),
  audhd_layer_reason TEXT,
  audhd_layer_engine_version VARCHAR(20) DEFAULT 'v1.0.0',

  -- Contexto escolar (Bible §14, §17)
  school_name VARCHAR(255),
  school_contact VARCHAR(255),
  teacher_name VARCHAR(255),
  teacher_email VARCHAR(255),

  -- Status e LGPD
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  deleted_at TIMESTAMPTZ,

  -- Notas clínicas
  clinical_notes TEXT,

  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_tdah_patients_tenant ON tdah_patients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tdah_patients_status ON tdah_patients(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tdah_patients_audhd ON tdah_patients(tenant_id, audhd_layer_status);

-- ─────────────────────────────────────────────────────
-- §3. tdah_guardians — Responsáveis/Guardiões TDAH
-- Separado da tabela guardians ABA (que tem FK pra learners)
-- Bible §18, §27
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tdah_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES tdah_patients(id),

  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  relationship VARCHAR(50),  -- mae, pai, avo, tutor, outro
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdah_guardians_patient ON tdah_guardians(patient_id);

-- ─────────────────────────────────────────────────────
-- §4. tdah_sessions — Sessões TDAH
-- Baseada em sessions_aba, com session_context tricontextual
-- Bible §10, §16
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tdah_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES tdah_patients(id),

  -- Contexto tricontextual (Bible §14, §19)
  session_context tdah_session_context_enum NOT NULL DEFAULT 'clinical',

  -- Sequência e timing
  session_number INT,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INT,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),

  -- Profissionais
  clinician_id UUID REFERENCES profiles(id),
  therapist_id UUID REFERENCES profiles(id),

  -- Notas
  session_notes TEXT,

  -- Google Calendar (integração compartilhada)
  google_event_id VARCHAR(255),
  google_calendar_id VARCHAR(255),
  google_meet_link VARCHAR(500),

  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdah_sessions_tenant ON tdah_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tdah_sessions_patient ON tdah_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_tdah_sessions_date ON tdah_sessions(tenant_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tdah_sessions_status ON tdah_sessions(tenant_id, status);

-- ─────────────────────────────────────────────────────
-- §5. tdah_observations — Observações por bloco de tarefa
-- Equivalente a session_targets (ABA), mas blocos não trials
-- Bible §7 (Base), §8 (Executiva), §9.6 (AuDHD)
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tdah_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  session_id UUID NOT NULL REFERENCES tdah_sessions(id),
  protocol_id UUID,  -- FK adicionada após tdah_protocols existir

  -- Bloco de tarefa
  task_block_number INT,
  task_description TEXT,

  -- Camada Base (Bible §7)
  sas_score NUMERIC(5,2),           -- 0-100 percentual acerto/realização
  pis_level VARCHAR(20)             -- independente|gestual|verbal|modelacao|fisica_parcial|fisica_total
    CHECK (pis_level IS NULL OR pis_level IN ('independente', 'gestual', 'verbal', 'modelacao', 'fisica_parcial', 'fisica_total')),
  bss_level VARCHAR(20)             -- estavel|oscilante|instavel
    CHECK (bss_level IS NULL OR bss_level IN ('estavel', 'oscilante', 'instavel')),

  -- Camada Executiva (Bible §8)
  exr_level VARCHAR(30)             -- independente|apoio_minimo|apoio_significativo|nao_realiza
    CHECK (exr_level IS NULL OR exr_level IN ('independente', 'apoio_minimo', 'apoio_significativo', 'nao_realiza')),

  -- Layer AuDHD (Bible §9.6 — só quando ativa no paciente)
  sen_level VARCHAR(30)             -- sem_impacto|impacto_moderado|impacto_significativo
    CHECK (sen_level IS NULL OR sen_level IN ('sem_impacto', 'impacto_moderado', 'impacto_significativo')),
  trf_level VARCHAR(30)             -- transicao_fluida|com_resistencia|com_ruptura
    CHECK (trf_level IS NULL OR trf_level IN ('transicao_fluida', 'com_resistencia', 'com_ruptura')),

  -- RIG categórico (Bible §9.6.3, Anexo G §G3)
  -- REGRA: NUNCA escala linear. 4 estados + severity.
  rig_state VARCHAR(30)
    CHECK (rig_state IS NULL OR rig_state IN ('balanced', 'rigidity_leaning', 'impulsivity_leaning', 'dual_risk')),
  rig_severity VARCHAR(20)
    CHECK (rig_severity IS NULL OR rig_severity IN ('none', 'mild', 'moderate', 'high')),

  -- MSK opcional (Bible §9.6.4 — EM VALIDAÇÃO)
  msk_value NUMERIC(5,2),
  msk_status VARCHAR(30) DEFAULT 'validation_pending'
    CHECK (msk_status IS NULL OR msk_status IN ('validation_pending', 'valid', 'missing')),

  -- Notas
  observation_notes TEXT,

  -- Autoria e timing
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdah_observations_session ON tdah_observations(session_id);
CREATE INDEX IF NOT EXISTS idx_tdah_observations_tenant ON tdah_observations(tenant_id);

-- ─────────────────────────────────────────────────────
-- §6. tdah_events — Eventos clínicos TDAH
-- Equivalente a session_behaviors (ABA)
-- Bible §10.2
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tdah_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  session_id UUID NOT NULL REFERENCES tdah_sessions(id),

  -- Tipo de evento
  event_type VARCHAR(50) NOT NULL
    CHECK (event_type IN ('transition', 'sensory', 'behavioral', 'abc', 'task_avoidance', 'task_engagement', 'self_regulation', 'other')),

  -- ABC (quando aplicável — Bible §16 item 4)
  antecedent TEXT,
  behavior TEXT,
  consequence TEXT,
  description TEXT,

  -- Intensidade
  intensity VARCHAR(20)
    CHECK (intensity IS NULL OR intensity IN ('leve', 'moderada', 'alta', 'severa')),

  -- Contexto
  context tdah_session_context_enum,

  -- Autoria e timing
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdah_events_session ON tdah_events(session_id);
CREATE INDEX IF NOT EXISTS idx_tdah_events_tenant ON tdah_events(tenant_id);

-- ─────────────────────────────────────────────────────
-- §7. clinical_states_tdah — Estado clínico APPEND-ONLY
-- Contrato de output do motor (Bible Anexo G §G2)
-- NUNCA UPDATE, NUNCA DELETE
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinical_states_tdah (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES tdah_patients(id),

  -- Engine Lock (Bible §28)
  engine_name VARCHAR(20) NOT NULL DEFAULT 'CSO-TDAH',
  engine_version VARCHAR(20) NOT NULL,
  calculation_contract_version VARCHAR(20),

  -- Layer status NO MOMENTO do cálculo (Bible §10.4)
  audhd_layer_status audhd_layer_status_enum NOT NULL,

  -- Scores por bloco (Bible Anexo G §G2.4)
  core_score NUMERIC(5,2),
  executive_score NUMERIC(5,2),
  audhd_layer_score NUMERIC(5,2),
  final_score NUMERIC(5,2),

  -- Faixa e confiança (Bible Anexo G §G2.6, §G2.7)
  final_band tdah_final_band_enum NOT NULL,
  confidence_flag tdah_confidence_enum NOT NULL,

  -- Missing data COMPOSTO (Bible Anexo G §G4, v2.5)
  missing_data_primary_flag VARCHAR(30) NOT NULL DEFAULT 'none'
    CHECK (missing_data_primary_flag IN ('none', 'partial_context', 'insufficient_data', 'layer_data_missing')),
  missing_data_flags_json JSONB NOT NULL DEFAULT '[]',
  -- Shape: ["partial_context", "layer_data_missing"] (podem coexistir)

  -- Contextos com shape fechado (Bible Anexo G §G6.5, v2.5)
  source_contexts_json JSONB NOT NULL,
  -- Shape: { "clinical": "present"|"missing"|"not_applicable", "home": "...", "school": "..." }

  -- Métricas detalhadas por bloco
  core_metrics_json JSONB,
  -- Shape: { "sas_tdah": { "value": 80, "status": "valid" }, "pis_tdah": {...}, "bss_tdah": {...}, "tcm_tdah": {...} }
  executive_metrics_json JSONB,
  -- Shape: { "exr": { "value": 75, "status": "valid" }, "ctx": {...} }
  audhd_metrics_json JSONB,
  -- Shape: { "sen": {...}, "trf": {...}, "rig": { "rig_state": "...", "rig_severity": "...", "status": "valid" }, "msk": {...} }
  audhd_flags_json JSONB,
  -- Shape: { "rig_alert": true/false, "msk_experimental": true/false }

  -- APPEND-ONLY: só INSERT, nunca UPDATE/DELETE
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_states_tdah_patient ON clinical_states_tdah(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_states_tdah_tenant ON clinical_states_tdah(tenant_id);

-- ─────────────────────────────────────────────────────
-- §8. tdah_snapshots — Snapshot imutável
-- Bible §10, Anexo G §G6
-- Diferente do ABA: snapshot_type + session_id condicional
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tdah_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES tdah_patients(id),

  -- Tipo de snapshot (Bible Anexo G §G6.4)
  snapshot_type tdah_snapshot_type_enum NOT NULL,

  -- session_id CONDICIONAL (Bible v2.5: obrigatório SÓ quando session_close)
  session_id UUID REFERENCES tdah_sessions(id),
  -- Para clinical_review, monitoring_cycle, manual_override
  source_record_id UUID,

  -- Engine Lock
  engine_name VARCHAR(20) NOT NULL DEFAULT 'CSO-TDAH',
  engine_version VARCHAR(20) NOT NULL,
  calculation_contract_version VARCHAR(20),

  -- Layer status NO MOMENTO do snapshot
  audhd_layer_status audhd_layer_status_enum NOT NULL,

  -- Scores
  core_score NUMERIC(5,2),
  executive_score NUMERIC(5,2),
  audhd_layer_score NUMERIC(5,2),
  final_score NUMERIC(5,2),
  final_band tdah_final_band_enum NOT NULL,
  confidence_flag tdah_confidence_enum NOT NULL,

  -- Missing data
  missing_data_primary_flag VARCHAR(30) NOT NULL,
  missing_data_flags_json JSONB NOT NULL DEFAULT '[]',

  -- Contextos
  source_contexts_json JSONB NOT NULL,

  -- Métricas
  core_metrics_json JSONB,
  executive_metrics_json JSONB,
  audhd_metrics_json JSONB,
  audhd_flags_json JSONB,

  -- Autoria (Bible Anexo G §G6.6)
  generated_by_type VARCHAR(20) NOT NULL DEFAULT 'system'
    CHECK (generated_by_type IN ('system', 'human_override')),
  generated_by_user_id UUID REFERENCES profiles(id),

  -- IMUTÁVEL
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint: session_id obrigatório quando session_close (Bible v2.5 Regra 1)
ALTER TABLE tdah_snapshots DROP CONSTRAINT IF EXISTS chk_snapshot_session_required;
ALTER TABLE tdah_snapshots ADD CONSTRAINT chk_snapshot_session_required
  CHECK (
    (snapshot_type = 'session_close' AND session_id IS NOT NULL) OR
    (snapshot_type != 'session_close')
  );

-- Constraint: generated_by_user_id obrigatório em overrides (Bible v2.5 Regra 2)
ALTER TABLE tdah_snapshots DROP CONSTRAINT IF EXISTS chk_snapshot_override_author;
ALTER TABLE tdah_snapshots ADD CONSTRAINT chk_snapshot_override_author
  CHECK (
    (generated_by_type = 'human_override' AND generated_by_user_id IS NOT NULL) OR
    (snapshot_type = 'manual_override' AND generated_by_user_id IS NOT NULL) OR
    (generated_by_type = 'system' AND snapshot_type != 'manual_override')
  );

CREATE INDEX IF NOT EXISTS idx_tdah_snapshots_patient ON tdah_snapshots(patient_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_tdah_snapshots_session ON tdah_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_tdah_snapshots_tenant ON tdah_snapshots(tenant_id);

-- ─────────────────────────────────────────────────────
-- §9. tdah_protocol_library — Biblioteca de protocolos P1
-- Bible §20-§23, Anexo B
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tdah_protocol_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  code VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  block VARCHAR(10) NOT NULL,

  -- Classificação
  priority VARCHAR(10) NOT NULL DEFAULT 'P1'
    CHECK (priority IN ('P1', 'P1.1', 'P2')),

  -- Layer AuDHD
  requires_audhd_layer BOOLEAN DEFAULT FALSE,
  min_audhd_status VARCHAR(20)
    CHECK (min_audhd_status IS NULL OR min_audhd_status IN ('active_core', 'active_full')),

  -- Conteúdo clínico
  description TEXT,
  objective TEXT,
  procedure_text TEXT,
  measurement TEXT,
  mastery_criteria TEXT,
  regression_criteria TEXT,
  generalization_criteria TEXT,
  maintenance_criteria TEXT,

  -- Adaptação AuDHD
  audhd_adaptation TEXT,
  audhd_considerations TEXT,

  -- Domínio clínico (Bible §13)
  domain VARCHAR(50),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deprecated', 'draft')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- §10. tdah_protocols — Protocolos ativos por paciente
-- Bible §12, §22, §23
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tdah_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES tdah_patients(id),

  -- Referência à biblioteca
  library_protocol_id UUID REFERENCES tdah_protocol_library(id),

  -- Dados do protocolo
  code VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  block VARCHAR(10) NOT NULL,

  -- Ciclo de vida (padrão ABA estendido)
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'mastered', 'generalization', 'maintenance', 'maintained', 'regression', 'suspended', 'discontinued', 'archived')),

  -- Layer AuDHD (Bible §23)
  requires_audhd_layer BOOLEAN DEFAULT FALSE,
  audhd_adaptation_notes TEXT,

  -- Engine Lock
  protocol_engine_version VARCHAR(20) NOT NULL DEFAULT 'v1.0.0',

  -- Datas do ciclo
  started_at TIMESTAMPTZ,
  mastered_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,

  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Agora podemos criar a FK adiada de observations
DO $$ BEGIN
  ALTER TABLE tdah_observations
    ADD CONSTRAINT fk_tdah_observations_protocol
    FOREIGN KEY (protocol_id) REFERENCES tdah_protocols(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_tdah_protocols_patient ON tdah_protocols(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_tdah_protocols_tenant ON tdah_protocols(tenant_id);

-- ─────────────────────────────────────────────────────
-- §11. tdah_drc — Daily Report Card (escola)
-- CORE DO PRODUTO (Bible §14, §17)
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tdah_drc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES tdah_patients(id),

  -- Data do DRC
  drc_date DATE NOT NULL,

  -- Protocolo associado
  protocol_id UUID REFERENCES tdah_protocols(id),

  -- Metas (Bible §17: começar com 1-3 metas no máximo)
  goal_description TEXT NOT NULL,
  goal_met BOOLEAN,
  score NUMERIC(5,2),

  -- Quem preencheu
  filled_by VARCHAR(50)
    CHECK (filled_by IS NULL OR filled_by IN ('teacher', 'mediator', 'parent', 'other')),
  filled_by_name VARCHAR(255),

  -- Notas
  teacher_notes TEXT,
  clinician_review_notes TEXT,

  -- Revisado pelo clínico? (Bible §14.2 item 4)
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,

  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdah_drc_patient ON tdah_drc(patient_id, drc_date DESC);
CREATE INDEX IF NOT EXISTS idx_tdah_drc_tenant ON tdah_drc(tenant_id);

-- ─────────────────────────────────────────────────────
-- §12. tdah_routines — Rotinas domésticas
-- Bible §18
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tdah_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES tdah_patients(id),

  -- Tipo de rotina
  routine_type VARCHAR(50) NOT NULL
    CHECK (routine_type IN ('morning', 'afternoon', 'evening', 'homework', 'school_prep', 'other')),
  routine_name VARCHAR(255) NOT NULL,

  -- Passos estruturados (Bible §18: "Instrução curta, Sequência clara")
  steps_json JSONB,
  -- Shape: [{"order": 1, "description": "...", "visual_cue": "..."}]

  -- Reforço (Bible §18: "Reforço previsível")
  reinforcement_plan TEXT,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'archived')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdah_routines_patient ON tdah_routines(patient_id);

-- ─────────────────────────────────────────────────────
-- §13. tdah_audhd_log — Log ativação/desativação Layer
-- Bible §9.3, §9.5, Anexo F
-- REGRA: toda mudança gera log com autoria
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tdah_audhd_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES tdah_patients(id),

  -- Mudança de status
  previous_status audhd_layer_status_enum,
  new_status audhd_layer_status_enum NOT NULL,

  -- Autoria OBRIGATÓRIA (Bible Anexo F)
  changed_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT,

  -- Engine version no momento
  engine_version VARCHAR(20),

  -- APPEND-ONLY
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdah_audhd_log_patient ON tdah_audhd_log(patient_id, changed_at DESC);

-- ─────────────────────────────────────────────────────
-- §14. tdah_plans — Plano TDAH (não PEI)
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tdah_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES tdah_patients(id),

  title VARCHAR(255) NOT NULL,
  description TEXT,

  start_date DATE,
  end_date DATE,

  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'archived')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_tdah_plans_patient ON tdah_plans(patient_id);

-- ─────────────────────────────────────────────────────
-- §15. tdah_plan_goals — Metas do plano
-- Bible §13 (domínios clínicos)
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tdah_plan_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  plan_id UUID NOT NULL REFERENCES tdah_plans(id),

  -- Domínio clínico (Bible §13)
  domain VARCHAR(50) NOT NULL
    CHECK (domain IN (
      'atencao_sustentada', 'inicio_tarefa', 'permanencia_tarefa', 'conclusao_tarefa',
      'seguimento_instrucao', 'rotina_domestica', 'rotina_escolar',
      'controle_inibitorio', 'espera_turno', 'organizacao',
      'autorregulacao', 'transicoes', 'integracao_contextual', 'audhd'
    )),
  goal_description TEXT NOT NULL,
  target_criteria TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'achieved', 'paused', 'discontinued')),
  progress NUMERIC(5,2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdah_plan_goals_plan ON tdah_plan_goals(plan_id);

-- ─────────────────────────────────────────────────────
-- §16. Seed engine_versions — CSO-TDAH v1.0.0
-- Bible §6, §28
-- Pesos configuráveis (decisão 13/03/2026)
-- ─────────────────────────────────────────────────────

INSERT INTO engine_versions (engine_name, version, description, weights, is_active)
VALUES (
  'CSO-TDAH',
  'v1.0.0',
  'Motor CSO-TDAH v1.0 — 3 blocos (Base 50% + Executiva 30% + AuDHD 20%) — Bible v2.5',
  '{"core": 0.50, "executive": 0.30, "audhd": 0.20, "metrics": {"base": ["sas_tdah", "pis_tdah", "bss_tdah", "tcm_tdah"], "executive": ["exr", "ctx"], "audhd": ["sen", "trf"]}}'::jsonb,
  true
)
ON CONFLICT (engine_name, version) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- §17. Seed tdah_protocol_library — 12 Protocolos P1
-- Bible §21, Anexo B
-- ─────────────────────────────────────────────────────

INSERT INTO tdah_protocol_library (code, title, block, priority, domain, requires_audhd_layer, description) VALUES
  ('TDAH-A01', 'Iniciar tarefa em até 2 minutos', 'A', 'P1', 'inicio_tarefa', FALSE,
   'Treino de início de tarefa dentro de 2 minutos após instrução, com apoio visual quando necessário.'),
  ('TDAH-A02', 'Permanecer on-task por bloco curto', 'A', 'P1', 'permanencia_tarefa', FALSE,
   'Manutenção da atenção sustentada em bloco curto de tarefa (3-10 min conforme baseline).'),
  ('TDAH-B01', 'Seguir instrução de 1 passo', 'B', 'P1', 'seguimento_instrucao', FALSE,
   'Seguimento de instrução verbal simples de 1 passo em contexto estruturado.'),
  ('TDAH-B03', 'Completar rotina matinal com apoio visual', 'B', 'P1', 'rotina_domestica', FALSE,
   'Completar sequência de rotina matinal com apoio de checklist visual.'),
  ('TDAH-C01', 'Reduzir interrupções verbais', 'C', 'P1', 'controle_inibitorio', FALSE,
   'Redução de interrupções verbais em contexto estruturado (sala, roda, mesa).'),
  ('TDAH-C02', 'Esperar a vez em contexto estruturado', 'C', 'P1', 'espera_turno', FALSE,
   'Espera da vez com apoio visual ou verbal em contexto de grupo ou jogo estruturado.'),
  ('TDAH-D01', 'Organizar mochila/material', 'D', 'P1', 'organizacao', FALSE,
   'Organização de materiais escolares com checklist visual e rotina fixa.'),
  ('TDAH-E06', 'Implantar economia de fichas em casa', 'E', 'P1', 'rotina_domestica', FALSE,
   'Sistema de economia de fichas doméstico com contingências claras e reforço previsível.'),
  ('TDAH-F01', 'DRC de permanência em tarefa', 'F', 'P1', 'permanencia_tarefa', FALSE,
   'Daily Report Card escolar focada em permanência em tarefa com meta objetiva.'),
  ('TDAH-F06', 'Plano escola-casa com reforço cruzado', 'F', 'P1', 'integracao_contextual', FALSE,
   'Plano integrado escola-casa com reforço cruzado e contingências alinhadas.'),
  ('TDAH-G02', 'Solicitar pausa de forma funcional', 'G', 'P1', 'autorregulacao', FALSE,
   'Ensino de pedido funcional de pausa em contexto de sobrecarga ou demanda sustentada.'),
  ('TDAH-G06', 'Plano combinado para sensorialidade + tarefa', 'G', 'P1', 'audhd', TRUE,
   'Plano que combina manejo sensorial com demanda de tarefa. Requer layer AuDHD ativa.')
ON CONFLICT (code) DO NOTHING;

-- Extensões P1.1 candidatas (Bible §21.1 — NÃO ativas por padrão)
INSERT INTO tdah_protocol_library (code, title, block, priority, domain, requires_audhd_layer, status, description) VALUES
  ('TDAH-G08', 'Reduzir atrito em transição entre demandas', 'G', 'P1.1', 'transicoes', TRUE, 'draft',
   'Redução de atrito em transições entre demandas diferentes. Candidato — requer piloto.'),
  ('TDAH-G10', 'Ajustar rotina sob sobrecarga sensorial previsível', 'G', 'P1.1', 'audhd', TRUE, 'draft',
   'Ajuste preventivo de rotina quando sobrecarga sensorial é previsível. Candidato — requer piloto.')
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- §18. Comentários de documentação
-- ─────────────────────────────────────────────────────

COMMENT ON TABLE tdah_patients IS 'Pacientes TDAH com Layer AuDHD — Bible v2.5 §1-§9';
COMMENT ON TABLE tdah_sessions IS 'Sessões TDAH tricontextuais (clinical/home/school) — Bible §16';
COMMENT ON TABLE tdah_observations IS 'Observações por bloco de tarefa com 3 camadas — Bible §7-§9';
COMMENT ON TABLE tdah_events IS 'Eventos clínicos TDAH com ABC opcional — Bible §10';
COMMENT ON TABLE clinical_states_tdah IS 'Estado clínico APPEND-ONLY do CSO-TDAH — Bible Anexo G §G2';
COMMENT ON TABLE tdah_snapshots IS 'Snapshot imutável com snapshot_type condicional — Bible Anexo G §G6';
COMMENT ON TABLE tdah_protocol_library IS 'Biblioteca P1 de protocolos TDAH — Bible §20-§23, Anexo B';
COMMENT ON TABLE tdah_protocols IS 'Protocolos ativos por paciente com ciclo de vida — Bible §12';
COMMENT ON TABLE tdah_drc IS 'Daily Report Card escolar — core do produto TDAH — Bible §17';
COMMENT ON TABLE tdah_routines IS 'Rotinas domésticas estruturadas — Bible §18';
COMMENT ON TABLE tdah_audhd_log IS 'Log de ativação/desativação da Layer AuDHD — Bible §9.3, Anexo F';
COMMENT ON TABLE tdah_plans IS 'Plano TDAH por paciente';
COMMENT ON TABLE tdah_plan_goals IS 'Metas do plano com domínios clínicos — Bible §13';
COMMENT ON COLUMN clinical_states_tdah.created_at IS 'APPEND-ONLY: nunca UPDATE, nunca DELETE';
COMMENT ON COLUMN tdah_snapshots.snapshot_at IS 'IMUTÁVEL: snapshots nunca são sobrescritos';
COMMENT ON COLUMN tdah_observations.rig_state IS 'CATEGÓRICO: 4 estados, NUNCA escala linear — Bible §G3';
COMMENT ON COLUMN tdah_observations.msk_value IS 'EM VALIDAÇÃO: campo opcional até piloto — Bible §9.6.4';

COMMIT;
