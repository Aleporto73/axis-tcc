-- 075_aba_fix_convenio_report_staleness.sql
-- FG-3a (PLANO_CORRECAO_ABA_V9): honestidade dos relatorios de convenio FUTUROS.
--
-- Contexto:
--   O motor CSO esta desligado desde 24/03: existem sessoes completed sem
--   session_snapshot ("orfas"). A versao atual de generate_convenio_data
--   e autocontraditoria:
--     - total_sessions conta todas as completed do periodo;
--     - sessions[] usava INNER JOIN em session_snapshots;
--     - cso_aba_avg virava 0.00 quando nao havia snapshot;
--     - has_clinical_data e cso_aba_current vinham de CSO fora do periodo.
--
-- Correcao:
--   1. total_sessions segue contando todas as completed do periodo.
--   2. sessions[] usa LEFT JOIN e inclui orfas com dados clinicos NULL.
--   3. summary.orphan_sessions_in_period explicita sessoes sem snapshot.
--   4. has_clinical_data considera somente snapshot dentro do periodo.
--   5. cso_aba_avg fica NULL quando nao ha snapshot no periodo.
--   6. cso_aba_current vem do ultimo snapshot dentro do periodo.
--   7. Nao toca em relatorios historicos, nao faz backfill.

BEGIN;

