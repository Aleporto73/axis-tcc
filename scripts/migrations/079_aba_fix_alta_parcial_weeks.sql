-- 079_aba_fix_alta_parcial_weeks.sql
-- FG-5 (PLANO_CORRECAO_ABA_V9): check_alta_parcial contava semanas via INNER JOIN
-- em session_snapshots, entao "weeks_with_data" media semanas COM snapshot/CSO, nao
-- semanas reais com sessao completed. Um aprendiz com 8+ semanas de atendimento mas
-- parte sem snapshot recebia "menos de 8 semanas de sessoes registradas", o que e
-- factualmente errado: falta CSO/snapshot, nao semana.
--
-- Correcao (sem backfill, sem tocar dado/schema):
--   1. v_weeks_with_sessions = semanas com sessao completed.
--   2. v_orphan_sessions = sessoes completed sem snapshot no periodo.
--   3. Recomendacao distingue "sem CSO/snapshot" de "menos de 8 semanas".
--   4. criteria_met INALTERADO: continua exigindo weeks_with_data >= 8.
--   5. details ganha weeks_with_sessions e orphan_sessions; campos antigos preservados.
--   6. Assinatura identica (uuid, uuid) RETURNS jsonb.

BEGIN;

CREATE OR REPLACE FUNCTION public.check_alta_parcial(p_learner_id uuid, p_tenant_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_total_protos        INTEGER;
  v_maintained          INTEGER;
  v_maintained_pct      NUMERIC;
  v_recent_regress      INTEGER;
  v_weeks_above_85      INTEGER;
  v_weeks_with_data     INTEGER;
  v_weeks_with_sessions INTEGER;
  v_orphan_sessions     INTEGER;
  v_criteria_met        BOOLEAN;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('maintained', 'archived'))
  INTO v_total_protos, v_maintained
  FROM learner_protocols
  WHERE learner_id = p_learner_id AND tenant_id = p_tenant_id
    AND status NOT IN ('draft', 'discontinued');

  IF v_total_protos > 0 THEN
    v_maintained_pct := ROUND((v_maintained::NUMERIC / v_total_protos) * 100, 1);
  ELSE
    v_maintained_pct := 0;
  END IF;

  SELECT COUNT(*) INTO v_recent_regress
  FROM axis_audit_logs
  WHERE entity_type = 'learner_protocols'
    AND action = 'REGRESSION_DETECTED_AUTO'
    AND created_at >= NOW() - INTERVAL '60 days'
    AND (metadata->>'learner_id') = p_learner_id::TEXT
    AND (metadata->>'tenant_id') = p_tenant_id::TEXT;

  v_recent_regress := v_recent_regress + (
    SELECT COUNT(*)
    FROM axis_audit_logs aal
    WHERE aal.entity_type = 'maintenance_probes'
      AND aal.action = 'MAINTENANCE_PROBE_EVALUATED'
      AND aal.created_at >= NOW() - INTERVAL '60 days'
      AND (aal.metadata->>'result') = 'failed'
      AND (aal.metadata->>'protocol_id')::UUID IN (
        SELECT id FROM learner_protocols
        WHERE learner_id = p_learner_id AND tenant_id = p_tenant_id
      )
  );

  -- Semanas com SNAPSHOT/CSO, usadas no criterio de elegibilidade.
  SELECT
    COUNT(*) FILTER (WHERE week_cso_avg > 85),
    COUNT(*)
  INTO v_weeks_above_85, v_weeks_with_data
  FROM (
    SELECT DATE_TRUNC('week', sa.ended_at) AS week_start, AVG(ss.cso_aba) AS week_cso_avg
    FROM session_snapshots ss
    JOIN sessions_aba sa
      ON sa.id = ss.session_id
     AND sa.tenant_id = ss.tenant_id
    WHERE sa.learner_id = p_learner_id
      AND sa.tenant_id = p_tenant_id
      AND sa.status = 'completed'
      AND sa.ended_at IS NOT NULL
      AND sa.ended_at >= NOW() - INTERVAL '8 weeks'
    GROUP BY DATE_TRUNC('week', sa.ended_at)
  ) weekly;

  -- Semanas com SESSAO completed, independentes de snapshot.
  SELECT COUNT(DISTINCT DATE_TRUNC('week', sa.ended_at))
  INTO v_weeks_with_sessions
  FROM sessions_aba sa
  WHERE sa.learner_id = p_learner_id
    AND sa.tenant_id = p_tenant_id
    AND sa.status = 'completed'
    AND sa.ended_at IS NOT NULL
    AND sa.ended_at >= NOW() - INTERVAL '8 weeks';

  -- Sessoes completed SEM snapshot no periodo.
  SELECT COUNT(*)
  INTO v_orphan_sessions
  FROM sessions_aba sa
  LEFT JOIN session_snapshots ss
    ON ss.session_id = sa.id
   AND ss.tenant_id = sa.tenant_id
  WHERE sa.learner_id = p_learner_id
    AND sa.tenant_id = p_tenant_id
    AND sa.status = 'completed'
    AND sa.ended_at IS NOT NULL
    AND sa.ended_at >= NOW() - INTERVAL '8 weeks'
    AND ss.id IS NULL;

  v_criteria_met :=
    v_maintained_pct >= 70
    AND v_recent_regress = 0
    AND v_weeks_above_85 >= 8
    AND v_weeks_with_data >= 8;

  RETURN jsonb_build_object(
    'learner_id', p_learner_id,
    'criteria_met', v_criteria_met,
    'recommendation', CASE
      WHEN v_criteria_met THEN 'Aprendiz atende os criterios de alta parcial. Recomenda-se avaliacao pelo supervisor clinico.'
      WHEN v_orphan_sessions > 0 THEN 'Nao e possivel avaliar alta parcial: ha sessoes concluidas sem CSO/snapshot no periodo. Ha atendimento registrado, mas falta o dado clinico do motor; nao e falta de semanas de atendimento.'
      WHEN v_weeks_with_sessions < 8 THEN 'Dados insuficientes - menos de 8 semanas de sessoes registradas. Aguardar mais dados.'
      ELSE 'Aprendiz NAO atende todos os criterios de alta parcial.'
    END,
    'details', jsonb_build_object(
      'maintained_pct', v_maintained_pct, 'maintained_threshold', 70, 'maintained_met', v_maintained_pct >= 70,
      'recent_regressions_60d', v_recent_regress, 'regressions_threshold', 0, 'regressions_met', v_recent_regress = 0,
      'weeks_cso_above_85', v_weeks_above_85, 'weeks_with_data', v_weeks_with_data,
      'weeks_with_sessions', v_weeks_with_sessions, 'orphan_sessions', v_orphan_sessions,
      'weeks_threshold', 8, 'weeks_met', v_weeks_above_85 >= 8 AND v_weeks_with_data >= 8
    ),
    'note', 'Sugestao do motor AXIS ABA. Decisao final e SEMPRE do supervisor clinico (Bible v2.6.1 Principio 1).',
    'generated_at', NOW()
  );
END;
$$;

COMMIT;
