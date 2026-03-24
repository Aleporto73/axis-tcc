-- =====================================================
-- Migration 042: ABA Domain Functions
--
-- Cria funções PL/pgSQL de domínio ABA que são chamadas
-- no código mas nunca foram commitadas em migrations.
--
-- Funções:
--   1. record_target_trial()  — registrar trial de alvo
--   2. record_behavior_event() — registrar evento ABC
--
-- Também cria:
--   - ENUMs: aba_prompt_level, aba_behavior_intensity
--   - Colunas faltantes em session_behaviors
--
-- Todas as operações são idempotentes (IF NOT EXISTS / OR REPLACE).
-- Pode rodar quantas vezes quiser sem efeito colateral.
--
-- Referência: AXIS_ABA_BIBLE v2.6.1 (motor clínico)
-- Data: 2026-03-24
-- =====================================================


-- ─────────────────────────────────────────────────────
-- §1. ENUM: aba_prompt_level
-- Níveis de dica usados em DTT (Discrete Trial Training)
-- Ordem hierárquica: independent (menos suporte) → full_physical (mais suporte)
-- ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE aba_prompt_level AS ENUM (
    'full_physical',     -- FP: Ajuda física total
    'partial_physical',  -- PP: Ajuda física parcial
    'model',             -- M: Modelação
    'gestural',          -- G: Gesto/Apontamento
    'positional',        -- Pos: Dica posicional
    'verbal',            -- V: Dica verbal
    'independent'        -- I: Sem dica (resposta independente)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE aba_prompt_level IS 'Níveis de prompt hierárquicos para DTT — de full_physical (mais suporte) a independent (sem suporte)';


-- ─────────────────────────────────────────────────────
-- §2. ENUM: aba_behavior_intensity
-- Intensidade do evento comportamental (modelo ABC)
-- ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE aba_behavior_intensity AS ENUM (
    'low',       -- Baixa: comportamento presente mas com impacto mínimo
    'moderate',  -- Moderada: requer intervenção mas é manejável
    'high',      -- Alta: requer intervenção imediata
    'severe'     -- Severa: risco à integridade física
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE aba_behavior_intensity IS 'Níveis de intensidade para eventos comportamentais ABC';


-- ─────────────────────────────────────────────────────
-- §3. Colunas faltantes em session_behaviors
-- A tabela base (migration 007) não inclui behavior_type,
-- duration_seconds, location e recorded_at que o código usa.
-- ─────────────────────────────────────────────────────
ALTER TABLE session_behaviors
  ADD COLUMN IF NOT EXISTS behavior_type VARCHAR;

ALTER TABLE session_behaviors
  ADD COLUMN IF NOT EXISTS duration_seconds INT;

ALTER TABLE session_behaviors
  ADD COLUMN IF NOT EXISTS location TEXT;

ALTER TABLE session_behaviors
  ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN session_behaviors.behavior_type IS 'Tipo do comportamento (ex: maladaptive, adaptive, stereotypy)';
COMMENT ON COLUMN session_behaviors.duration_seconds IS 'Duração do episódio comportamental em segundos';
COMMENT ON COLUMN session_behaviors.location IS 'Local onde o comportamento ocorreu';
COMMENT ON COLUMN session_behaviors.recorded_at IS 'Timestamp do registro (preenchido automaticamente)';


-- ─────────────────────────────────────────────────────
-- §4. FUNCTION: record_target_trial
--
-- Registra um trial de alvo durante sessão ABA.
-- Fluxo:
--   1. Valida que sessão existe e pertence ao tenant
--   2. Calcula score percentual (trials_correct / trials_total)
--   3. Insere em session_targets
--   4. Retorna a linha inserida
--
-- Chamada no código:
--   SELECT * FROM record_target_trial(
--     tenant_id, session_id, protocol_id, target_name,
--     trials_total::smallint, trials_correct::smallint,
--     prompt_level::aba_prompt_level, notes
--   )
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_target_trial(
  p_tenant_id   UUID,
  p_session_id  UUID,
  p_protocol_id UUID,
  p_target_name TEXT,
  p_trials_total SMALLINT,
  p_trials_correct SMALLINT,
  p_prompt_level aba_prompt_level,
  p_notes       TEXT DEFAULT NULL
)
RETURNS session_targets
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_session sessions_aba%ROWTYPE;
  v_score   NUMERIC;
  v_result  session_targets%ROWTYPE;
BEGIN
  -- 1. Validar sessão
  SELECT * INTO v_session
    FROM sessions_aba
    WHERE id = p_session_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Sessão não encontrada no tenant'
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Validar trials
  IF p_trials_total <= 0 THEN
    RAISE EXCEPTION '[AXIS ABA] trials_total deve ser > 0'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_trials_correct < 0 OR p_trials_correct > p_trials_total THEN
    RAISE EXCEPTION '[AXIS ABA] trials_correct deve estar entre 0 e trials_total'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Calcular score (percentual de acertos)
  v_score := ROUND((p_trials_correct::NUMERIC / p_trials_total::NUMERIC) * 100, 2);

  -- 4. Inserir trial
  INSERT INTO session_targets (
    id, tenant_id, session_id, protocol_id,
    target_name, trials_total, trials_correct,
    prompt_level, score, notes, created_at
  )
  VALUES (
    gen_random_uuid(), p_tenant_id, p_session_id, p_protocol_id,
    p_target_name, p_trials_total, p_trials_correct,
    p_prompt_level::VARCHAR, v_score, p_notes, NOW()
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION record_target_trial IS
  'Registra trial de alvo em sessão ABA. Calcula score percentual e insere em session_targets. '
  'Valida tenant_id + session_id. Parte do motor clínico CSO-ABA v2.6.1.';


-- ─────────────────────────────────────────────────────
-- §5. FUNCTION: record_behavior_event
--
-- Registra evento comportamental ABC durante sessão ABA.
-- Fluxo:
--   1. Valida que sessão existe e pertence ao tenant
--   2. Insere em session_behaviors com todos os campos
--   3. Retorna a linha inserida
--
-- Chamada no código:
--   SELECT * FROM record_behavior_event(
--     tenant_id, session_id, behavior_type,
--     antecedent, behavior, consequence,
--     intensity::aba_behavior_intensity,
--     duration_seconds, location
--   )
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_behavior_event(
  p_tenant_id        UUID,
  p_session_id       UUID,
  p_behavior_type    VARCHAR,
  p_antecedent       TEXT,
  p_behavior         TEXT,
  p_consequence      TEXT,
  p_intensity        aba_behavior_intensity,
  p_duration_seconds INT DEFAULT NULL,
  p_location         TEXT DEFAULT NULL
)
RETURNS session_behaviors
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_session sessions_aba%ROWTYPE;
  v_result  session_behaviors%ROWTYPE;
BEGIN
  -- 1. Validar sessão
  SELECT * INTO v_session
    FROM sessions_aba
    WHERE id = p_session_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Sessão não encontrada no tenant'
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Inserir evento comportamental (modelo ABC)
  INSERT INTO session_behaviors (
    id, tenant_id, session_id, behavior_type,
    antecedent, behavior, consequence,
    intensity, function_hypothesis,
    duration_seconds, location,
    recorded_at, created_at
  )
  VALUES (
    gen_random_uuid(), p_tenant_id, p_session_id, p_behavior_type,
    p_antecedent, p_behavior, p_consequence,
    p_intensity::VARCHAR, NULL,
    p_duration_seconds, p_location,
    NOW(), NOW()
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION record_behavior_event IS
  'Registra evento comportamental ABC (Antecedent-Behavior-Consequence) em sessão ABA. '
  'Valida tenant_id + session_id. Parte do motor clínico CSO-ABA v2.6.1.';


-- ─────────────────────────────────────────────────────
-- DONE! Verificar com:
--   SELECT proname, prosrc FROM pg_proc
--   WHERE proname IN ('record_target_trial', 'record_behavior_event');
-- ─────────────────────────────────────────────────────
