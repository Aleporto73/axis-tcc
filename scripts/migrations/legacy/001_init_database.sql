-- =====================================================
-- Migration 001: Database Initialization
-- Source: axis_tcc_init.sql (v1.3-FINAL)
-- Idempotente: usa CREATE TABLE IF NOT EXISTS
-- =====================================================

BEGIN;

-- ─── TENANTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'standard',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── PATIENTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  external_ref TEXT,
  preferred_session_type TEXT DEFAULT 'sem_preferencia',
  preferred_days TEXT[] DEFAULT '{}',
  preferred_times TEXT[] DEFAULT '{}',
  contact_preference TEXT DEFAULT 'whatsapp',
  reminder_advance_hours INT DEFAULT 24,
  treatment_phase TEXT DEFAULT 'avaliação',
  sessions_completed INT DEFAULT 0,
  requires_extra_care BOOLEAN DEFAULT false,
  observation_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── EXPOSURE HIERARCHIES ─────────────────────────
CREATE TABLE IF NOT EXISTS exposure_hierarchies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  name TEXT NOT NULL,
  target_fear TEXT NOT NULL,
  goal TEXT,
  status TEXT DEFAULT 'ativa',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── EXPOSURE ITEMS ───────────────────────────────
CREATE TABLE IF NOT EXISTS exposure_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hierarchy_id UUID NOT NULL REFERENCES exposure_hierarchies(id),
  description TEXT NOT NULL,
  suds_initial INT CHECK (suds_initial BETWEEN 0 AND 100),
  suds_current INT CHECK (suds_current BETWEEN 0 AND 100),
  position INT NOT NULL,
  status TEXT DEFAULT 'não_iniciado',
  attempts INT DEFAULT 0,
  last_attempt_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exposure_items_hierarchy ON exposure_items(hierarchy_id, position);

-- ─── CLINICAL STATES (CSO) — APPEND-ONLY ─────────
CREATE TABLE IF NOT EXISTS clinical_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  cso_version TEXT NOT NULL DEFAULT 'CSO_v2.0',
  clinical_phase TEXT NOT NULL,
  activation_level FLOAT,
  activation_level_source TEXT,
  activation_confidence FLOAT,
  cognitive_rigidity FLOAT,
  emotional_load FLOAT,
  emotional_load_source TEXT,
  emotional_confidence FLOAT,
  task_adherence FLOAT,
  task_adherence_source TEXT,
  adherence_confidence FLOAT,
  engagement_trend TEXT,
  risk_flags TEXT[] DEFAULT '{}',
  treatment_phase TEXT,
  sessions_in_phase INT DEFAULT 0,
  system_confidence FLOAT,
  source_event TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_states_patient ON clinical_states(patient_id, created_at DESC);

-- ─── SESSIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  session_type TEXT NOT NULL DEFAULT 'presencial',
  session_number INT NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_minutes INT,
  status TEXT NOT NULL DEFAULT 'agendada',
  cancellation_reason TEXT,
  agenda_items TEXT[] DEFAULT '{}',
  bridge_from_last TEXT,
  mood_check TEXT,
  cso_id UUID REFERENCES clinical_states(id),
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_session_number UNIQUE (patient_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_sessions_patient ON sessions(patient_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- ─── TASKS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT,
  difficulty_level INT CHECK (difficulty_level BETWEEN 1 AND 10),
  hierarchy_id UUID REFERENCES exposure_hierarchies(id),
  hierarchy_position INT,
  status TEXT NOT NULL DEFAULT 'pendente',
  patient_feedback TEXT,
  completion_quality INT CHECK (completion_quality BETWEEN 1 AND 10),
  assigned_at TIMESTAMP DEFAULT NOW(),
  due_date DATE,
  confirmed_at TIMESTAMP,
  assigned_in_session_id UUID REFERENCES sessions(id),
  reviewed_in_session_id UUID REFERENCES sessions(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_patient ON tasks(patient_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_hierarchy ON tasks(hierarchy_id);

-- ─── EVENTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  event_type TEXT NOT NULL,
  payload JSONB,
  source TEXT,
  related_entity_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_patient ON events(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- ─── SESSION NOTES ────────────────────────────────
CREATE TABLE IF NOT EXISTS session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agenda_review TEXT,
  mood_rating INT CHECK (mood_rating BETWEEN 0 AND 10),
  mood_comparison TEXT,
  bridge_summary TEXT,
  main_themes TEXT[] DEFAULT '{}',
  interventions_used TEXT[] DEFAULT '{}',
  homework_review TEXT,
  homework_assigned TEXT,
  clinical_observations TEXT,
  draft BOOLEAN DEFAULT true,
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_notes_session ON session_notes(session_id);

-- ─── SUGGESTIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  cso_id UUID NOT NULL REFERENCES clinical_states(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT[] DEFAULT '{}',
  confidence FLOAT,
  context JSONB,
  engine_version TEXT NOT NULL,
  ruleset_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suggestions_patient ON suggestions(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_type ON suggestions(type);

-- ─── SUGGESTION DECISIONS (LEDGER) ────────────────
CREATE TABLE IF NOT EXISTS suggestion_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  suggestion_id UUID NOT NULL REFERENCES suggestions(id),
  action TEXT NOT NULL,
  edited_text TEXT,
  cso_snapshot JSONB,
  engine_versions JSONB,
  user_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestion_decisions_patient ON suggestion_decisions(patient_id, created_at DESC);

-- ─── PATIENT ONBOARDING STATUS ────────────────────
CREATE TABLE IF NOT EXISTS patient_onboarding_status (
  patient_id UUID PRIMARY KEY REFERENCES patients(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  has_initial_assessment BOOLEAN DEFAULT false,
  has_treatment_goals BOOLEAN DEFAULT false,
  has_first_hierarchy BOOLEAN DEFAULT false,
  minimum_sessions_completed INT DEFAULT 0,
  ready_for_suggestions BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── PROFESSIONAL PREFERENCES ─────────────────────
CREATE TABLE IF NOT EXISTS professional_preferences (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  block_checkin BOOLEAN DEFAULT false,
  block_agenda BOOLEAN DEFAULT false,
  max_suggestions_per_month INT DEFAULT 20,
  silence_mode BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── RAG CONFIG ───────────────────────────────────
CREATE TABLE IF NOT EXISTS rag_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  lookback_months INT DEFAULT 12,
  decay_enabled BOOLEAN DEFAULT true,
  decay_half_life_months INT DEFAULT 6,
  index_sources TEXT[] DEFAULT ARRAY['notes', 'decisions', 'tasks'],
  exclude_before DATE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── TRANSCRIPTS ──────────────────────────────────
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

-- ─── ASSIST SUGGESTIONS ──────────────────────────
CREATE TABLE IF NOT EXISTS assist_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID REFERENCES patients(id),
  session_id UUID REFERENCES sessions(id),
  block_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  suggested_action TEXT,
  reason TEXT,
  confidence FLOAT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assist_suggestions_status ON assist_suggestions(status);

-- ─── ASSIST AUDIT LOG ─────────────────────────────
CREATE TABLE IF NOT EXISTS assist_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  assist_suggestion_id UUID REFERENCES assist_suggestions(id),
  entity_type TEXT,
  entity_id UUID,
  assistant_action TEXT,
  user_decision TEXT,
  user_comment TEXT,
  context_snapshot JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assist_audit_log_suggestion ON assist_audit_log(assist_suggestion_id);

-- ─── AUDIT LOGS (GENERAL) ─────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);

COMMIT;
