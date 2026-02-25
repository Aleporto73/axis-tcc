-- =====================================================
-- Migration 005: Onboarding Light — Anexo D (9 lacunas)
--
--   Lacuna 1: Campos PJ na tabela tenants
--   Lacuna 2: CRP/UF do RT (garantir colunas em profiles)
--   Lacuna 3: Convite inicial de equipe (invite_tokens)
--   Lacuna 4: Seleção de plano/tier
--   Lacuna 5: Upload de documentos obrigatórios
--   Lacuna 6: Checklist de conformidade regulatória
--   Lacuna 7: Protocolos-modelo (protocol_library)
--   Lacuna 8: API dedicada de setup (lógica na rota)
--   Lacuna 9: Estado persistido no banco (onboarding_progress)
--
-- Idempotente: usa IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- =====================================================

BEGIN;

-- ─── Lacuna 1: Campos de clínica na tabela tenants ──
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS clinic_name TEXT,
  ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS address_zip VARCHAR(10),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN tenants.clinic_name IS 'Nome fantasia da clínica (Anexo D, lacuna 1)';
COMMENT ON COLUMN tenants.cnpj IS 'CNPJ da clínica (##.###.###/####-##)';
COMMENT ON COLUMN tenants.phone IS 'Telefone principal da clínica';
COMMENT ON COLUMN tenants.onboarding_completed_at IS 'Data de conclusão do wizard de onboarding';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_cnpj_unique
  ON tenants (cnpj)
  WHERE cnpj IS NOT NULL;

-- ─── Lacuna 2: CRP/UF do Responsável Técnico ────────
-- profiles já tem crp e crp_uf (migration 002), garantir specialty
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS specialty TEXT;

COMMENT ON COLUMN profiles.specialty IS 'Especialidade do profissional (ex: ABA, TCC, Neuro)';

-- ─── Lacuna 4: Seleção de plano ─────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'trial'
    CHECK (plan_tier IN ('trial','starter','professional','clinic'));

COMMENT ON COLUMN tenants.plan_tier IS 'Plano selecionado no onboarding (Anexo D, lacuna 4)';

-- ─── Lacuna 5: Upload de documentos obrigatórios ────
CREATE TABLE IF NOT EXISTS clinic_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'alvara', 'crp_rt', 'certificacao', 'contrato_social', 'outro'
  )),
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

COMMENT ON TABLE clinic_documents IS 'Documentos obrigatórios da clínica (Anexo D, lacuna 5)';

-- ─── Lacuna 6: Checklist de conformidade regulatória ──
CREATE TABLE IF NOT EXISTS compliance_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  accepted BOOLEAN DEFAULT false,
  accepted_by UUID,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_compliance_tenant_item UNIQUE (tenant_id, item_key)
);

COMMENT ON TABLE compliance_checklist IS 'Checklist regulatório do onboarding (Anexo D, lacuna 6)';

-- ─── Lacuna 7: Biblioteca de protocolos-modelo ──────
CREATE TABLE IF NOT EXISTS protocol_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  objective TEXT NOT NULL,
  ebp_practice_name TEXT NOT NULL,
  measurement_type TEXT DEFAULT 'discrete_trial',
  default_mastery_pct INT DEFAULT 80,
  default_mastery_sessions INT DEFAULT 3,
  default_mastery_trials INT DEFAULT 10,
  difficulty_level INT DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE protocol_library IS 'Protocolos-modelo pré-carregados (Anexo D, lacuna 7)';

-- ─── Seed: protocolos-modelo iniciais ───────────────
INSERT INTO protocol_library (title, domain, objective, ebp_practice_name, tags, difficulty_level)
VALUES
  ('Imitação Motora', 'comunicação', 'Imitar ações motoras simples sob comando', 'Discrete Trial Training', ARRAY['imitação','motor','básico'], 1),
  ('Tato de Objetos Comuns', 'linguagem', 'Nomear objetos comuns do cotidiano ao serem apresentados', 'Discrete Trial Training', ARRAY['tato','nomeação','linguagem'], 2),
  ('Mando Funcional', 'comunicação', 'Solicitar itens desejados de forma funcional e espontânea', 'Functional Communication Training', ARRAY['mando','comunicação','funcional'], 2),
  ('Intraverbal Simples', 'linguagem', 'Completar frases e responder perguntas simples sobre rotinas', 'Discrete Trial Training', ARRAY['intraverbal','linguagem','conversação'], 3),
  ('Habilidades Sociais - Cumprimentar', 'social', 'Cumprimentar pares e adultos de forma adequada em contextos sociais', 'Social Skills Training', ARRAY['social','cumprimentar','interação'], 2),
  ('Seguir Instruções de 2 Passos', 'comportamento_adaptativo', 'Seguir instruções com 2 componentes sequenciais', 'Discrete Trial Training', ARRAY['instrução','sequência','receptivo'], 2),
  ('Pareamento por Identidade', 'cognitivo', 'Parear objetos e figuras idênticas em campo de 3+', 'Discrete Trial Training', ARRAY['pareamento','identidade','visual'], 1),
  ('Tolerância a Espera', 'comportamento', 'Aguardar por item ou atividade preferida por tempo crescente', 'Differential Reinforcement', ARRAY['espera','tolerância','autocontrole'], 2)
ON CONFLICT DO NOTHING;

-- ─── Lacuna 9: Estado do onboarding persistido ──────
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

COMMENT ON TABLE onboarding_progress IS 'Estado server-side do wizard de onboarding (Anexo D, lacuna 9)';
COMMENT ON COLUMN onboarding_progress.steps_completed IS 'Array de step IDs já concluídos';
COMMENT ON COLUMN onboarding_progress.clinic_data IS 'Rascunho parcial dos dados da clínica';
COMMENT ON COLUMN onboarding_progress.rt_data IS 'Rascunho parcial dos dados do responsável técnico';

COMMIT;