CREATE OR REPLACE FUNCTION public.generate_convenio_data(
  p_learner_id uuid,
  p_tenant_id uuid,
  p_period_start date,
  p_period_end date,
  p_generated_by character varying
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_learner             RECORD;
  v_sessions            JSONB;
  v_protocols           JSONB;
  v_cso_current         RECORD;
  v_cso_avg             NUMERIC;
  v_total_sessions      INTEGER;
  v_snapshots_in_period INTEGER;
  v_orphan_sessions     INTEGER;
  v_total_hours         NUMERIC;
  v_engine_ver          VARCHAR;
  v_result              JSONB;
BEGIN
  SELECT id, name, birth_date, diagnosis, cid_code, support_level
  INTO v_learner
  FROM learners
  WHERE id = p_learner_id
    AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Aprendiz % nao encontrado no tenant %.', p_learner_id, p_tenant_id;
  END IF;

  SELECT version INTO v_engine_ver
  FROM engine_versions
  WHERE is_current = TRUE;

  IF v_engine_ver IS NULL THEN
    RAISE EXCEPTION '[AXIS ABA] Nenhuma engine_version ativa.';
  END IF;

  -- Todas as sessoes completed do periodo.
  SELECT
    COUNT(*)::int,
    COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600), 0)
  INTO v_total_sessions, v_total_hours
  FROM sessions_aba
  WHERE learner_id = p_learner_id
    AND tenant_id = p_tenant_id
    AND status = 'completed'
    AND ended_at BETWEEN p_period_start AND p_period_end + INTERVAL '1 day';

  -- Lista reconciliada: inclui sessoes completed sem snapshot.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'session_date', sa.ended_at::DATE,
    'therapist_id', sa.therapist_id,
    'duration_min', ROUND(EXTRACT(EPOCH FROM (sa.ended_at - sa.started_at)) / 60),
    'cso_aba', ss.cso_aba,
    'sas', ss.sas,
    'pis', ss.pis,
    'bss', ss.bss,
    'tcm', ss.tcm,
    'clinical_data_available', ss.session_id IS NOT NULL
  ) ORDER BY sa.ended_at), '[]'::JSONB)
  INTO v_sessions
  FROM sessions_aba sa
  LEFT JOIN session_snapshots ss ON ss.session_id = sa.id
  WHERE sa.learner_id = p_learner_id
    AND sa.tenant_id = p_tenant_id
    AND sa.status = 'completed'
    AND sa.ended_at BETWEEN p_period_start AND p_period_end + INTERVAL '1 day';

  -- Snapshots e media somente dentro do periodo.
  SELECT COUNT(*)::int, AVG(ss.cso_aba)
  INTO v_snapshots_in_period, v_cso_avg
  FROM session_snapshots ss
  JOIN sessions_aba sa ON sa.id = ss.session_id
  WHERE sa.learner_id = p_learner_id
    AND sa.tenant_id = p_tenant_id
    AND sa.status = 'completed'
    AND sa.ended_at BETWEEN p_period_start AND p_period_end + INTERVAL '1 day';

  v_orphan_sessions := v_total_sessions - v_snapshots_in_period;

  -- Ultimo CSO dentro do periodo. Sem snapshot no periodo => campos NULL.
  SELECT
    ss.cso_aba,
    cso_aba_band(ss.cso_aba) AS cso_band,
    ss.sas,
    ss.pis,
    ss.bss,
    ss.tcm,
    ss.engine_version
  INTO v_cso_current
  FROM session_snapshots ss
  JOIN sessions_aba sa ON sa.id = ss.session_id
  WHERE sa.learner_id = p_learner_id
    AND sa.tenant_id = p_tenant_id
    AND sa.status = 'completed'
    AND sa.ended_at BETWEEN p_period_start AND p_period_end + INTERVAL '1 day'
  ORDER BY sa.ended_at DESC
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'title', lp.title,
    'status', lp.status,
    'domain', lp.domain,
    'ebp_practice', ep.name,
    'ebp_practice_pt', ep.name_pt,
    'fpg_reference', ep.fpg_reference,
    'mastery_criteria_pct', lp.mastery_criteria_pct,
    'generalization_status', lp.generalization_status,
    'regression_count', lp.regression_count,
    'activated_at', lp.activated_at,
    'mastered_at', lp.mastered_at
  ) ORDER BY lp.activated_at), '[]'::JSONB)
  INTO v_protocols
  FROM learner_protocols lp
  JOIN ebp_practices ep ON ep.id = lp.ebp_practice_id
  WHERE lp.learner_id = p_learner_id
    AND lp.tenant_id = p_tenant_id
    AND lp.status NOT IN ('draft', 'discontinued');

  v_result := jsonb_build_object(
    'report_type', 'convenio',
    'generated_at', NOW(),
    'generated_by', p_generated_by,
    'engine_version', v_engine_ver,
    'period', jsonb_build_object(
      'start', p_period_start,
      'end', p_period_end
    ),
    'learner', jsonb_build_object(
      'id', v_learner.id,
      'name', v_learner.name,
      'birth_date', v_learner.birth_date,
      'diagnosis', v_learner.diagnosis,
      'cid_code', v_learner.cid_code,
      'support_level', v_learner.support_level
    ),
    'has_clinical_data', v_snapshots_in_period > 0,
    'summary', jsonb_build_object(
      'total_sessions', v_total_sessions,
      'total_hours', ROUND(v_total_hours, 2),
      'cso_aba_avg', ROUND(v_cso_avg, 2),
      'cso_aba_current', v_cso_current.cso_aba,
      'cso_band_current', COALESCE(v_cso_current.cso_band, 'sem_dados'),
      'orphan_sessions_in_period', v_orphan_sessions
    ),
    'dimensions_current', jsonb_build_object(
      'sas', v_cso_current.sas,
      'pis', v_cso_current.pis,
      'bss', v_cso_current.bss,
      'tcm', v_cso_current.tcm
    ),
    'protocols', v_protocols,
    'sessions', v_sessions,
    'legal_footer', 'Relatorio estruturado conforme diretrizes SBNI (Outubro 2025) e literatura baseada em evidencia. Fundamentacao: RN 469/2021, RN 541/2022, RN 539/2022.',
    'references', jsonb_build_object(
      'fpg', 'Frank Porter Graham Child Development Institute (FPG/UNC Chapel Hill, 2020) - 28 Praticas Baseadas em Evidencia',
      'sbni', 'Sociedade Brasileira de Neurociencia e Comportamento Infantil (SBNI, Outubro 2025)',
      'bacb', 'BACB Ethics Code (2020)',
      'rbt', 'RBT Ethics Code 2.0 (2021)'
    )
  );

  RETURN v_result;
END;
$$;

COMMIT;
