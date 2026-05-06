-- =====================================================
-- 000_shared_baseline.sql
-- AXIS - Baseline schema (HUB-09 fechado - Onda 10)
--
-- Snapshot do schema de producao em 05/05/2026.
-- Gerado via: pg_dump --schema-only --no-owner --no-acl
--             --no-tablespaces --no-publications --no-subscriptions
--             --no-security-labels (Postgres 16.11)
-- SHA do raw original: c5ae51b8add38d399c40f4e59cf9dc395ebee13f7dbcfcf402e014f299c2761b
--
-- Conteudo: 97 tabelas, 63 policies, 62 RLS enabled, 48 RLS forced,
-- 78 functions explicitas, 14 types/enums, 1 extension (pgcrypto).
-- Migrations 067 (tenants.status) e 068 (events RLS) absorvidas.
--
-- Migrations 001-066 movidas para scripts/migrations/legacy/
-- (ja aplicadas em prod antes desta baseline; baseline as substitui).
--
-- Bootstrap (prod): rodar 'bash scripts/migrate.sh --bootstrap'
-- registra 000_shared_baseline em _migrations sem re-aplicar (idempotente).
--
-- Aplicacao fresh (dev/CI): 'psql ... < 000_shared_baseline.sql'
-- aplica todo o schema atomicamente (BEGIN/COMMIT wrapping).
--
-- Reversao: drop completo do schema public (nao ha rollback parcial).
-- =====================================================

BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.11 (Debian 16.11-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: aba_behavior_intensity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.aba_behavior_intensity AS ENUM (
    'leve',
    'moderada',
    'alta',
    'severa'
);


--
-- Name: TYPE aba_behavior_intensity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.aba_behavior_intensity IS 'Níveis de intensidade para eventos comportamentais ABC';


--
-- Name: aba_consent_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.aba_consent_type AS ENUM (
    'portal_access',
    'email_summary'
);


--
-- Name: aba_generalization_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.aba_generalization_status AS ENUM (
    'pending',
    'partial',
    'validated'
);


--
-- Name: aba_product_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.aba_product_type AS ENUM (
    'tcc',
    'aba',
    'tdah'
);


--
-- Name: aba_prompt_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.aba_prompt_level AS ENUM (
    'independent',
    'gestural',
    'verbal',
    'modeling',
    'partial_physical',
    'full_physical'
);


--
-- Name: TYPE aba_prompt_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.aba_prompt_level IS 'Níveis de prompt hierárquicos para DTT — de full_physical (mais suporte) a independent (sem suporte)';


--
-- Name: aba_protocol_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.aba_protocol_status AS ENUM (
    'draft',
    'active',
    'mastered',
    'generalization',
    'mastered_validated',
    'maintenance',
    'maintained',
    'regression',
    'suspended',
    'discontinued',
    'archived'
);


--
-- Name: aba_regression_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.aba_regression_type AS ENUM (
    'acquisition',
    'maintenance',
    'contextual'
);


--
-- Name: aba_report_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.aba_report_type AS ENUM (
    'convenio',
    'sessao',
    'longitudinal'
);


--
-- Name: aba_session_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.aba_session_status AS ENUM (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
);


--
-- Name: audhd_layer_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audhd_layer_status_enum AS ENUM (
    'off',
    'active_core',
    'active_full'
);


--
-- Name: tdah_confidence_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tdah_confidence_enum AS ENUM (
    'low',
    'medium',
    'high'
);


--
-- Name: tdah_final_band_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tdah_final_band_enum AS ENUM (
    'sem_dados',
    'critico',
    'atencao',
    'bom',
    'excelente'
);


--
-- Name: tdah_session_context_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tdah_session_context_enum AS ENUM (
    'clinical',
    'home',
    'school'
);


--
-- Name: tdah_snapshot_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tdah_snapshot_type_enum AS ENUM (
    'session_close',
    'clinical_review',
    'monitoring_cycle',
    'manual_override'
);


--
-- Name: app_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_tenant_id() RETURNS uuid
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_tid TEXT;
BEGIN
  v_tid := current_setting('app.tenant_id', true);

  IF v_tid IS NULL OR v_tid = '' THEN
    RAISE EXCEPTION '[AXIS RLS] app.tenant_id não definido na sessão. Middleware não injetou o tenant.';
  END IF;

  RETURN v_tid::UUID;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION '[AXIS RLS] app.tenant_id inválido: "%". Deve ser UUID.', v_tid;
END;
$$;


--
-- Name: app_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_user_id() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN COALESCE(current_setting('app.user_id', true), 'system');
END;
$$;


--
-- Name: app_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_user_role() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := current_setting('app.user_role', true);

  IF v_role IS NULL OR v_role = '' THEN
    RETURN 'system';
  END IF;

  IF v_role NOT IN ('therapist', 'supervisor', 'guardian', 'admin', 'system') THEN
    RAISE EXCEPTION '[AXIS RLS] app.user_role inválido: "%".', v_role;
  END IF;

  RETURN v_role;
END;
$$;


--
-- Name: approve_session_summary(uuid, uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_session_summary(p_summary_id uuid, p_tenant_id uuid, p_approved_by character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE v_summary RECORD;
BEGIN
  SELECT id, session_id, status INTO v_summary FROM session_summaries
  WHERE id = p_summary_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN RAISE EXCEPTION '[AXIS ABA] Resumo % não encontrado neste tenant.', p_summary_id; END IF;
  IF v_summary.status != 'pending' THEN RAISE EXCEPTION '[AXIS ABA] Resumo % não está pendente (%).', p_summary_id, v_summary.status; END IF;

  UPDATE session_summaries SET status = 'approved', approved_by = p_approved_by, approved_at = NOW(), updated_at = NOW()
  WHERE id = p_summary_id AND tenant_id = p_tenant_id;

  INSERT INTO axis_audit_logs (action, entity_type, entity_type, metadata, created_at)
  VALUES ('SUMMARY_APPROVED', 'session_summaries', p_summary_id, p_approved_by,
    jsonb_build_object('session_id', v_summary.session_id, 'tenant_id', p_tenant_id), NOW());
END;
$$;


--
-- Name: axis_canonicalize_jsonb(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.axis_canonicalize_jsonb(p_json jsonb) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  v_type     TEXT := jsonb_typeof(p_json);
  v_elements TEXT[];
BEGIN
  IF v_type = 'object' THEN
    SELECT COALESCE(
      array_agg(to_jsonb(key)::TEXT || ':' || axis_canonicalize_jsonb(value)),
      ARRAY[]::TEXT[]
    )
    INTO v_elements
    FROM (
      SELECT key, value
      FROM jsonb_each(p_json)
      ORDER BY key
    ) t;
    RETURN '{' || array_to_string(v_elements, ',') || '}';
  ELSIF v_type = 'array' THEN
    SELECT COALESCE(
      array_agg(axis_canonicalize_jsonb(value)),
      ARRAY[]::TEXT[]
    )
    INTO v_elements
    FROM jsonb_array_elements(p_json) AS value;
    RETURN '[' || array_to_string(v_elements, ',') || ']';
  ELSE
    RETURN p_json::TEXT;
  END IF;
END;
$$;


--
-- Name: calculate_cso_aba(numeric, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_cso_aba(p_sas numeric, p_pis numeric, p_bss numeric, p_tcm numeric) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  v_cso NUMERIC;
BEGIN
  IF p_sas < 0 OR p_sas > 100 OR
     p_pis < 0 OR p_pis > 100 OR
     p_bss < 0 OR p_bss > 100 OR
     p_tcm < 0 OR p_tcm > 100
  THEN
    RAISE EXCEPTION
      '[AXIS ABA] Dimensões fora do range 0-100. SAS=%, PIS=%, BSS=%, TCM=%',
      p_sas, p_pis, p_bss, p_tcm;
  END IF;

  -- Fórmula imutável — Bible v2.6.1 §2.1
  v_cso := ROUND(
    (0.25 * p_sas) +
    (0.25 * p_pis) +
    (0.25 * p_bss) +
    (0.25 * p_tcm),
    2
  );

  RETURN GREATEST(0, LEAST(100, v_cso));
END;
$$;


--
-- Name: check_alta_parcial(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_alta_parcial(p_learner_id uuid, p_tenant_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_total_protos    INTEGER;
  v_maintained      INTEGER;
  v_maintained_pct  NUMERIC;
  v_recent_regress  INTEGER;
  v_weeks_above_85  INTEGER;
  v_weeks_with_data INTEGER;
  v_criteria_met    BOOLEAN;
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

  SELECT
    COUNT(*) FILTER (WHERE week_cso_avg > 85),
    COUNT(*)
  INTO v_weeks_above_85, v_weeks_with_data
  FROM (
    SELECT DATE_TRUNC('week', sa.ended_at) AS week_start, AVG(ss.cso_aba) AS week_cso_avg
    FROM session_snapshots ss
    JOIN sessions_aba sa ON sa.id = ss.session_id
    WHERE sa.learner_id = p_learner_id AND sa.tenant_id = p_tenant_id
      AND sa.ended_at >= NOW() - INTERVAL '8 weeks'
    GROUP BY DATE_TRUNC('week', sa.ended_at)
  ) weekly;

  v_criteria_met :=
    v_maintained_pct >= 70
    AND v_recent_regress = 0
    AND v_weeks_above_85 >= 8
    AND v_weeks_with_data >= 8;

  RETURN jsonb_build_object(
    'learner_id', p_learner_id,
    'criteria_met', v_criteria_met,
    'recommendation', CASE
      WHEN v_criteria_met THEN 'Aprendiz atende os critérios de alta parcial. Recomenda-se avaliação pelo supervisor clínico.'
      WHEN v_weeks_with_data < 8 THEN 'Dados insuficientes — menos de 8 semanas de sessões registradas. Aguardar mais dados.'
      ELSE 'Aprendiz NÃO atende todos os critérios de alta parcial.'
    END,
    'details', jsonb_build_object(
      'maintained_pct', v_maintained_pct, 'maintained_threshold', 70, 'maintained_met', v_maintained_pct >= 70,
      'recent_regressions_60d', v_recent_regress, 'regressions_threshold', 0, 'regressions_met', v_recent_regress = 0,
      'weeks_cso_above_85', v_weeks_above_85, 'weeks_with_data', v_weeks_with_data,
      'weeks_threshold', 8, 'weeks_met', v_weeks_above_85 >= 8 AND v_weeks_with_data >= 8
    ),
    'note', 'Sugestão do motor AXIS ABA. Decisão final é SEMPRE do supervisor clínico (Bible v2.6.1 Princípio 1).',
    'generated_at', NOW()
  );
END;
$$;


--
-- Name: check_consent(uuid, uuid, public.aba_consent_type, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_consent(p_guardian_id uuid, p_learner_id uuid, p_consent_type public.aba_consent_type, p_tenant_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM guardian_consents
    WHERE guardian_id = p_guardian_id AND learner_id = p_learner_id
      AND consent_type = p_consent_type AND revoked_at IS NULL
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  );
END;
$$;


--
-- Name: check_suspended_protocols_aba(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_suspended_protocols_aba() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE v_count INTEGER;
BEGIN
  INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
  SELECT tenant_id, COALESCE(created_by,'system'), 'system',
    'PROTOCOL_SUSPENDED_OVERDUE', 'learner_protocols',
    jsonb_build_object('protocol_id', id, 'suspended_at', suspended_at, 'days_suspended', EXTRACT(DAY FROM NOW()-suspended_at)::INTEGER, 'learner_id', learner_id, 'tenant_id', tenant_id), NOW()
  FROM learner_protocols WHERE status = 'suspended' AND suspended_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;


--
-- Name: close_session_aba(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_session_aba(p_session_id uuid, p_closed_by character varying) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_session       RECORD;
  v_cso_data      RECORD;
  v_engine_ver    VARCHAR;
  v_snapshot_json JSONB;
  v_existing_cso  NUMERIC;
BEGIN
  -- 0. Idempotência
  SELECT ss.cso_aba INTO v_existing_cso
  FROM session_snapshots ss WHERE ss.session_id = p_session_id;
  IF v_existing_cso IS NOT NULL THEN RETURN v_existing_cso; END IF;

  -- 1. Buscar sessão
  SELECT id, tenant_id, learner_id, status, therapist_id, supervisor_id, started_at
  INTO v_session FROM sessions_aba WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Sessão % não encontrada.', p_session_id;
  END IF;
  IF v_session.status != 'in_progress' THEN
    RAISE EXCEPTION '[AXIS ABA] Sessão % não está in_progress (status: %).', p_session_id, v_session.status;
  END IF;
  IF v_session.started_at IS NULL THEN
    RAISE EXCEPTION '[AXIS ABA] Sessão % sem started_at.', p_session_id;
  END IF;

  -- 2. Engine version
  SELECT version INTO v_engine_ver FROM engine_versions WHERE is_current = TRUE;
  IF v_engine_ver IS NULL THEN
    RAISE EXCEPTION '[AXIS ABA] Nenhuma engine_version ativa.';
  END IF;

  -- 3. Fechar sessão
  UPDATE sessions_aba SET status = 'completed', ended_at = NOW(), updated_at = NOW()
  WHERE id = p_session_id;

  -- 4. CSO-ABA
  SELECT * INTO v_cso_data FROM compute_full_cso(p_session_id, v_session.learner_id, v_session.tenant_id);

  -- 5. Snapshot JSON
  SELECT jsonb_build_object(
    'session_id', p_session_id, 'learner_id', v_session.learner_id,
    'tenant_id', v_session.tenant_id, 'closed_at', NOW(), 'closed_by', p_closed_by,
    'engine_version', v_engine_ver,
    'dimensions', jsonb_build_object('sas', v_cso_data.sas, 'pis', v_cso_data.pis, 'bss', v_cso_data.bss, 'tcm', v_cso_data.tcm),
    'cso_aba', v_cso_data.cso_aba, 'cso_band', v_cso_data.cso_band,
    'targets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'target_name', st.target_name, 'trials_total', st.trials_total,
        'trials_correct', st.trials_correct, 'score_pct', st.score_pct, 'prompt_level', st.prompt_level
      )) FROM session_targets st JOIN sessions_aba sa ON sa.id = st.session_id
      WHERE st.session_id = p_session_id AND sa.tenant_id = v_session.tenant_id
    ), '[]'::jsonb),
    'behaviors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'behavior_type', sb.behavior_type, 'antecedent', sb.antecedent,
        'behavior', sb.behavior, 'consequence', sb.consequence, 'intensity', sb.intensity
      )) FROM session_behaviors sb JOIN sessions_aba sa ON sa.id = sb.session_id
      WHERE sb.session_id = p_session_id AND sa.tenant_id = v_session.tenant_id
    ), '[]'::jsonb)
  ) INTO v_snapshot_json;

  -- 6. Snapshot imutável
  INSERT INTO session_snapshots (
    session_id, learner_id, tenant_id, snapshot_json,
    sas, pis, bss, tcm, cso_aba, engine_version, closed_by
  ) VALUES (
    p_session_id, v_session.learner_id, v_session.tenant_id, v_snapshot_json,
    v_cso_data.sas, v_cso_data.pis, v_cso_data.bss, v_cso_data.tcm, v_cso_data.cso_aba,
    v_engine_ver, p_closed_by
  );

  -- 7. Clinical state
  INSERT INTO clinical_states_aba (
    tenant_id, learner_id, session_id,
    sas, pis, bss, tcm, cso_aba, cso_band,
    engine_version, calculated_by
  ) VALUES (
    v_session.tenant_id, v_session.learner_id, p_session_id,
    v_cso_data.sas, v_cso_data.pis, v_cso_data.bss, v_cso_data.tcm,
    v_cso_data.cso_aba, v_cso_data.cso_band,
    v_engine_ver, p_closed_by
  ) ON CONFLICT (session_id) WHERE session_id IS NOT NULL DO NOTHING;

  -- 8. Audit (colunas corretas)
  INSERT INTO axis_audit_logs (
    tenant_id, user_id, actor, action, entity_type, metadata, created_at
  ) VALUES (
    v_session.tenant_id, p_closed_by, 'system',
    'SESSION_ABA_CLOSED_WITH_CSO', 'sessions_aba',
    jsonb_build_object(
      'session_id', p_session_id, 'learner_id', v_session.learner_id,
      'cso_aba', v_cso_data.cso_aba, 'cso_band', v_cso_data.cso_band,
      'sas', v_cso_data.sas, 'pis', v_cso_data.pis,
      'bss', v_cso_data.bss, 'tcm', v_cso_data.tcm,
      'engine_version', v_engine_ver
    ),
    NOW()
  );

  RETURN v_cso_data.cso_aba;
END;
$$;


--
-- Name: compute_bss(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_bss(p_session_id uuid, p_learner_id uuid, p_tenant_id uuid) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_current_intensity  NUMERIC := 0;
  v_previous_intensity NUMERIC;
  v_prev_session_id    UUID;
  v_trend_factor       NUMERIC := 1.0;
  v_bss                NUMERIC;
  v_behavior_count     INTEGER := 0;
  v_session_time       TIMESTAMPTZ;
BEGIN
  -- 1. Intensidade média da sessão atual (com filtro tenant)
  SELECT
    COALESCE(AVG(intensity_to_scale(sb.intensity)), 0),
    COUNT(*)
  INTO v_current_intensity, v_behavior_count
  FROM session_behaviors sb
  JOIN sessions_aba sa ON sa.id = sb.session_id
  WHERE sb.session_id = p_session_id
    AND sa.tenant_id = p_tenant_id;

  -- Se não há comportamentos registrados, BSS = 100 (estável)
  IF v_behavior_count = 0 THEN
    RETURN 100.00;
  END IF;

  -- 2. [FIX-3] Timestamp da sessão atual (com fallback)
  SELECT COALESCE(started_at, scheduled_at)
  INTO v_session_time
  FROM sessions_aba
  WHERE id = p_session_id;

  -- 3. [FIX-2] Buscar ID da sessão anterior COMPLETADA (subquery correta)
  SELECT sa.id
  INTO v_prev_session_id
  FROM sessions_aba sa
  WHERE sa.learner_id = p_learner_id
    AND sa.tenant_id = p_tenant_id
    AND sa.status = 'completed'
    AND sa.id != p_session_id
    AND COALESCE(sa.ended_at, sa.scheduled_at) < v_session_time
  ORDER BY COALESCE(sa.ended_at, sa.scheduled_at) DESC
  LIMIT 1;

  -- 4. Intensidade média da sessão anterior (se existir)
  IF v_prev_session_id IS NOT NULL THEN
    SELECT AVG(intensity_to_scale(sb.intensity))
    INTO v_previous_intensity
    FROM session_behaviors sb
    WHERE sb.session_id = v_prev_session_id;
  END IF;

  -- 5. Trend factor
  IF v_previous_intensity IS NULL THEN
    v_trend_factor := 1.0;  -- sem histórico
  ELSIF v_current_intensity < v_previous_intensity - 0.05 THEN
    v_trend_factor := 1.1;  -- melhorou (intensidade diminuiu)
  ELSIF v_current_intensity > v_previous_intensity + 0.05 THEN
    v_trend_factor := 0.9;  -- piorou (intensidade aumentou)
  ELSE
    v_trend_factor := 1.0;  -- estável
  END IF;

  -- 6. Fórmula Bible §2.5
  v_bss := 100 * (1 - v_current_intensity) * v_trend_factor;

  RETURN GREATEST(0, LEAST(100, ROUND(v_bss, 2)));
END;
$$;


--
-- Name: compute_full_cso(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_full_cso(p_session_id uuid, p_learner_id uuid, p_tenant_id uuid) RETURNS TABLE(sas numeric, pis numeric, bss numeric, tcm numeric, cso_aba numeric, cso_band character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_sas     NUMERIC;
  v_pis     NUMERIC;
  v_bss     NUMERIC;
  v_tcm     NUMERIC;
  v_cso     NUMERIC;
  v_band    VARCHAR;
BEGIN
  -- Calcular cada dimensão
  v_sas := compute_sas(p_session_id, p_learner_id, p_tenant_id);
  v_pis := compute_pis(p_session_id, p_tenant_id);
  v_bss := compute_bss(p_session_id, p_learner_id, p_tenant_id);
  v_tcm := compute_tcm(p_learner_id, p_tenant_id, v_sas);

  -- CSO-ABA (fórmula congelada — Bible §2.1)
  v_cso := calculate_cso_aba(v_sas, v_pis, v_bss, v_tcm);

  -- Banda interpretativa
  v_band := cso_aba_band(v_cso);

  RETURN QUERY SELECT v_sas, v_pis, v_bss, v_tcm, v_cso, v_band;
END;
$$;


--
-- Name: compute_mastery_score(public.aba_protocol_status, public.aba_generalization_status); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_mastery_score(p_protocol_status public.aba_protocol_status, p_gen_status public.aba_generalization_status) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  IF p_protocol_status IN ('maintained', 'archived') THEN
    RETURN 100;
  ELSIF p_protocol_status IN ('mastered', 'generalization', 'maintenance')
    AND p_gen_status = 'validated' THEN
    RETURN 85;
  ELSIF p_protocol_status IN ('mastered', 'generalization', 'maintenance') THEN
    RETURN 75;
  ELSE
    RETURN 0;
  END IF;
END;
$$;


--
-- Name: compute_pis(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_pis(p_session_id uuid, p_tenant_id uuid) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_pis NUMERIC;
BEGIN
  SELECT COALESCE(AVG(prompt_to_scale(st.prompt_level)) * 100, 50)
  INTO v_pis
  FROM session_targets st
  JOIN sessions_aba sa ON sa.id = st.session_id
  WHERE st.session_id = p_session_id
    AND sa.tenant_id = p_tenant_id;

  RETURN GREATEST(0, LEAST(100, ROUND(v_pis, 2)));
END;
$$;


--
-- Name: compute_sas(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_sas(p_session_id uuid, p_learner_id uuid, p_tenant_id uuid) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_sas_ativos     NUMERIC := 0;
  v_total_trials   INTEGER := 0;
  v_weighted_sum   NUMERIC := 0;
  v_total_protos   INTEGER := 0;
  v_mastered_protos INTEGER := 0;
  v_mastery_rate   NUMERIC := 0;
  v_avg_mastery    NUMERIC := 0;
  v_sas            NUMERIC;
BEGIN
  -- 1. SAS_ativos: média ponderada dos trials da sessão
  --    Bible §2.3: SAS_ativos = Sum(score_alvo × trials_alvo) / Sum(trials_alvo)
  --    score_alvo = (trials_correct / trials_total) * 100
  --    Ponderação por trials_total → Sum(trials_correct * 100) / Sum(trials_total)
  SELECT
    COALESCE(SUM(trials_correct * 100), 0),
    COALESCE(SUM(trials_total), 0)
  INTO v_weighted_sum, v_total_trials
  FROM session_targets st
  JOIN sessions_aba sa ON sa.id = st.session_id
  WHERE st.session_id = p_session_id
    AND sa.tenant_id = p_tenant_id;

  IF v_total_trials > 0 THEN
    v_sas_ativos := v_weighted_sum::NUMERIC / v_total_trials;
  END IF;

  -- 2. Mastery rate: proporção de protocolos que atingiram domínio
  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE status IN ('mastered', 'generalization', 'maintenance', 'maintained', 'archived')
    )
  INTO v_total_protos, v_mastered_protos
  FROM learner_protocols
  WHERE learner_id = p_learner_id
    AND tenant_id = p_tenant_id
    AND status NOT IN ('draft', 'discontinued');

  IF v_total_protos > 0 THEN
    v_mastery_rate := v_mastered_protos::NUMERIC / v_total_protos;
  END IF;

  -- 3. Mastery score médio dos protocolos que atingiram domínio
  IF v_mastered_protos > 0 THEN
    SELECT COALESCE(AVG(compute_mastery_score(status, generalization_status)), 0)
    INTO v_avg_mastery
    FROM learner_protocols
    WHERE learner_id = p_learner_id
      AND tenant_id = p_tenant_id
      AND status IN ('mastered', 'generalization', 'maintenance', 'maintained', 'archived');
  END IF;

  -- 4. Fórmula final Bible §2.3
  v_sas := v_sas_ativos * (1 - v_mastery_rate) + v_avg_mastery * v_mastery_rate;

  RETURN GREATEST(0, LEAST(100, ROUND(v_sas, 2)));
END;
$$;


--
-- Name: compute_tcm(uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_tcm(p_learner_id uuid, p_tenant_id uuid, p_current_sas numeric) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_scores    NUMERIC[];
  v_count     INTEGER;
  v_mean      NUMERIC;
  v_stddev    NUMERIC;
  v_cv        NUMERIC;
  v_tcm       NUMERIC;
BEGIN
  -- Pegar SAS das últimas 4 sessões completadas (+ a atual = 5)
  SELECT ARRAY_AGG(cs.sas ORDER BY cs.created_at DESC)
  INTO v_scores
  FROM (
    SELECT sas, created_at
    FROM clinical_states_aba
    WHERE learner_id = p_learner_id
      AND tenant_id = p_tenant_id
    ORDER BY created_at DESC
    LIMIT 4
  ) cs;

  -- Adicionar SAS atual
  IF v_scores IS NULL THEN
    v_scores := ARRAY[p_current_sas];
  ELSE
    v_scores := v_scores || p_current_sas;
  END IF;

  v_count := array_length(v_scores, 1);

  -- Bible §2.6: Se < 2 sessões, TCM = 75 (neutro)
  IF v_count < 2 THEN
    RETURN 75.00;
  END IF;

  -- Calcular média
  SELECT AVG(x) INTO v_mean FROM unnest(v_scores) AS x;

  -- Se média = 0, evitar divisão por zero
  IF v_mean = 0 THEN
    RETURN 75.00;
  END IF;

  -- Calcular desvio padrão amostral
  SELECT STDDEV_SAMP(x) INTO v_stddev FROM unnest(v_scores) AS x;

  -- CV = desvio_padrão / média
  v_cv := v_stddev / v_mean;

  -- TCM = 100 × (1 - CV)
  v_tcm := 100 * (1 - v_cv);

  RETURN GREATEST(0, LEAST(100, ROUND(v_tcm, 2)));
END;
$$;


--
-- Name: compute_workload_justification(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_workload_justification(p_learner_id uuid, p_tenant_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_learner          RECORD;
  v_cso_current      NUMERIC;
  v_cso_band         VARCHAR;
  v_cso_prev         NUMERIC;
  v_evolution_rate   NUMERIC := 0;
  v_regression_count INTEGER := 0;
  v_active_protos    INTEGER := 0;
  v_mastered_protos  INTEGER := 0;
  v_total_protos     INTEGER := 0;
  v_mastery_rate     NUMERIC := 0;
  v_carga_sugerida   NUMERIC;
  v_justificativa    TEXT;
  v_acao             TEXT;
BEGIN
  -- 1. Dados do aprendiz
  SELECT id, name, support_level
  INTO v_learner
  FROM learners
  WHERE id = p_learner_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Aprendiz % não encontrado.', p_learner_id;
  END IF;

  -- 2. CSO atual (via snapshot — fonte única)
  SELECT ss.cso_aba, cso_aba_band(ss.cso_aba)
  INTO v_cso_current, v_cso_band
  FROM session_snapshots ss
  JOIN sessions_aba sa ON sa.id = ss.session_id
  WHERE sa.learner_id = p_learner_id AND sa.tenant_id = p_tenant_id
  ORDER BY sa.ended_at DESC LIMIT 1;

  IF v_cso_current IS NULL THEN
    v_cso_current := 50;
    v_cso_band := 'atencao';
  END IF;

  -- 3. CSO de 30 dias atrás (taxa evolução)
  SELECT ss.cso_aba
  INTO v_cso_prev
  FROM session_snapshots ss
  JOIN sessions_aba sa ON sa.id = ss.session_id
  WHERE sa.learner_id = p_learner_id AND sa.tenant_id = p_tenant_id
    AND sa.ended_at <= NOW() - INTERVAL '30 days'
  ORDER BY sa.ended_at DESC LIMIT 1;

  IF v_cso_prev IS NOT NULL AND v_cso_prev > 0 THEN
    v_evolution_rate := ROUND(((v_cso_current - v_cso_prev) / v_cso_prev) * 100, 1);
  END IF;

  -- 4. Contagem de protocolos e regressões
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE status IN ('mastered','generalization','maintenance','maintained','archived')),
    COALESCE(SUM(regression_count), 0)
  INTO v_total_protos, v_active_protos, v_mastered_protos, v_regression_count
  FROM learner_protocols
  WHERE learner_id = p_learner_id
    AND tenant_id = p_tenant_id
    AND status NOT IN ('draft', 'discontinued');

  IF v_total_protos > 0 THEN
    v_mastery_rate := ROUND((v_mastered_protos::NUMERIC / v_total_protos) * 100, 1);
  END IF;

  -- 5. Carga sugerida (horas/semana)
  --    Base: Nível 3 = 20h, Nível 2 = 15h, Nível 1 = 10h
  v_carga_sugerida := CASE v_learner.support_level
    WHEN 3 THEN 20  WHEN 2 THEN 15  WHEN 1 THEN 10  ELSE 15
  END;

  IF v_cso_current < 50 THEN
    v_carga_sugerida := v_carga_sugerida + 2;
  END IF;
  IF v_regression_count >= 2 THEN
    v_carga_sugerida := v_carga_sugerida + 1;
  END IF;
  IF v_cso_current >= 85 AND v_mastery_rate >= 70 THEN
    v_carga_sugerida := v_carga_sugerida - 2;
  END IF;

  v_carga_sugerida := GREATEST(5, LEAST(40, v_carga_sugerida));

  -- 6. Justificativa (Bible §10.2)
  IF v_evolution_rate > 10 THEN
    v_acao := 'manter carga horária atual para consolidar ganhos';
  ELSIF v_evolution_rate < -5 THEN
    v_acao := 'aumentar frequência de sessões para reverter tendência de queda';
  ELSIF v_cso_current < 50 THEN
    v_acao := 'intensificar intervenção devido ao estado clínico crítico';
  ELSIF v_mastery_rate >= 70 AND v_cso_current >= 85 THEN
    v_acao := 'considerar redução gradual conforme critérios de alta parcial';
  ELSE
    v_acao := 'manter carga horária para progressão contínua';
  END IF;

  v_justificativa := format(
    'Com base na evolução (%s%%), estabilidade (CSO-ABA: %s — %s) e regressão (%s ocorrências), '
    'recomenda-se %s. '
    'O aprendiz apresenta nível de suporte %s com %s protocolos ativos e taxa de domínio de %s%%. '
    'Carga horária sugerida: %s horas/semana.',
    CASE WHEN v_evolution_rate > 0 THEN '+' ELSE '' END || v_evolution_rate,
    v_cso_current, v_cso_band,
    v_regression_count,
    v_acao,
    v_learner.support_level,
    v_active_protos,
    v_mastery_rate,
    v_carga_sugerida
  );

  RETURN jsonb_build_object(
    'learner_id',       p_learner_id,
    'carga_sugerida_h', v_carga_sugerida,
    'justificativa',    v_justificativa,
    'fatores',          jsonb_build_object(
      'cso_current',       v_cso_current,
      'cso_band',          v_cso_band,
      'cso_previous_30d',  v_cso_prev,
      'evolution_rate_pct', v_evolution_rate,
      'support_level',     v_learner.support_level,
      'active_protocols',  v_active_protos,
      'mastered_protocols', v_mastered_protos,
      'mastery_rate_pct',  v_mastery_rate,
      'regression_count',  v_regression_count
    ),
    'generated_at',     NOW()
  );
END;
$$;


--
-- Name: create_notification_aba(uuid, character varying, character varying, text, text, jsonb, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification_aba(p_tenant_id uuid, p_recipient_id character varying, p_notification_type character varying, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb, p_idempotency_key character varying DEFAULT NULL::character varying) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO notifications (tenant_id, recipient_id, notification_type, title, body, data, status, idempotency_key)
  VALUES (p_tenant_id, p_recipient_id, p_notification_type, p_title, p_body, p_data, 'pending', p_idempotency_key)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: cso_aba_band(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cso_aba_band(p_cso numeric) RETURNS character varying
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  RETURN CASE
    WHEN p_cso >= 85 THEN 'excelente'
    WHEN p_cso >= 70 THEN 'bom'
    WHEN p_cso >= 50 THEN 'atencao'
    ELSE 'critico'
  END;
END;
$$;


--
-- Name: detect_regression(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_regression(p_learner_id uuid, p_tenant_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_protocol   RECORD;
  v_low_count  INTEGER;
  v_total      INTEGER := 0;
BEGIN
  -- Para cada protocolo ativo do aprendiz
  FOR v_protocol IN
    SELECT lp.id, lp.title
    FROM learner_protocols lp
    WHERE lp.learner_id = p_learner_id
      AND lp.tenant_id = p_tenant_id
      AND lp.status = 'active'
  LOOP
    -- Contar últimas 3 sessões com < 60%
    -- [FIX-6] Filtro tenant_id na sessão
    SELECT COUNT(*)
    INTO v_low_count
    FROM (
      SELECT st.score_pct
      FROM session_targets st
      JOIN sessions_aba sa ON sa.id = st.session_id
      WHERE st.protocol_id = v_protocol.id
        AND sa.status = 'completed'
        AND sa.tenant_id = p_tenant_id
      ORDER BY sa.ended_at DESC
      LIMIT 3
    ) recent
    WHERE recent.score_pct < 60;

    -- Bible §6: 3 sessões consecutivas < 60% → regression
    IF v_low_count = 3 THEN
      UPDATE learner_protocols
      SET status = 'regression',
          regression_count = regression_count + 1,
          regression_type = 'acquisition',
          updated_at = NOW()
      WHERE id = v_protocol.id
        AND status = 'active';

      IF FOUND THEN
        v_total := v_total + 1;

        INSERT INTO axis_audit_logs (
          action, entity_type, entity_type, metadata, created_at
        ) VALUES (
          'REGRESSION_DETECTED_AUTO',
          'learner_protocols',
          v_protocol.id,
          'system',
          jsonb_build_object(
            'type',        'acquisition',
            'learner_id',  p_learner_id,
            'tenant_id',   p_tenant_id,
            'trigger',     '3 sessões consecutivas < 60%'
          ),
          NOW()
        );
      END IF;
    END IF;
  END LOOP;

  RETURN v_total;
END;
$$;


--
-- Name: evaluate_generalization(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.evaluate_generalization(p_probe_id uuid, p_score_pct numeric) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_probe  RECORD;
  v_status aba_generalization_status;
BEGIN
  SELECT gp.*, lp.status AS protocol_status
  INTO v_probe
  FROM generalization_probes gp
  JOIN learner_protocols lp ON lp.id = gp.protocol_id
  WHERE gp.id = p_probe_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Sonda de generalização % não encontrada.', p_probe_id;
  END IF;

  -- [FIX-8] Validar que protocolo está em fase de generalização
  IF v_probe.protocol_status != 'generalization' THEN
    RAISE EXCEPTION '[AXIS ABA] Protocolo não está em generalização (status atual: %). Não é possível avaliar sonda 3x2.',
      v_probe.protocol_status;
  END IF;

  -- Determinar status
  IF p_score_pct >= 80 THEN
    v_status := 'validated';
  ELSIF p_score_pct > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'pending';
  END IF;

  -- Atualizar sonda
  UPDATE generalization_probes
  SET score_pct = p_score_pct,
      status = v_status,
      probe_date = CURRENT_DATE
  WHERE id = p_probe_id;

  -- Atualizar generalization_status no protocolo
  UPDATE learner_protocols
  SET generalization_status = v_status,
      generalized_at = CASE WHEN v_status = 'validated' THEN NOW() ELSE generalized_at END,
      updated_at = NOW()
  WHERE id = v_probe.protocol_id;

  -- Audit
  INSERT INTO axis_audit_logs (
    action, entity_type, entity_type, metadata, created_at
  ) VALUES (
    'GENERALIZATION_EVALUATED',
    'generalization_probes',
    p_probe_id,
    v_probe.conducted_by,
    jsonb_build_object(
      'protocol_id',  v_probe.protocol_id,
      'score_pct',    p_score_pct,
      'status',       v_status::TEXT
    ),
    NOW()
  );

  RETURN v_status::TEXT;
END;
$$;


--
-- Name: evaluate_maintenance_probe(uuid, numeric, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.evaluate_maintenance_probe(p_probe_id uuid, p_score_pct numeric, p_conducted_by character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_probe      RECORD;
  v_passed     BOOLEAN;
  v_all_passed BOOLEAN;
  v_done_count INTEGER;
  v_result     VARCHAR;
BEGIN
  SELECT mp.*, lp.status AS protocol_status
  INTO v_probe
  FROM maintenance_probes mp
  JOIN learner_protocols lp ON lp.id = mp.protocol_id
  WHERE mp.id = p_probe_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Sonda % não encontrada.', p_probe_id;
  END IF;

  IF v_probe.completed_at IS NOT NULL THEN
    RAISE EXCEPTION '[AXIS ABA] Sonda % já foi avaliada.', p_probe_id;
  END IF;

  -- Bible §5: critério >= 70%
  v_passed := p_score_pct >= 70;

  -- Atualizar sonda
  UPDATE maintenance_probes
  SET completed_at = CURRENT_DATE,
      score_pct = p_score_pct,
      passed = v_passed,
      regression_triggered = NOT v_passed,
      conducted_by = p_conducted_by
  WHERE id = p_probe_id;

  IF NOT v_passed THEN
    -- Falhou: trigger regressão no protocolo
    UPDATE learner_protocols
    SET status = 'regression',
        regression_count = regression_count + 1,
        regression_type = 'maintenance',
        updated_at = NOW()
    WHERE id = v_probe.protocol_id;

    v_result := 'failed';
  ELSE
    -- Verificar se todas as 3 sondas passaram
    SELECT COUNT(*), bool_and(passed)
    INTO v_done_count, v_all_passed
    FROM maintenance_probes
    WHERE protocol_id = v_probe.protocol_id
      AND completed_at IS NOT NULL;

    IF v_done_count = 3 AND v_all_passed THEN
      -- Bible §5: 3/3 >= 70% → maintained
      UPDATE learner_protocols
      SET status = 'maintained',
          maintained_at = NOW(),
          updated_at = NOW()
      WHERE id = v_probe.protocol_id;

      v_result := 'maintained';
    ELSE
      v_result := 'passed';
    END IF;
  END IF;

  -- Audit
  INSERT INTO axis_audit_logs (
    action, entity_type, entity_type, metadata, created_at
  ) VALUES (
    'MAINTENANCE_PROBE_EVALUATED',
    'maintenance_probes',
    p_probe_id,
    p_conducted_by,
    jsonb_build_object(
      'protocol_id',  v_probe.protocol_id,
      'probe_number', v_probe.probe_number,
      'score_pct',    p_score_pct,
      'passed',       v_passed,
      'result',       v_result
    ),
    NOW()
  );

  RETURN v_result;
END;
$$;


--
-- Name: finalize_convenio_report(uuid, uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_convenio_report(p_convenio_report_id uuid, p_report_snapshot_id uuid, p_finalized_by character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_report   RECORD;
  v_snapshot RECORD;
BEGIN
  -- [FIX-S3-5] FOR UPDATE: lock row
  SELECT id, tenant_id, learner_id, status
  INTO v_report
  FROM convenio_reports
  WHERE id = p_convenio_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Relatório convênio % não encontrado.', p_convenio_report_id;
  END IF;

  IF v_report.status != 'draft' THEN
    RAISE EXCEPTION '[AXIS ABA] Relatório % já foi finalizado (status: %).', p_convenio_report_id, v_report.status;
  END IF;

  -- [FIX-S3-6] Validar snapshot: existe + tenant + learner
  SELECT id, tenant_id, learner_id
  INTO v_snapshot
  FROM report_snapshots
  WHERE id = p_report_snapshot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Report snapshot % não encontrado.', p_report_snapshot_id;
  END IF;

  IF v_snapshot.tenant_id != v_report.tenant_id THEN
    RAISE EXCEPTION '[AXIS ABA] Snapshot % pertence a outro tenant.', p_report_snapshot_id;
  END IF;

  IF v_snapshot.learner_id != v_report.learner_id THEN
    RAISE EXCEPTION '[AXIS ABA] Snapshot % pertence a outro aprendiz (% ≠ %).',
      p_report_snapshot_id, v_snapshot.learner_id, v_report.learner_id;
  END IF;

  UPDATE convenio_reports
  SET status = 'finalized',
      report_snapshot_id = p_report_snapshot_id,
      finalized_at = NOW()
  WHERE id = p_convenio_report_id;

  -- Audit
  INSERT INTO axis_audit_logs (
    action, entity_type, entity_type, metadata, created_at
  ) VALUES (
    'CONVENIO_REPORT_FINALIZED',
    'convenio_reports',
    p_convenio_report_id,
    p_finalized_by,
    jsonb_build_object(
      'learner_id',         v_report.learner_id,
      'tenant_id',          v_report.tenant_id,
      'report_snapshot_id', p_report_snapshot_id
    ),
    NOW()
  );
END;
$$;


--
-- Name: fn_attestation_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_attestation_by_token(p_token text) RETURNS TABLE(id uuid, session_id uuid, attestor_type text, attestor_name text, status text, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.session_id,
    sa.attestor_type,
    sa.attestor_name,
    sa.status,
    sa.expires_at
  FROM session_attestations sa
  WHERE sa.magic_link_token = p_token
    AND sa.status = 'pending'
    AND (sa.expires_at IS NULL OR sa.expires_at > NOW());
END;
$$;


--
-- Name: fn_complete_attestation(text, bytea, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_complete_attestation(p_token text, p_ip_encrypted bytea, p_user_agent text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_attestation_id UUID;
BEGIN
  UPDATE session_attestations
  SET
    status = 'completed',
    attested_at = NOW(),
    ip_address_encrypted = p_ip_encrypted,
    user_agent = p_user_agent
  WHERE magic_link_token = p_token
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING id INTO v_attestation_id;

  IF v_attestation_id IS NULL THEN
    RAISE EXCEPTION 'Atestação não encontrada, já completada ou expirada';
  END IF;

  RETURN v_attestation_id;
END;
$$;


--
-- Name: fn_immutable_audit_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_immutable_audit_logs() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION '[AXIS] axis_audit_logs é append-only. UPDATE e DELETE são proibidos.';
  RETURN NULL;
END;
$$;


--
-- Name: generate_convenio_data(uuid, uuid, date, date, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_convenio_data(p_learner_id uuid, p_tenant_id uuid, p_period_start date, p_period_end date, p_generated_by character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_learner        RECORD;
  v_sessions       JSONB;
  v_protocols      JSONB;
  v_cso_current    RECORD;
  v_cso_avg        NUMERIC;
  v_total_sessions INTEGER;
  v_total_hours    NUMERIC;
  v_engine_ver     VARCHAR;
  v_result         JSONB;
BEGIN
  -- 1. Dados do aprendiz
  SELECT id, name, birth_date, diagnosis, cid_code, support_level
  INTO v_learner
  FROM learners
  WHERE id = p_learner_id
    AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Aprendiz % não encontrado no tenant %.', p_learner_id, p_tenant_id;
  END IF;

  -- 2. Engine version
  SELECT version INTO v_engine_ver
  FROM engine_versions WHERE is_current = TRUE;

  IF v_engine_ver IS NULL THEN
    RAISE EXCEPTION '[AXIS ABA] Nenhuma engine_version ativa.';
  END IF;

  -- 3. Sessões do período
  SELECT
    COUNT(*),
    COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600), 0)
  INTO v_total_sessions, v_total_hours
  FROM sessions_aba
  WHERE learner_id = p_learner_id
    AND tenant_id = p_tenant_id
    AND status = 'completed'
    AND ended_at BETWEEN p_period_start AND p_period_end + INTERVAL '1 day';

  -- 4. [FIX-S3-2] Resumo sessões via snapshot (fonte única)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'session_date', sa.ended_at::DATE,
    'therapist_id', sa.therapist_id,
    'duration_min', ROUND(EXTRACT(EPOCH FROM (sa.ended_at - sa.started_at)) / 60),
    'cso_aba',      ss.cso_aba,
    'sas', ss.sas, 'pis', ss.pis, 'bss', ss.bss, 'tcm', ss.tcm
  ) ORDER BY sa.ended_at), '[]'::JSONB)
  INTO v_sessions
  FROM sessions_aba sa
  JOIN session_snapshots ss ON ss.session_id = sa.id
  WHERE sa.learner_id = p_learner_id
    AND sa.tenant_id = p_tenant_id
    AND sa.status = 'completed'
    AND sa.ended_at BETWEEN p_period_start AND p_period_end + INTERVAL '1 day';

  -- 5. [FIX-S3-1] CSO médio via snapshots do período
  SELECT COALESCE(AVG(ss.cso_aba), 0)
  INTO v_cso_avg
  FROM session_snapshots ss
  JOIN sessions_aba sa ON sa.id = ss.session_id
  WHERE sa.learner_id = p_learner_id
    AND sa.tenant_id = p_tenant_id
    AND sa.status = 'completed'
    AND sa.ended_at BETWEEN p_period_start AND p_period_end + INTERVAL '1 day';

  -- 6. CSO atual (último snapshot)
  SELECT ss.cso_aba, cso_aba_band(ss.cso_aba) AS cso_band,
         ss.sas, ss.pis, ss.bss, ss.tcm, ss.engine_version
  INTO v_cso_current
  FROM session_snapshots ss
  JOIN sessions_aba sa ON sa.id = ss.session_id
  WHERE sa.learner_id = p_learner_id
    AND sa.tenant_id = p_tenant_id
  ORDER BY sa.ended_at DESC
  LIMIT 1;

  -- 7. Protocolos ativos
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'title',                lp.title,
    'status',               lp.status,
    'domain',               lp.domain,
    'ebp_practice',         ep.name,
    'ebp_practice_pt',      ep.name_pt,
    'fpg_reference',        ep.fpg_reference,
    'mastery_criteria_pct', lp.mastery_criteria_pct,
    'generalization_status', lp.generalization_status,
    'regression_count',     lp.regression_count,
    'activated_at',         lp.activated_at,
    'mastered_at',          lp.mastered_at
  ) ORDER BY lp.activated_at), '[]'::JSONB)
  INTO v_protocols
  FROM learner_protocols lp
  JOIN ebp_practices ep ON ep.id = lp.ebp_practice_id
  WHERE lp.learner_id = p_learner_id
    AND lp.tenant_id = p_tenant_id
    AND lp.status NOT IN ('draft', 'discontinued');

  -- 8. Montar resultado
  v_result := jsonb_build_object(
    'report_type',    'convenio',
    'generated_at',   NOW(),
    'generated_by',   p_generated_by,
    'engine_version', v_engine_ver,
    'period',         jsonb_build_object(
      'start', p_period_start,
      'end',   p_period_end
    ),
    'learner',        jsonb_build_object(
      'id',            v_learner.id,
      'name',          v_learner.name,
      'birth_date',    v_learner.birth_date,
      'diagnosis',     v_learner.diagnosis,
      'cid_code',      v_learner.cid_code,
      'support_level', v_learner.support_level
    ),
    -- [FIX-S3-10] Flag explícita de dados clínicos
    'has_clinical_data', v_cso_current.cso_aba IS NOT NULL,
    'summary',        jsonb_build_object(
      'total_sessions',   v_total_sessions,
      'total_hours',      ROUND(v_total_hours, 2),
      'cso_aba_avg',      CASE WHEN v_total_sessions > 0 THEN ROUND(v_cso_avg, 2) ELSE NULL END,
      'cso_aba_current',  v_cso_current.cso_aba,
      'cso_band_current', COALESCE(v_cso_current.cso_band, 'sem_dados')
    ),
    'dimensions_current', jsonb_build_object(
      'sas', v_cso_current.sas,
      'pis', v_cso_current.pis,
      'bss', v_cso_current.bss,
      'tcm', v_cso_current.tcm
    ),
    'protocols',      v_protocols,
    'sessions',       v_sessions,
    'legal_footer',   'Relatório estruturado conforme diretrizes SBNI (Outubro 2025) e literatura baseada em evidência. Fundamentação: RN 469/2021, RN 541/2022, RN 539/2022.',
    'references',     jsonb_build_object(
      'fpg',  'Frank Porter Graham Child Development Institute (FPG/UNC Chapel Hill, 2020) — 28 Práticas Baseadas em Evidência',
      'sbni', 'Sociedade Brasileira de Neurociência e Comportamento Infantil (SBNI, Outubro 2025)',
      'bacb', 'BACB Ethics Code (2020)',
      'rbt',  'RBT Ethics Code 2.0 (2021)'
    )
  );

  RETURN v_result;
END;
$$;


--
-- Name: generate_longitudinal_data(uuid, uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_longitudinal_data(p_learner_id uuid, p_tenant_id uuid, p_period_start date DEFAULT NULL::date, p_period_end date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_data JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date',           sa.ended_at::DATE,
    'cso_aba',        ss.cso_aba,
    'cso_band',       cso_aba_band(ss.cso_aba),
    'sas',            ss.sas,
    'pis',            ss.pis,
    'bss',            ss.bss,
    'tcm',            ss.tcm,
    'engine_version', ss.engine_version
  ) ORDER BY sa.ended_at), '[]'::JSONB)
  INTO v_data
  FROM session_snapshots ss
  JOIN sessions_aba sa ON sa.id = ss.session_id
  WHERE sa.learner_id = p_learner_id
    AND sa.tenant_id = p_tenant_id
    AND (p_period_start IS NULL OR sa.ended_at >= p_period_start)
    AND (p_period_end IS NULL OR sa.ended_at <= p_period_end + INTERVAL '1 day');

  RETURN jsonb_build_object(
    'learner_id',   p_learner_id,
    'period',       jsonb_build_object(
      'start', COALESCE(p_period_start, '1900-01-01'::DATE),
      'end',   COALESCE(p_period_end, CURRENT_DATE)
    ),
    'data_points',  v_data,
    'total_points', jsonb_array_length(v_data)
  );
END;
$$;


--
-- Name: generate_session_summary_data(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_session_summary_data(p_session_id uuid, p_tenant_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_session  RECORD;
  v_snapshot RECORD;
  v_targets  JSONB;
BEGIN
  -- 1. Dados da sessão
  SELECT sa.*, l.name AS learner_name
  INTO v_session
  FROM sessions_aba sa
  JOIN learners l ON l.id = sa.learner_id
  WHERE sa.id = p_session_id
    AND sa.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Sessão % não encontrada.', p_session_id;
  END IF;

  IF v_session.status != 'completed' THEN
    RAISE EXCEPTION '[AXIS ABA] Sessão % não está completed. Finalize antes de gerar resumo.', p_session_id;
  END IF;

  -- 2. [FIX-S3-8] Snapshot obrigatório
  SELECT ss.sas, ss.pis, ss.bss, ss.tcm, ss.cso_aba, ss.engine_version
  INTO v_snapshot
  FROM session_snapshots ss
  WHERE ss.session_id = p_session_id
    AND ss.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Snapshot da sessão % não encontrado. Feche com close_session_aba() primeiro.', p_session_id;
  END IF;

  -- 3. Targets (linguagem acessível — Bible §22: pais não veem brutos)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'target_name',  st.target_name,
    'progress',     CASE
      WHEN st.score_pct >= 80 THEN 'Ótimo progresso'
      WHEN st.score_pct >= 60 THEN 'Progresso adequado'
      WHEN st.score_pct >= 40 THEN 'Em desenvolvimento'
      ELSE 'Necessita mais prática'
    END,
    'prompt_level', CASE st.prompt_level
      WHEN 'independent'      THEN 'Independente'
      WHEN 'gestural'         THEN 'Com dica gestual'
      WHEN 'verbal'           THEN 'Com dica verbal'
      WHEN 'modeling'         THEN 'Com demonstração'
      WHEN 'partial_physical' THEN 'Com apoio parcial'
      WHEN 'full_physical'    THEN 'Com apoio total'
    END
  ) ORDER BY st.target_name), '[]'::JSONB)
  INTO v_targets
  FROM session_targets st
  JOIN sessions_aba sa ON sa.id = st.session_id
  WHERE st.session_id = p_session_id
    AND sa.tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'session_id',       p_session_id,
    'learner_name',     v_session.learner_name,
    'session_date',     v_session.ended_at::DATE,
    'duration_min',     ROUND(EXTRACT(EPOCH FROM (v_session.ended_at - v_session.started_at)) / 60),
    'overall_progress', CASE
      WHEN v_snapshot.cso_aba >= 85 THEN 'Excelente — progresso consistente'
      WHEN v_snapshot.cso_aba >= 70 THEN 'Bom — evolução adequada'
      WHEN v_snapshot.cso_aba >= 50 THEN 'Regular — estratégias em revisão'
      ELSE 'Atenção — intervenção sendo ajustada'
    END,
    'targets',          v_targets,
    'note',             'Este resumo foi gerado automaticamente e revisado pelo terapeuta antes do envio.'
  );
END;
$$;


--
-- Name: grant_portal_access(uuid, uuid, uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_portal_access(p_guardian_id uuid, p_learner_id uuid, p_tenant_id uuid, p_granted_by character varying) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE v_consent_id UUID; v_access_id UUID;
BEGIN
  PERFORM validate_guardian_learner(p_guardian_id, p_learner_id, p_tenant_id);

  SELECT id INTO v_consent_id FROM guardian_consents
  WHERE guardian_id = p_guardian_id AND learner_id = p_learner_id
    AND consent_type = 'portal_access' AND revoked_at IS NULL;

  IF v_consent_id IS NULL THEN
    RAISE EXCEPTION '[AXIS ABA] Consentimento portal não encontrado. Registre LGPD primeiro.';
  END IF;

  IF EXISTS (SELECT 1 FROM family_portal_access WHERE guardian_id = p_guardian_id
    AND learner_id = p_learner_id AND is_active = TRUE) THEN
    RAISE EXCEPTION '[AXIS ABA] Portal já ativo.';
  END IF;

  INSERT INTO family_portal_access (guardian_id, learner_id, tenant_id, consent_id, is_active)
  VALUES (p_guardian_id, p_learner_id, p_tenant_id, v_consent_id, TRUE)
  RETURNING id INTO v_access_id;

  INSERT INTO axis_audit_logs (action, entity_type, entity_type, metadata, created_at)
  VALUES ('PORTAL_ACCESS_GRANTED', 'family_portal_access', v_access_id, p_granted_by,
    jsonb_build_object('guardian_id', p_guardian_id, 'learner_id', p_learner_id,
      'tenant_id', p_tenant_id, 'consent_id', v_consent_id), NOW());

  RETURN v_access_id;
END;
$$;


--
-- Name: intensity_to_scale(public.aba_behavior_intensity); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.intensity_to_scale(p_intensity public.aba_behavior_intensity) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  RETURN CASE p_intensity
    WHEN 'leve'     THEN 0.25
    WHEN 'moderada' THEN 0.50
    WHEN 'alta'     THEN 0.75
    WHEN 'severa'   THEN 1.00
    ELSE 0.25
  END;
END;
$$;


--
-- Name: log_email_sent(uuid, uuid, character varying, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_email_sent(p_summary_id uuid, p_tenant_id uuid, p_recipient_email character varying, p_subject character varying, p_status character varying, p_sent_by character varying) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE v_email_log_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM session_summaries WHERE id = p_summary_id AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION '[AXIS ABA] Resumo % não encontrado neste tenant.', p_summary_id;
  END IF;

  INSERT INTO email_logs (tenant_id, recipient_email, subject, related_type, related_id, status, sent_at)
  VALUES (p_tenant_id, p_recipient_email, p_subject, 'session_summaries', p_summary_id,
    p_status, CASE WHEN p_status = 'sent' THEN NOW() ELSE NULL END)
  RETURNING id INTO v_email_log_id;

  IF p_status = 'sent' THEN
    UPDATE session_summaries SET status = 'sent', sent_at = NOW(), email_log_id = v_email_log_id, updated_at = NOW()
    WHERE id = p_summary_id AND tenant_id = p_tenant_id AND status = 'approved';
  END IF;

  INSERT INTO axis_audit_logs (action, entity_type, entity_type, metadata, created_at)
  VALUES ('EMAIL_SENT', 'email_logs', v_email_log_id, p_sent_by,
    jsonb_build_object('summary_id', p_summary_id, 'recipient_email', p_recipient_email, 'status', p_status), NOW());

  RETURN v_email_log_id;
END;
$$;


--
-- Name: notify_maintenance_due(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_maintenance_due(p_tenant_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE v_probe RECORD; v_count INTEGER := 0;
BEGIN
  FOR v_probe IN
    SELECT mp.id AS probe_id, mp.probe_number, mp.scheduled_at,
      lp.title AS protocol_title, lp.therapist_id, l.name AS learner_name
    FROM maintenance_probes mp
    JOIN learner_protocols lp ON lp.id = mp.protocol_id
    JOIN learners l ON l.id = mp.learner_id
    WHERE mp.tenant_id = p_tenant_id AND mp.completed_at IS NULL
      AND mp.scheduled_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 days'
  LOOP
    PERFORM create_notification_aba(p_tenant_id, v_probe.therapist_id, 'maintenance_due',
      format('Sonda #%s vence em breve', v_probe.probe_number),
      format('Protocolo "%s" de %s — agendada para %s.', v_probe.protocol_title, v_probe.learner_name, v_probe.scheduled_at),
      jsonb_build_object('probe_id', v_probe.probe_id),
      'maint_due_' || v_probe.probe_id::TEXT);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;


--
-- Name: notify_regression_detected(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_regression_detected(p_protocol_id uuid, p_tenant_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE v_protocol RECORD;
BEGIN
  SELECT lp.id, lp.title, lp.supervisor_id, lp.regression_type, lp.regression_count, l.name AS learner_name
  INTO v_protocol FROM learner_protocols lp JOIN learners l ON l.id = lp.learner_id
  WHERE lp.id = p_protocol_id AND lp.tenant_id = p_tenant_id;

  IF NOT FOUND OR v_protocol.supervisor_id IS NULL THEN RETURN; END IF;

  PERFORM create_notification_aba(p_tenant_id, v_protocol.supervisor_id, 'regression_alert',
    format('Regressão — %s', v_protocol.learner_name),
    format('Protocolo "%s": regressão %s (#%s).', v_protocol.title, v_protocol.regression_type, v_protocol.regression_count),
    jsonb_build_object('protocol_id', p_protocol_id),
    'regress_' || p_protocol_id::TEXT || '_' || v_protocol.regression_count::TEXT);
END;
$$;


SET default_table_access_method = heap;

--
-- Name: sessions_aba; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions_aba (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    therapist_id character varying(255) NOT NULL,
    supervisor_id character varying(255),
    scheduled_at timestamp with time zone NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    status public.aba_session_status DEFAULT 'scheduled'::public.aba_session_status NOT NULL,
    location character varying(255),
    notes text,
    calendar_event_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    duration_minutes integer,
    duration_minutes_override integer,
    applied_by uuid,
    declared_site_id uuid,
    service_mode text DEFAULT 'presencial'::text,
    CONSTRAINT sessions_aba_service_mode_check CHECK ((service_mode = ANY (ARRAY['presencial'::text, 'domiciliar'::text, 'escolar'::text, 'telehealth'::text])))
);

ALTER TABLE ONLY public.sessions_aba FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN sessions_aba.duration_minutes_override; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions_aba.duration_minutes_override IS 'Duração corrigida manualmente pelo terapeuta (sobrescreve cálculo automático)';


--
-- Name: COLUMN sessions_aba.applied_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions_aba.applied_by IS 'Profissional responsável pela sessão (pode diferir do therapist_id do agendamento)';


--
-- Name: open_session_aba(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_session_aba(p_tenant_id uuid, p_session_id uuid) RETURNS public.sessions_aba
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_session sessions_aba;
BEGIN
  SELECT * INTO v_session
  FROM sessions_aba
  WHERE id = p_session_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Sessão % não encontrada para este tenant.', p_session_id;
  END IF;

  IF v_session.status != 'scheduled' THEN
    RAISE EXCEPTION '[AXIS ABA] Sessão % não está agendada. Status atual: %.', p_session_id, v_session.status;
  END IF;

  UPDATE sessions_aba
  SET status = 'in_progress',
      started_at = NOW(),
      updated_at = NOW()
  WHERE id = p_session_id
    AND tenant_id = p_tenant_id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;


--
-- Name: portal_get_achievements(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_get_achievements(p_learner_id uuid, p_tenant_id uuid) RETURNS TABLE(title character varying, domain character varying, updated_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT lp.title, lp.domain, lp.updated_at
  FROM learner_protocols lp
  WHERE lp.learner_id = p_learner_id AND lp.tenant_id = p_tenant_id
    AND lp.status IN ('mastered','maintained','generalization','maintenance')
  ORDER BY lp.updated_at DESC
  LIMIT 10;
$$;


--
-- Name: portal_get_learner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_get_learner(p_learner_id uuid, p_tenant_id uuid) RETURNS TABLE(id uuid, name character varying, birth_date date, diagnosis character varying, support_level smallint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT l.id, l.name, l.birth_date, l.diagnosis, l.support_level
  FROM learners l
  WHERE l.id = p_learner_id AND l.tenant_id = p_tenant_id;
$$;


--
-- Name: portal_get_protocols(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_get_protocols(p_learner_id uuid, p_tenant_id uuid) RETURNS TABLE(title character varying, domain character varying, status public.aba_protocol_status, status_simplificado text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    lp.title, lp.domain, lp.status,
    CASE
      WHEN lp.status IN ('mastered','maintained','generalization','maintenance') THEN 'conquistado'
      WHEN lp.status = 'active' THEN 'em_progresso'
      WHEN lp.status = 'regression' THEN 'em_revisao'
      ELSE 'outro'
    END as status_simplificado
  FROM learner_protocols lp
  WHERE lp.learner_id = p_learner_id AND lp.tenant_id = p_tenant_id
    AND lp.status NOT IN ('discontinued', 'archived')
  ORDER BY lp.created_at DESC;
$$;


--
-- Name: portal_get_summaries(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_get_summaries(p_learner_id uuid, p_tenant_id uuid) RETURNS TABLE(id uuid, content text, approved_at timestamp with time zone, scheduled_at timestamp with time zone, duration_minutes integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT ss.id, ss.content, ss.approved_at, s.scheduled_at, s.duration_minutes
  FROM session_summaries ss
  JOIN sessions_aba s ON s.id = ss.session_id
  WHERE ss.learner_id = p_learner_id AND ss.tenant_id = p_tenant_id
    AND ss.status = 'approved'
  ORDER BY s.scheduled_at DESC
  LIMIT 10;
$$;


--
-- Name: FUNCTION portal_get_summaries(p_learner_id uuid, p_tenant_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.portal_get_summaries(p_learner_id uuid, p_tenant_id uuid) IS 'Retorna resumos de sessão enviados para o portal familiar. Filtro: sent_at IS NOT NULL (resumos que completaram approve + send). Coluna de saída "content" mapeia summary_text por retrocompatibilidade.';


--
-- Name: portal_get_upcoming(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_get_upcoming(p_learner_id uuid, p_tenant_id uuid) RETURNS TABLE(scheduled_at timestamp with time zone, duration_minutes integer, status public.aba_session_status)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT s.scheduled_at, s.duration_minutes, s.status
  FROM sessions_aba s
  WHERE s.learner_id = p_learner_id AND s.tenant_id = p_tenant_id
    AND s.scheduled_at > NOW() AND s.status != 'cancelled'
  ORDER BY s.scheduled_at ASC
  LIMIT 5;
$$;


--
-- Name: portal_token_lookup(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_token_lookup(p_token text) RETURNS TABLE(id uuid, tenant_id uuid, guardian_id uuid, learner_id uuid, access_token text, token_expires_at timestamp with time zone, is_active boolean, consent_accepted timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    fpa.id,
    fpa.tenant_id,
    fpa.guardian_id,
    fpa.learner_id,
    fpa.access_token,
    fpa.token_expires_at,
    fpa.is_active,
    gc.accepted_at as consent_accepted
  FROM family_portal_access fpa
  LEFT JOIN guardian_consents gc
    ON gc.learner_id = fpa.learner_id
    AND gc.guardian_id = fpa.guardian_id
    AND gc.revoked_at IS NULL
  WHERE fpa.access_token = p_token
    AND fpa.is_active = true
    AND (fpa.token_expires_at IS NULL OR fpa.token_expires_at > NOW());
$$;


--
-- Name: portal_update_last_access(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_update_last_access(p_token text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
  UPDATE family_portal_access
  SET last_accessed_at = NOW()
  WHERE access_token = p_token;
$$;


--
-- Name: process_pending_summaries(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_pending_summaries(p_tenant_id uuid) RETURNS TABLE(summary_id uuid, session_id uuid, learner_id uuid, guardian_id uuid, guardian_name character varying, guardian_email character varying, content text)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT ss.id, ss.session_id, ss.learner_id,
    g.id AS guardian_id, g.name AS guardian_name, g.email AS guardian_email, ss.content
  FROM session_summaries ss
  JOIN guardians g ON g.learner_id = ss.learner_id AND g.tenant_id = ss.tenant_id
  WHERE ss.tenant_id = p_tenant_id AND ss.status = 'approved' AND ss.sent_at IS NULL
    AND check_consent(g.id, ss.learner_id, 'email_summary') = TRUE;
END;
$$;


--
-- Name: prompt_to_scale(public.aba_prompt_level); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prompt_to_scale(p_level public.aba_prompt_level) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  RETURN CASE p_level
    WHEN 'independent'      THEN 1.00
    WHEN 'gestural'         THEN 0.80
    WHEN 'verbal'           THEN 0.60
    WHEN 'modeling'         THEN 0.40
    WHEN 'partial_physical' THEN 0.20
    WHEN 'full_physical'    THEN 0.00
    ELSE 0.00
  END;
END;
$$;


--
-- Name: session_behaviors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_behaviors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    behavior_type character varying(255) NOT NULL,
    antecedent text NOT NULL,
    behavior text NOT NULL,
    consequence text NOT NULL,
    intensity public.aba_behavior_intensity DEFAULT 'leve'::public.aba_behavior_intensity NOT NULL,
    duration_seconds integer,
    location character varying(255),
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.session_behaviors FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN session_behaviors.behavior_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_behaviors.behavior_type IS 'Tipo do comportamento (ex: maladaptive, adaptive, stereotypy)';


--
-- Name: COLUMN session_behaviors.duration_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_behaviors.duration_seconds IS 'Duração do episódio comportamental em segundos';


--
-- Name: COLUMN session_behaviors.location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_behaviors.location IS 'Local onde o comportamento ocorreu';


--
-- Name: COLUMN session_behaviors.recorded_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_behaviors.recorded_at IS 'Timestamp do registro (preenchido automaticamente)';


--
-- Name: record_behavior_event(uuid, uuid, character varying, text, text, text, public.aba_behavior_intensity, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_behavior_event(p_tenant_id uuid, p_session_id uuid, p_behavior_type character varying, p_antecedent text, p_behavior text, p_consequence text, p_intensity public.aba_behavior_intensity, p_duration_seconds integer DEFAULT NULL::integer, p_location text DEFAULT NULL::text) RETURNS public.session_behaviors
    LANGUAGE plpgsql
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


--
-- Name: record_behavior_event(uuid, uuid, character varying, text, text, text, public.aba_behavior_intensity, integer, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_behavior_event(p_tenant_id uuid, p_session_id uuid, p_behavior_type character varying, p_antecedent text, p_behavior text, p_consequence text, p_intensity public.aba_behavior_intensity, p_duration_seconds integer DEFAULT NULL::integer, p_location character varying DEFAULT NULL::character varying) RETURNS public.session_behaviors
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_session sessions_aba;
  v_event session_behaviors;
BEGIN
  -- FOR UPDATE adicionado (consistência com record_target_trial)
  SELECT * INTO v_session
  FROM sessions_aba
  WHERE id = p_session_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Sessão % não encontrada.', p_session_id;
  END IF;

  IF v_session.status != 'in_progress' THEN
    RAISE EXCEPTION '[AXIS ABA] Sessão % não está em andamento. Status: %.', p_session_id, v_session.status;
  END IF;

  INSERT INTO session_behaviors (
    tenant_id, session_id, behavior_type,
    antecedent, behavior, consequence,
    intensity, duration_seconds, location
  ) VALUES (
    p_tenant_id, p_session_id, p_behavior_type,
    p_antecedent, p_behavior, p_consequence,
    p_intensity, p_duration_seconds, p_location
  )
  RETURNING * INTO v_event;

  -- Atualiza timestamp da sessão pai
  UPDATE sessions_aba
  SET updated_at = NOW()
  WHERE id = p_session_id AND tenant_id = p_tenant_id;

  RETURN v_event;
END;
$$;


--
-- Name: session_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    protocol_id uuid NOT NULL,
    target_name character varying(500) NOT NULL,
    trials_total smallint DEFAULT 0 NOT NULL,
    trials_correct smallint DEFAULT 0 NOT NULL,
    prompt_level public.aba_prompt_level DEFAULT 'full_physical'::public.aba_prompt_level NOT NULL,
    score_pct numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN (trials_total > 0) THEN round((((trials_correct)::numeric / (trials_total)::numeric) * (100)::numeric), 2)
    ELSE (0)::numeric
END) STORED,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    duration_seconds integer,
    applied_by uuid,
    CONSTRAINT ck_trials_correct_lte_total CHECK ((trials_correct <= trials_total))
);

ALTER TABLE ONLY public.session_targets FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN session_targets.duration_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_targets.duration_seconds IS 'Duração em segundos do bloco de trials (cronômetro ou manual)';


--
-- Name: COLUMN session_targets.applied_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_targets.applied_by IS 'Profissional que aplicou este trial (FK profiles.id)';


--
-- Name: record_target_trial(uuid, uuid, uuid, character varying, smallint, smallint, public.aba_prompt_level, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_target_trial(p_tenant_id uuid, p_session_id uuid, p_protocol_id uuid, p_target_name character varying, p_trials_total smallint, p_trials_correct smallint, p_prompt_level public.aba_prompt_level, p_notes text DEFAULT NULL::text) RETURNS public.session_targets
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_session sessions_aba;
  v_target session_targets;
BEGIN
  SELECT * INTO v_session
  FROM sessions_aba
  WHERE id = p_session_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Sessão % não encontrada.', p_session_id;
  END IF;

  IF v_session.status != 'in_progress' THEN
    RAISE EXCEPTION '[AXIS ABA] Sessão % não está em andamento. Status: %.', p_session_id, v_session.status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM learner_protocols
    WHERE id = p_protocol_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION '[AXIS ABA] Protocolo % não encontrado.', p_protocol_id;
  END IF;

  IF p_trials_correct > p_trials_total THEN
    RAISE EXCEPTION '[AXIS ABA] trials_correct (%) não pode ser maior que trials_total (%).', p_trials_correct, p_trials_total;
  END IF;

  INSERT INTO session_targets (
    tenant_id, session_id, protocol_id, target_name,
    trials_total, trials_correct, prompt_level, notes
  ) VALUES (
    p_tenant_id, p_session_id, p_protocol_id, p_target_name,
    p_trials_total, p_trials_correct, p_prompt_level, p_notes
  )
  RETURNING * INTO v_target;

  -- Atualiza timestamp da sessão pai (auditoria aceita)
  UPDATE sessions_aba
  SET updated_at = NOW()
  WHERE id = p_session_id AND tenant_id = p_tenant_id;

  RETURN v_target;
END;
$$;


--
-- Name: register_consent(uuid, uuid, uuid, public.aba_consent_type, inet, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_consent(p_guardian_id uuid, p_learner_id uuid, p_tenant_id uuid, p_consent_type public.aba_consent_type, p_ip_address inet, p_registered_by character varying) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM validate_guardian_learner(p_guardian_id, p_learner_id, p_tenant_id);

  IF EXISTS (
    SELECT 1 FROM guardian_consents
    WHERE guardian_id = p_guardian_id AND learner_id = p_learner_id
      AND consent_type = p_consent_type AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION '[AXIS ABA] Já existe consentimento ativo (%).', p_consent_type;
  END IF;

  INSERT INTO guardian_consents (guardian_id, learner_id, tenant_id, consent_type, ip_address, accepted_at)
  VALUES (p_guardian_id, p_learner_id, p_tenant_id, p_consent_type, p_ip_address, NOW())
  RETURNING id INTO v_id;

  INSERT INTO axis_audit_logs (action, entity_type, entity_type, metadata, created_at)
  VALUES ('CONSENT_REGISTERED', 'guardian_consents', v_id, p_registered_by,
    jsonb_build_object('guardian_id', p_guardian_id, 'learner_id', p_learner_id,
      'tenant_id', p_tenant_id, 'consent_type', p_consent_type::TEXT, 'ip_address', p_ip_address::TEXT), NOW());

  RETURN v_id;
END;
$$;


--
-- Name: register_report_snapshot(uuid, uuid, public.aba_report_type, text, character varying, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_report_snapshot(p_learner_id uuid, p_tenant_id uuid, p_report_type public.aba_report_type, p_pdf_url text, p_generated_by character varying, p_report_json jsonb DEFAULT NULL::jsonb, p_data_hash text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_id UUID;
  v_hash TEXT;
  v_engine_ver VARCHAR;
BEGIN
  SELECT current_setting('app.engine_version', true) INTO v_engine_ver;
  IF v_engine_ver IS NULL OR v_engine_ver = '' THEN v_engine_ver := '2.6.1'; END IF;

  IF p_report_json IS NOT NULL THEN
    v_hash := encode(digest(p_report_json::text, 'sha256'), 'hex');
  ELSIF p_data_hash IS NOT NULL THEN
    v_hash := p_data_hash;
  ELSE
    RAISE EXCEPTION 'report_json ou data_hash obrigatório';
  END IF;

  INSERT INTO report_snapshots (learner_id, tenant_id, report_type, data_hash, pdf_url, generated_by, engine_version)
  VALUES (p_learner_id, p_tenant_id, p_report_type, v_hash, COALESCE(p_pdf_url, 'client-generated'), p_generated_by, v_engine_ver)
  RETURNING id INTO v_id;

  INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
  VALUES (
    p_tenant_id,
    p_generated_by,
    'human',
    'REPORT_GENERATED',
    'report_snapshots',
    v_id,
    jsonb_build_object(
      'learner_id', p_learner_id,
      'report_type', p_report_type::TEXT,
      'data_hash', v_hash,
      'engine_version', v_engine_ver
    )
  );

  RETURN v_id;
END;
$$;


--
-- Name: revoke_consent(uuid, uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_consent(p_consent_id uuid, p_tenant_id uuid, p_revoked_by character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE v_consent RECORD;
BEGIN
  SELECT id, guardian_id, learner_id, tenant_id, consent_type, revoked_at
  INTO v_consent FROM guardian_consents
  WHERE id = p_consent_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN RAISE EXCEPTION '[AXIS ABA] Consentimento % não encontrado neste tenant.', p_consent_id; END IF;
  IF v_consent.revoked_at IS NOT NULL THEN RAISE EXCEPTION '[AXIS ABA] Consentimento % já revogado.', p_consent_id; END IF;

  UPDATE guardian_consents SET revoked_at = NOW() WHERE id = p_consent_id AND tenant_id = p_tenant_id;

  IF v_consent.consent_type = 'portal_access' THEN
    UPDATE family_portal_access SET is_active = FALSE, deactivated_at = NOW()
    WHERE guardian_id = v_consent.guardian_id AND learner_id = v_consent.learner_id
      AND tenant_id = p_tenant_id AND consent_id = p_consent_id AND is_active = TRUE;
  END IF;

  INSERT INTO axis_audit_logs (action, entity_type, entity_type, metadata, created_at)
  VALUES ('CONSENT_REVOKED', 'guardian_consents', p_consent_id, p_revoked_by,
    jsonb_build_object('guardian_id', v_consent.guardian_id, 'learner_id', v_consent.learner_id,
      'tenant_id', p_tenant_id, 'consent_type', v_consent.consent_type::TEXT), NOW());
END;
$$;


--
-- Name: revoke_portal_access(uuid, uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_portal_access(p_access_id uuid, p_tenant_id uuid, p_revoked_by character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE v_access RECORD;
BEGIN
  SELECT id, guardian_id, learner_id, is_active INTO v_access
  FROM family_portal_access WHERE id = p_access_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN RAISE EXCEPTION '[AXIS ABA] Acesso portal % não encontrado neste tenant.', p_access_id; END IF;
  IF NOT v_access.is_active THEN RAISE EXCEPTION '[AXIS ABA] Acesso portal % já desativado.', p_access_id; END IF;

  UPDATE family_portal_access SET is_active = FALSE, deactivated_at = NOW()
  WHERE id = p_access_id AND tenant_id = p_tenant_id;

  INSERT INTO axis_audit_logs (action, entity_type, entity_type, metadata, created_at)
  VALUES ('PORTAL_ACCESS_REVOKED', 'family_portal_access', p_access_id, p_revoked_by,
    jsonb_build_object('guardian_id', v_access.guardian_id, 'learner_id', v_access.learner_id, 'tenant_id', p_tenant_id), NOW());
END;
$$;


--
-- Name: rls_activate_all(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_activate_all() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_table TEXT; v_count INTEGER := 0;
  v_tables TEXT[] := ARRAY['user_licenses','email_logs','learners','learner_support_levels','guardians','guardian_consents','protocol_library','pei_plans','learner_protocols','sessions_aba','session_targets','session_behaviors','session_snapshots','clinical_states_aba','generalization_probes','maintenance_probes','report_snapshots','convenio_reports','session_summaries','family_portal_access','suggestion_log_aba','notifications'];
  v_global_tables TEXT[] := ARRAY['ebp_practices','engine_versions'];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = v_table AND table_schema = 'public') THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', v_table);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', v_table);
      EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());', v_table);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  FOREACH v_table IN ARRAY v_global_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = v_table AND table_schema = 'public') THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', v_table);
      EXECUTE format('DROP POLICY IF EXISTS public_read ON %I;', v_table);
      EXECUTE format('CREATE POLICY public_read ON %I FOR SELECT USING (true);', v_table);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'axis_audit_logs' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE axis_audit_logs ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS audit_insert ON axis_audit_logs;';
    EXECUTE 'CREATE POLICY audit_insert ON axis_audit_logs FOR INSERT WITH CHECK (true);';
    EXECUTE 'DROP POLICY IF EXISTS audit_select ON axis_audit_logs;';
    EXECUTE 'CREATE POLICY audit_select ON axis_audit_logs FOR SELECT USING (
      current_setting(''app.user_role'', true) = ''system''
      OR (metadata ? ''tenant_id'' AND (metadata->>''tenant_id'') ~* ''^[0-9a-f-]{36}$'' AND (metadata->>''tenant_id'')::uuid = app_tenant_id())
    );';
    EXECUTE 'DROP POLICY IF EXISTS audit_block_update ON axis_audit_logs;';
    EXECUTE 'CREATE POLICY audit_block_update ON axis_audit_logs FOR UPDATE USING (false);';
    EXECUTE 'DROP POLICY IF EXISTS audit_block_delete ON axis_audit_logs;';
    EXECUTE 'CREATE POLICY audit_block_delete ON axis_audit_logs FOR DELETE USING (false);';
    v_count := v_count + 1;
  END IF;
  RETURN format('[AXIS RLS] Ativado em %s tabelas.', v_count);
END; $_$;


--
-- Name: rls_deactivate_all(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_deactivate_all() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_table TEXT;
  v_policy TEXT;
  v_count INTEGER := 0;
  v_all_tables TEXT[] := ARRAY[
    'user_licenses', 'email_logs', 'learners', 'learner_support_levels',
    'guardians', 'guardian_consents', 'protocol_library', 'pei_plans',
    'learner_protocols', 'sessions_aba', 'session_targets', 'session_behaviors',
    'session_snapshots', 'clinical_states_aba', 'generalization_probes',
    'maintenance_probes', 'report_snapshots', 'convenio_reports',
    'session_summaries', 'family_portal_access', 'suggestion_log_aba',
    'notifications', 'ebp_practices', 'engine_versions', 'axis_audit_logs'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_all_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = v_table AND table_schema = 'public') THEN
      -- Remover todas policies desta tabela
      FOR v_policy IN
        SELECT policyname FROM pg_policies WHERE tablename = v_table AND schemaname = 'public'
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', v_policy, v_table);
      END LOOP;

      -- Desativar RLS
      EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY;', v_table);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN format('[AXIS RLS] Desativado em %s tabelas. Todas policies removidas.', v_count);
END;
$$;


--
-- Name: rls_readiness_check(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_readiness_check() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_table TEXT;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_ready BOOLEAN := TRUE;
  v_tables TEXT[] := ARRAY[
    'user_licenses', 'email_logs', 'learners', 'learner_support_levels',
    'guardians', 'guardian_consents', 'protocol_library', 'pei_plans',
    'learner_protocols', 'sessions_aba', 'session_targets', 'session_behaviors',
    'session_snapshots', 'clinical_states_aba', 'generalization_probes',
    'maintenance_probes', 'report_snapshots', 'convenio_reports',
    'session_summaries', 'family_portal_access', 'suggestion_log_aba',
    'notifications'
  ];
  v_tcc_count INTEGER;
  v_tenant_test UUID;
BEGIN
  -- 1. Verificar coluna tenant_id em todas tabelas
  FOREACH v_table IN ARRAY v_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = v_table AND column_name = 'tenant_id' AND table_schema = 'public'
    ) THEN
      v_missing := array_append(v_missing, v_table);
      v_ready := FALSE;
    END IF;
  END LOOP;

  -- 2. Testar SET/GET de app.tenant_id
  BEGIN
    PERFORM set_config('app.tenant_id', gen_random_uuid()::TEXT, true);
    v_tenant_test := app_tenant_id();
  EXCEPTION
    WHEN OTHERS THEN
      v_ready := FALSE;
  END;

  -- 3. Verificar TCC intacto
  SELECT count(*) INTO v_tcc_count FROM patients;

  RETURN jsonb_build_object(
    'ready',              v_ready,
    'tables_checked',     array_length(v_tables, 1),
    'missing_tenant_id',  v_missing,
    'tenant_id_test',     v_tenant_test IS NOT NULL,
    'tcc_patients',       v_tcc_count,
    'tcc_safe',           v_tcc_count = 3,
    'recommendation',     CASE
      WHEN v_ready AND v_tcc_count = 3 THEN
        'PRONTO. Pode rodar: SELECT rls_activate_all();'
      WHEN NOT v_ready THEN
        'NÃO PRONTO. Tabelas sem tenant_id: ' || array_to_string(v_missing, ', ')
      ELSE
        'ALERTA. TCC com contagem inesperada: ' || v_tcc_count
    END,
    'checked_at',         NOW()
  );
END;
$$;


--
-- Name: schedule_maintenance_probes(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.schedule_maintenance_probes(p_protocol_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_protocol RECORD;
  v_base_date DATE;
BEGIN
  SELECT id, tenant_id, learner_id, status, mastered_at
  INTO v_protocol
  FROM learner_protocols
  WHERE id = p_protocol_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[AXIS ABA] Protocolo % não encontrado.', p_protocol_id;
  END IF;

  IF v_protocol.status != 'maintenance' THEN
    RAISE EXCEPTION '[AXIS ABA] Protocolo % não está em maintenance (status: %).',
      p_protocol_id, v_protocol.status;
  END IF;

  -- Base: data que atingiu mastered
  v_base_date := COALESCE(v_protocol.mastered_at::DATE, CURRENT_DATE);

  -- Agendar 3 sondas (Bible §5: 2, 6, 12 semanas)
  INSERT INTO maintenance_probes (tenant_id, learner_id, protocol_id, probe_number, scheduled_at)
  VALUES
    (v_protocol.tenant_id, v_protocol.learner_id, p_protocol_id, 1, v_base_date + INTERVAL '2 weeks'),
    (v_protocol.tenant_id, v_protocol.learner_id, p_protocol_id, 2, v_base_date + INTERVAL '6 weeks'),
    (v_protocol.tenant_id, v_protocol.learner_id, p_protocol_id, 3, v_base_date + INTERVAL '12 weeks')
  ON CONFLICT (protocol_id, probe_number) DO NOTHING;

  -- Audit
  INSERT INTO axis_audit_logs (
    action, entity_type, entity_type, metadata, created_at
  ) VALUES (
    'MAINTENANCE_PROBES_SCHEDULED',
    'learner_protocols',
    p_protocol_id,
    'system',
    jsonb_build_object(
      'learner_id',  v_protocol.learner_id,
      'tenant_id',   v_protocol.tenant_id,
      'probe_1',     v_base_date + INTERVAL '2 weeks',
      'probe_2',     v_base_date + INTERVAL '6 weeks',
      'probe_3',     v_base_date + INTERVAL '12 weeks'
    ),
    NOW()
  );
END;
$$;


--
-- Name: submit_session_summary(uuid, uuid, text, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_session_summary(p_session_id uuid, p_tenant_id uuid, p_content text, p_submitted_by character varying) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE v_session RECORD; v_summary_id UUID;
BEGIN
  SELECT id, learner_id INTO v_session FROM sessions_aba
  WHERE id = p_session_id AND tenant_id = p_tenant_id AND status = 'completed';

  IF NOT FOUND THEN RAISE EXCEPTION '[AXIS ABA] Sessão % não está completed neste tenant.', p_session_id; END IF;

  IF EXISTS (SELECT 1 FROM session_summaries WHERE session_id = p_session_id) THEN
    RAISE EXCEPTION '[AXIS ABA] Já existe resumo para sessão %.', p_session_id;
  END IF;

  INSERT INTO session_summaries (session_id, tenant_id, learner_id, content, status, created_by)
  VALUES (p_session_id, p_tenant_id, v_session.learner_id, p_content, 'pending', p_submitted_by)
  RETURNING id INTO v_summary_id;

  INSERT INTO axis_audit_logs (action, entity_type, entity_type, metadata, created_at)
  VALUES ('SUMMARY_SUBMITTED', 'session_summaries', v_summary_id, p_submitted_by,
    jsonb_build_object('session_id', p_session_id, 'tenant_id', p_tenant_id), NOW());

  RETURN v_summary_id;
END;
$$;


--
-- Name: trg_fn_append_only_support_levels(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_fn_append_only_support_levels() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION
    '[AXIS ABA] learner_support_levels é append-only. UPDATE e DELETE são proibidos. Insira um novo registro.';
  RETURN NULL;
END;
$$;


--
-- Name: trg_fn_immutable_clinical_states_aba(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_fn_immutable_clinical_states_aba() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION
    '[AXIS ABA] clinical_states_aba é append-only. UPDATE e DELETE são proibidos. Insira novo registro.';
  RETURN NULL;
END;
$$;


--
-- Name: trg_fn_immutable_report_snapshots(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_fn_immutable_report_snapshots() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION
    '[AXIS ABA] report_snapshots é imutável. Relatórios finalizados não podem ser alterados.';
  RETURN NULL;
END;
$$;


--
-- Name: trg_fn_immutable_session_snapshots(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_fn_immutable_session_snapshots() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION
    '[AXIS ABA] session_snapshots é imutável. UPDATE e DELETE são proibidos. O passado clínico não pode ser alterado.';
  RETURN NULL;
END;
$$;


--
-- Name: trg_fn_protocol_status_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_fn_protocol_status_audit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
    VALUES (NEW.tenant_id, COALESCE(current_setting('app.user_id', true),'system'), 'system',
      'PROTOCOL_STATUS_CHANGE', 'learner_protocols',
      jsonb_build_object('protocol_id', NEW.id, 'learner_id', NEW.learner_id, 'old_status', OLD.status, 'new_status', NEW.status), NOW());
  END IF;
  RETURN NEW;
END; $$;


--
-- Name: trg_fn_session_aba_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_fn_session_aba_audit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status IN ('in_progress', 'completed', 'cancelled')
  THEN
    INSERT INTO axis_audit_logs (
      tenant_id,
      user_id,
      actor,
      action,
      entity_type,
      metadata,
      created_at
    ) VALUES (
      NEW.tenant_id,
      NEW.therapist_id,
      'system',
      CASE NEW.status
        WHEN 'in_progress' THEN 'SESSION_ABA_START'
        WHEN 'completed'   THEN 'SESSION_ABA_END'
        ELSE                    'SESSION_ABA_CANCELLED'
      END,
      'sessions_aba',
      jsonb_build_object(
        'session_id', NEW.id,
        'learner_id', NEW.learner_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: trg_fn_summary_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_fn_summary_audit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
    VALUES (NEW.tenant_id, COALESCE(current_setting('app.user_id', true),'system'), 'system',
      'SUMMARY_STATUS_CHANGE', 'session_summaries',
      jsonb_build_object('summary_id', NEW.id, 'session_id', NEW.session_id, 'old_status', OLD.status, 'new_status', NEW.status), NOW());
  END IF;
  RETURN NEW;
END; $$;


--
-- Name: trg_fn_validate_clinical_state_cso(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_fn_validate_clinical_state_cso() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_expected NUMERIC(5,2);
BEGIN
  v_expected := calculate_cso_aba(NEW.sas, NEW.pis, NEW.bss, NEW.tcm);

  IF ABS(NEW.cso_aba - v_expected) > 0.01 THEN
    RAISE EXCEPTION
      '[AXIS ABA] cso_aba inconsistente em clinical_states_aba. Informado: %, Esperado: % (SAS=%, PIS=%, BSS=%, TCM=%).',
      NEW.cso_aba, v_expected, NEW.sas, NEW.pis, NEW.bss, NEW.tcm;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: trg_fn_validate_protocol_transition(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_fn_validate_protocol_transition() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_allowed BOOLEAN := FALSE;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  v_allowed :=
    (OLD.status = 'draft'              AND NEW.status IN ('active', 'discontinued'))                  OR
    (OLD.status = 'active'             AND NEW.status IN ('mastered', 'suspended', 'discontinued'))   OR
    (OLD.status = 'mastered'           AND NEW.status IN ('generalization', 'suspended'))             OR
    (OLD.status = 'generalization'     AND NEW.status IN ('mastered_validated', 'maintained', 'active')) OR
    (OLD.status = 'mastered_validated' AND NEW.status IN ('maintenance', 'maintained', 'active'))     OR
    (OLD.status = 'maintenance'        AND NEW.status IN ('maintained', 'active'))                    OR
    (OLD.status = 'maintained'         AND NEW.status IN ('archived', 'active'))                      OR
    (OLD.status = 'suspended'          AND NEW.status IN ('active', 'discontinued'));

  IF NOT v_allowed THEN
    RAISE EXCEPTION '[AXIS ABA] Transicao invalida: "%" -> "%". Consulte Bible v2.6.1 §3.2.', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: trg_fn_validate_snapshot_cso(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_fn_validate_snapshot_cso() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_expected NUMERIC(5,2);
BEGIN
  v_expected := calculate_cso_aba(NEW.sas, NEW.pis, NEW.bss, NEW.tcm);

  IF ABS(NEW.cso_aba - v_expected) > 0.01 THEN
    RAISE EXCEPTION
      '[AXIS ABA] cso_aba inconsistente no snapshot. Informado: %, Esperado: % (SAS=%, PIS=%, BSS=%, TCM=%).',
      NEW.cso_aba, v_expected, NEW.sas, NEW.pis, NEW.bss, NEW.tcm;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: validate_guardian_learner(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_guardian_learner(p_guardian_id uuid, p_learner_id uuid, p_tenant_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM guardians
    WHERE id = p_guardian_id AND tenant_id = p_tenant_id AND learner_id = p_learner_id
  ) THEN
    RAISE EXCEPTION '[AXIS ABA] Responsável % não é responsável do aprendiz % neste tenant.', p_guardian_id, p_learner_id;
  END IF;
END;
$$;


--
-- Name: _migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migrations (
    id integer NOT NULL,
    version character varying(10) NOT NULL,
    name character varying(255) NOT NULL,
    filename character varying(255) NOT NULL,
    checksum character varying(64) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    duration_ms integer,
    applied_by character varying(64) DEFAULT NULL::character varying
);


--
-- Name: TABLE _migrations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public._migrations IS 'Controle de migrações SQL — AXIS. NÃO editar manualmente.';


--
-- Name: COLUMN _migrations.applied_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public._migrations.applied_by IS 'Quem rodou a migration ($USER ou manual-pre-bootstrap). NULL = pré-runner.';


--
-- Name: _migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public._migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: _migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public._migrations_id_seq OWNED BY public._migrations.id;


--
-- Name: analyze_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analyze_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id character varying NOT NULL,
    route character varying(32) NOT NULL,
    tokens_used integer DEFAULT 0 NOT NULL,
    model character varying(64) DEFAULT 'gpt-4o-mini'::character varying NOT NULL,
    patient_id uuid,
    transcript_length integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT analyze_usage_route_check CHECK (((route)::text = ANY ((ARRAY['analyze-clinical'::character varying, 'analyze-tcc'::character varying])::text[])))
);

ALTER TABLE ONLY public.analyze_usage FORCE ROW LEVEL SECURITY;


--
-- Name: assist_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assist_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    assist_suggestion_id uuid,
    entity_type text,
    entity_id uuid,
    assistant_action text,
    user_decision text,
    user_comment text,
    context_snapshot jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: assist_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assist_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid,
    session_id uuid,
    block_type text NOT NULL,
    title text NOT NULL,
    description text,
    suggested_action text,
    reason text,
    confidence double precision,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT now(),
    resolved_at timestamp without time zone
);


--
-- Name: axis_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.axis_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id text NOT NULL,
    actor text DEFAULT 'human'::text NOT NULL,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    metadata jsonb,
    axis_version text DEFAULT '1.0.0'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE axis_audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.axis_audit_logs IS 'AXIS_AUDIT_FRAMEWORK_v1.0 - Registro de decisões humanas sem conteúdo clínico';


--
-- Name: calendar_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id text NOT NULL,
    provider text DEFAULT 'google'::text NOT NULL,
    calendar_id text DEFAULT 'primary'::text NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    token_expiry timestamp with time zone,
    scope text,
    sync_enabled boolean DEFAULT true,
    create_events_on_axis boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    webhook_channel_id text,
    webhook_resource_id text,
    webhook_expiration timestamp with time zone,
    webhook_token text
);


--
-- Name: COLUMN calendar_connections.webhook_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.calendar_connections.webhook_token IS 'Segredo HMAC-SHA256 para validação de webhook. Gerado no watch, verificado no handler.';


--
-- Name: calendar_sync_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_sync_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id text NOT NULL,
    provider text DEFAULT 'google'::text NOT NULL,
    calendar_id text DEFAULT 'primary'::text NOT NULL,
    sync_token text,
    last_full_sync_at timestamp with time zone,
    last_sync_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: case_bases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_bases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    chief_complaint text,
    identified_pattern text,
    triggers text,
    core_belief text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.case_bases FORCE ROW LEVEL SECURITY;


--
-- Name: claim_packet_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.claim_packet_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    packet_id uuid NOT NULL,
    item_type text NOT NULL,
    item_ref_id uuid,
    item_hash text,
    item_status text DEFAULT 'included'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT claim_packet_items_item_status_check CHECK ((item_status = ANY (ARRAY['included'::text, 'missing'::text, 'expired'::text, 'not_applicable'::text]))),
    CONSTRAINT claim_packet_items_item_type_check CHECK ((item_type = ANY (ARRAY['clinical_report'::text, 'session_evidence'::text, 'prescription'::text, 'pei'::text, 'team_roster'::text, 'consent'::text, 'coverage_auth'::text, 'other'::text])))
);


--
-- Name: claim_packets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.claim_packets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    coverage_id uuid,
    packet_type text DEFAULT 'monthly'::text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    packet_status text DEFAULT 'draft'::text NOT NULL,
    packet_hash text,
    total_sessions integer DEFAULT 0 NOT NULL,
    sessions_with_full_proof integer DEFAULT 0 NOT NULL,
    sessions_with_partial_proof integer DEFAULT 0 NOT NULL,
    sessions_with_exception integer DEFAULT 0 NOT NULL,
    completeness_pct numeric(5,2),
    version integer DEFAULT 1 NOT NULL,
    supersedes_id uuid,
    generated_at timestamp with time zone,
    generated_by uuid,
    submitted_at timestamp with time zone,
    returned_at timestamp with time zone,
    return_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT claim_packets_packet_status_check CHECK ((packet_status = ANY (ARRAY['draft'::text, 'ready'::text, 'submitted'::text, 'returned'::text, 'accepted'::text, 'disputed'::text]))),
    CONSTRAINT claim_packets_packet_type_check CHECK ((packet_type = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'guide'::text, 'custom'::text])))
);


--
-- Name: clinic_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    doc_type text NOT NULL,
    filename text NOT NULL,
    file_path text NOT NULL,
    file_size_bytes integer,
    mime_type text,
    uploaded_by uuid,
    verified boolean DEFAULT false,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: clinical_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    complaint text,
    patterns text,
    interventions text,
    current_state text,
    original_transcript text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.clinical_records FORCE ROW LEVEL SECURITY;


--
-- Name: clinical_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    cso_version text DEFAULT 'CSO_v2.0'::text NOT NULL,
    clinical_phase text NOT NULL,
    activation_level double precision,
    activation_level_source text,
    activation_confidence double precision,
    cognitive_rigidity double precision,
    emotional_load double precision,
    emotional_load_source text,
    emotional_confidence double precision,
    task_adherence double precision,
    task_adherence_source text,
    adherence_confidence double precision,
    engagement_trend text,
    risk_flags text[] DEFAULT '{}'::text[],
    treatment_phase text,
    sessions_in_phase integer DEFAULT 0,
    system_confidence double precision,
    source_event text,
    created_at timestamp without time zone DEFAULT now(),
    flex_trend text DEFAULT 'flat'::text,
    recovery_time integer,
    event_hash character varying(64)
);

ALTER TABLE ONLY public.clinical_states FORCE ROW LEVEL SECURITY;


--
-- Name: clinical_states_aba; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_states_aba (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    session_id uuid,
    sas numeric(5,2) NOT NULL,
    pis numeric(5,2) NOT NULL,
    bss numeric(5,2) NOT NULL,
    tcm numeric(5,2) NOT NULL,
    cso_aba numeric(5,2) NOT NULL,
    cso_band character varying(20),
    engine_version character varying(20) NOT NULL,
    calculated_by character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clinical_states_aba_bss_check CHECK (((bss >= (0)::numeric) AND (bss <= (100)::numeric))),
    CONSTRAINT clinical_states_aba_cso_aba_check CHECK (((cso_aba >= (0)::numeric) AND (cso_aba <= (100)::numeric))),
    CONSTRAINT clinical_states_aba_cso_band_check CHECK (((cso_band)::text = ANY ((ARRAY['excelente'::character varying, 'bom'::character varying, 'atencao'::character varying, 'critico'::character varying])::text[]))),
    CONSTRAINT clinical_states_aba_pis_check CHECK (((pis >= (0)::numeric) AND (pis <= (100)::numeric))),
    CONSTRAINT clinical_states_aba_sas_check CHECK (((sas >= (0)::numeric) AND (sas <= (100)::numeric))),
    CONSTRAINT clinical_states_aba_tcm_check CHECK (((tcm >= (0)::numeric) AND (tcm <= (100)::numeric)))
);

ALTER TABLE ONLY public.clinical_states_aba FORCE ROW LEVEL SECURITY;


--
-- Name: clinical_states_tdah; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_states_tdah (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    engine_name character varying(20) DEFAULT 'CSO-TDAH'::character varying NOT NULL,
    engine_version character varying(20) NOT NULL,
    calculation_contract_version character varying(20),
    audhd_layer_status public.audhd_layer_status_enum NOT NULL,
    core_score numeric(5,2),
    executive_score numeric(5,2),
    audhd_layer_score numeric(5,2),
    final_score numeric(5,2),
    final_band public.tdah_final_band_enum NOT NULL,
    confidence_flag public.tdah_confidence_enum NOT NULL,
    missing_data_primary_flag character varying(30) DEFAULT 'none'::character varying NOT NULL,
    missing_data_flags_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    source_contexts_json jsonb NOT NULL,
    core_metrics_json jsonb,
    executive_metrics_json jsonb,
    audhd_metrics_json jsonb,
    audhd_flags_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clinical_states_tdah_missing_data_primary_flag_check CHECK (((missing_data_primary_flag)::text = ANY ((ARRAY['none'::character varying, 'partial_context'::character varying, 'insufficient_data'::character varying, 'layer_data_missing'::character varying])::text[])))
);


--
-- Name: TABLE clinical_states_tdah; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.clinical_states_tdah IS 'Estado clínico APPEND-ONLY do CSO-TDAH — Bible Anexo G §G2';


--
-- Name: COLUMN clinical_states_tdah.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.clinical_states_tdah.created_at IS 'APPEND-ONLY: nunca UPDATE, nunca DELETE';


--
-- Name: compliance_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_checklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    item_key text NOT NULL,
    label text NOT NULL,
    accepted boolean DEFAULT false,
    accepted_by uuid,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: convenio_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.convenio_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    report_snapshot_id uuid,
    period_start date NOT NULL,
    period_end date NOT NULL,
    cid_code character varying(20),
    total_sessions smallint,
    total_hours numeric(6,2),
    cso_aba_avg numeric(5,2),
    justificativa_text text,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    generated_by character varying(255) NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    finalized_at timestamp with time zone,
    ans_reference character varying(100),
    sbni_reference character varying(100),
    CONSTRAINT convenio_reports_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'finalized'::character varying, 'submitted'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);

ALTER TABLE ONLY public.convenio_reports FORCE ROW LEVEL SECURITY;


--
-- Name: ebp_practices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ebp_practices (
    id integer NOT NULL,
    practice_number smallint NOT NULL,
    name character varying(255) NOT NULL,
    name_pt character varying(255) NOT NULL,
    domain character varying(100) NOT NULL,
    description text NOT NULL,
    evidence_level character varying(50),
    fpg_reference character varying(100),
    sbni_reference character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT ebp_practices_practice_number_check CHECK (((practice_number >= 1) AND (practice_number <= 28)))
);


--
-- Name: ebp_practices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ebp_practices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ebp_practices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ebp_practices_id_seq OWNED BY public.ebp_practices.id;


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    recipient_email character varying(255) NOT NULL,
    subject character varying(500) NOT NULL,
    template character varying(100),
    related_type character varying(100),
    related_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    sent_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_logs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: engine_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engine_versions (
    id integer NOT NULL,
    version character varying(20) NOT NULL,
    description text NOT NULL,
    effective_date date NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true,
    engine_name character varying(20),
    weights jsonb
);


--
-- Name: engine_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.engine_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: engine_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.engine_versions_id_seq OWNED BY public.engine_versions.id;


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb,
    source text,
    related_entity_id uuid,
    created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE ONLY public.events FORCE ROW LEVEL SECURITY;


--
-- Name: exposure_hierarchies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exposure_hierarchies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    name text NOT NULL,
    target_fear text NOT NULL,
    goal text,
    status text DEFAULT 'ativa'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

ALTER TABLE ONLY public.exposure_hierarchies FORCE ROW LEVEL SECURITY;


--
-- Name: exposure_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exposure_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hierarchy_id uuid NOT NULL,
    description text NOT NULL,
    suds_initial integer,
    suds_current integer,
    "position" integer NOT NULL,
    status text DEFAULT 'não_iniciado'::text,
    attempts integer DEFAULT 0,
    last_attempt_date date,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT exposure_items_suds_current_check CHECK (((suds_current >= 0) AND (suds_current <= 100))),
    CONSTRAINT exposure_items_suds_initial_check CHECK (((suds_initial >= 0) AND (suds_initial <= 100)))
);


--
-- Name: family_portal_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_portal_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    guardian_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    access_token text,
    token_expires_at timestamp with time zone,
    last_accessed_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    activated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    consent_id uuid NOT NULL
);

ALTER TABLE ONLY public.family_portal_access FORCE ROW LEVEL SECURITY;


--
-- Name: generalization_probes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generalization_probes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    protocol_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    variation_number integer NOT NULL,
    context_number integer NOT NULL,
    variation_desc character varying(500),
    context_desc character varying(255),
    trials_total integer DEFAULT 10 NOT NULL,
    trials_correct integer DEFAULT 0 NOT NULL,
    score_pct numeric(5,2),
    prompt_level character varying(50) DEFAULT 'independent'::character varying,
    notes text,
    evaluated_by character varying(255) DEFAULT 'system'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT generalization_probes_context_number_check CHECK (((context_number >= 1) AND (context_number <= 2))),
    CONSTRAINT generalization_probes_score_pct_check CHECK (((score_pct >= (0)::numeric) AND (score_pct <= (100)::numeric))),
    CONSTRAINT generalization_probes_variation_number_check CHECK (((variation_number >= 1) AND (variation_number <= 3)))
);


--
-- Name: guardian_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guardian_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    guardian_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    consent_type public.aba_consent_type NOT NULL,
    consent_version character varying(20) DEFAULT '1.0'::character varying NOT NULL,
    ip_address inet NOT NULL,
    accepted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);

ALTER TABLE ONLY public.guardian_consents FORCE ROW LEVEL SECURITY;


--
-- Name: guardians; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guardians (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(30),
    relationship character varying(100),
    clerk_user_id character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.guardians FORCE ROW LEVEL SECURITY;


--
-- Name: integrity_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integrity_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    rule_code text NOT NULL,
    severity text NOT NULL,
    description text NOT NULL,
    metadata jsonb,
    first_detected_at timestamp with time zone DEFAULT now() NOT NULL,
    last_detected_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    auto_resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT integrity_flags_entity_type_check CHECK ((entity_type = ANY (ARRAY['session'::text, 'provider'::text, 'packet'::text, 'learner'::text, 'coverage'::text]))),
    CONSTRAINT integrity_flags_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text]))),
    CONSTRAINT integrity_flags_status_check CHECK ((status = ANY (ARRAY['open'::text, 'reviewing'::text, 'resolved'::text, 'waived'::text])))
);


--
-- Name: learner_coverage_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_coverage_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    learner_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    payer_profile_id uuid,
    payer_name text NOT NULL,
    authorization_code text,
    authorized_hours_week numeric(4,1),
    start_date date NOT NULL,
    end_date date,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT learner_coverage_profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'expired'::text, 'suspended'::text])))
);


--
-- Name: learner_protocols; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_protocols (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    protocol_library_id uuid,
    pei_goal_id uuid,
    title character varying(500) NOT NULL,
    ebp_practice_id integer NOT NULL,
    domain character varying(100) NOT NULL,
    objective text NOT NULL,
    mastery_criteria_pct smallint DEFAULT 80 NOT NULL,
    mastery_criteria_sessions smallint DEFAULT 3 NOT NULL,
    mastery_criteria_trials smallint DEFAULT 10 NOT NULL,
    measurement_type character varying(100),
    status public.aba_protocol_status DEFAULT 'draft'::public.aba_protocol_status NOT NULL,
    generalization_status public.aba_generalization_status DEFAULT 'pending'::public.aba_generalization_status NOT NULL,
    regression_count smallint DEFAULT 0 NOT NULL,
    regression_type public.aba_regression_type,
    activated_at timestamp with time zone,
    mastered_at timestamp with time zone,
    generalized_at timestamp with time zone,
    maintained_at timestamp with time zone,
    suspended_at timestamp with time zone,
    discontinued_at timestamp with time zone,
    archived_at timestamp with time zone,
    suspend_reason text,
    discontinuation_reason text,
    protocol_engine_version character varying(20) NOT NULL,
    created_by character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mastered_validated_at timestamp with time zone,
    generalization_started_at timestamp with time zone,
    generalization_completed_at timestamp with time zone,
    maintenance_started_at timestamp with time zone,
    CONSTRAINT ck_archived_requires_maintained CHECK (((status <> 'archived'::public.aba_protocol_status) OR (maintained_at IS NOT NULL))),
    CONSTRAINT ck_discontinued_requires_reason CHECK (((status <> 'discontinued'::public.aba_protocol_status) OR (discontinuation_reason IS NOT NULL))),
    CONSTRAINT learner_protocols_mastery_criteria_pct_check CHECK (((mastery_criteria_pct >= 1) AND (mastery_criteria_pct <= 100)))
);

ALTER TABLE ONLY public.learner_protocols FORCE ROW LEVEL SECURITY;


--
-- Name: learner_support_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_support_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    learner_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    support_level smallint NOT NULL,
    changed_by character varying(255) NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    reason text,
    CONSTRAINT learner_support_levels_support_level_check CHECK ((support_level = ANY (ARRAY[1, 2, 3])))
);

ALTER TABLE ONLY public.learner_support_levels FORCE ROW LEVEL SECURITY;


--
-- Name: learner_therapists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_therapists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid,
    is_primary boolean DEFAULT false,
    role_in_case text,
    weekly_hours numeric(4,1),
    start_date date,
    end_date date,
    CONSTRAINT learner_therapists_role_in_case_check CHECK (((role_in_case IS NULL) OR (role_in_case = ANY (ARRAY['supervisor_clinico'::text, 'terapeuta_aba'::text, 'fono'::text, 'to'::text, 'psicopedagoga'::text]))))
);


--
-- Name: learners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    birth_date date NOT NULL,
    diagnosis character varying(500),
    cid_code character varying(20),
    support_level smallint DEFAULT 2 NOT NULL,
    school character varying(255),
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    cid_system character varying(10) DEFAULT 'CID-10'::character varying,
    cid_label character varying(200),
    CONSTRAINT learners_support_level_check CHECK ((support_level = ANY (ARRAY[1, 2, 3])))
);

ALTER TABLE ONLY public.learners FORCE ROW LEVEL SECURITY;


--
-- Name: maintenance_probes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_probes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    protocol_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    week_number integer NOT NULL,
    label character varying(100) NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    result character varying(20),
    trials_total integer,
    trials_correct integer DEFAULT 0,
    score_pct numeric(5,2),
    prompt_level character varying(50) DEFAULT 'independent'::character varying,
    notes text,
    evaluated_by character varying(255),
    evaluated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT maintenance_probes_result_check CHECK (((result)::text = ANY ((ARRAY['passed'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT maintenance_probes_score_pct_check CHECK (((score_pct >= (0)::numeric) AND (score_pct <= (100)::numeric))),
    CONSTRAINT maintenance_probes_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying])::text[]))),
    CONSTRAINT maintenance_probes_week_number_check CHECK ((week_number = ANY (ARRAY[2, 6, 12])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    recipient_id character varying(255) NOT NULL,
    notification_type character varying(50) NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    idempotency_key character varying(255),
    sent_at timestamp with time zone,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_notification_type_check CHECK (((notification_type)::text = ANY ((ARRAY['session_reminder'::character varying, 'maintenance_due'::character varying, 'regression_alert'::character varying, 'summary_approved'::character varying, 'portal_access_granted'::character varying, 'general'::character varying])::text[]))),
    CONSTRAINT notifications_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'failed'::character varying, 'read'::character varying])::text[])))
);


--
-- Name: onboarding_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_progress (
    id integer NOT NULL,
    tenant_id uuid,
    step integer DEFAULT 1,
    data jsonb DEFAULT '{}'::jsonb,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    current_step integer DEFAULT 1
);


--
-- Name: onboarding_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.onboarding_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: onboarding_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.onboarding_progress_id_seq OWNED BY public.onboarding_progress.id;


--
-- Name: patient_onboarding_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_onboarding_status (
    patient_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    has_initial_assessment boolean DEFAULT false,
    has_treatment_goals boolean DEFAULT false,
    has_first_hierarchy boolean DEFAULT false,
    minimum_sessions_completed integer DEFAULT 0,
    ready_for_suggestions boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: patient_push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    fcm_token text NOT NULL,
    consent_given_at timestamp with time zone DEFAULT now() NOT NULL,
    device_info text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    external_ref text,
    preferred_session_type text DEFAULT 'sem_preferencia'::text,
    preferred_days text[] DEFAULT '{}'::text[],
    preferred_times text[] DEFAULT '{}'::text[],
    contact_preference text DEFAULT 'whatsapp'::text,
    reminder_advance_hours integer DEFAULT 24,
    treatment_phase text DEFAULT 'avaliação'::text,
    sessions_completed integer DEFAULT 0,
    requires_extra_care boolean DEFAULT false,
    observation_mode boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    full_name text NOT NULL,
    email text,
    phone text,
    birth_date date,
    notes text,
    gender text,
    diagnosis text,
    medication text,
    push_auth_token text,
    supervision_context text,
    push_auth_token_expires_at timestamp with time zone
);

ALTER TABLE ONLY public.patients FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN patients.full_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.patients.full_name IS 'Nome completo do paciente (TCC)';


--
-- Name: COLUMN patients.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.patients.email IS 'Email do paciente (opcional, usado para portal família)';


--
-- Name: COLUMN patients.phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.patients.phone IS 'Telefone do paciente (opcional)';


--
-- Name: COLUMN patients.birth_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.patients.birth_date IS 'Data de nascimento (opcional)';


--
-- Name: COLUMN patients.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.patients.notes IS 'Observações livres do profissional';


--
-- Name: COLUMN patients.gender; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.patients.gender IS 'Gênero do paciente (opcional)';


--
-- Name: COLUMN patients.diagnosis; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.patients.diagnosis IS 'Diagnóstico clínico (opcional)';


--
-- Name: COLUMN patients.medication; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.patients.medication IS 'Medicação em uso (opcional)';


--
-- Name: payer_requirement_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payer_requirement_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    payer_name text NOT NULL,
    payer_code text,
    requires_geo boolean DEFAULT false NOT NULL,
    geo_level text DEFAULT 'none'::text NOT NULL,
    requires_guardian_attestation boolean DEFAULT false NOT NULL,
    guardian_attestation_deadline_hours integer DEFAULT 72 NOT NULL,
    requires_photo boolean DEFAULT false NOT NULL,
    requires_attachment_per_guide boolean DEFAULT false NOT NULL,
    report_frequency_days integer DEFAULT 90 NOT NULL,
    report_template text DEFAULT 'standard'::text NOT NULL,
    requires_team_roster boolean DEFAULT true NOT NULL,
    requires_prescription boolean DEFAULT true NOT NULL,
    requires_pei boolean DEFAULT false NOT NULL,
    requires_coverage_auth boolean DEFAULT false NOT NULL,
    cid_version text DEFAULT 'CID-10'::text NOT NULL,
    max_file_size_mb integer DEFAULT 10 NOT NULL,
    accepted_formats text[] DEFAULT '{pdf,jpg,png}'::text[] NOT NULL,
    checklist_items jsonb,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payer_requirement_profiles_cid_version_check CHECK ((cid_version = ANY (ARRAY['CID-10'::text, 'CID-11'::text, 'both'::text]))),
    CONSTRAINT payer_requirement_profiles_geo_level_check CHECK ((geo_level = ANY (ARRAY['none'::text, 'light'::text, 'standard'::text, 'strict'::text])))
);


--
-- Name: payer_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payer_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    packet_id uuid NOT NULL,
    packet_version integer NOT NULL,
    tenant_id uuid NOT NULL,
    submission_method text DEFAULT 'portal'::text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_by uuid NOT NULL,
    response_status text,
    response_at timestamp with time zone,
    response_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payer_submissions_response_status_check CHECK (((response_status IS NULL) OR (response_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'partial'::text])))),
    CONSTRAINT payer_submissions_submission_method_check CHECK ((submission_method = ANY (ARRAY['portal'::text, 'email'::text, 'physical'::text, 'api'::text])))
);


--
-- Name: pei_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pei_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pei_plan_id uuid NOT NULL,
    title character varying(500) NOT NULL,
    domain character varying(100) NOT NULL,
    target_pct smallint DEFAULT 80 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pei_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pei_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    title character varying(500) NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    created_by character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pei_plans_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'completed'::character varying, 'archived'::character varying])::text[])))
);

ALTER TABLE ONLY public.pei_plans FORCE ROW LEVEL SECURITY;


--
-- Name: professional_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.professional_preferences (
    tenant_id uuid NOT NULL,
    block_checkin boolean DEFAULT false,
    block_agenda boolean DEFAULT false,
    max_suggestions_per_month integer DEFAULT 20,
    silence_mode boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    clerk_user_id text NOT NULL,
    role text DEFAULT 'terapeuta'::text NOT NULL,
    name text,
    crp text,
    specialty text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    email text,
    crp_uf text,
    invited_by uuid,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'supervisor'::text, 'terapeuta'::text])))
);


--
-- Name: protocol_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.protocol_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    title character varying(500) NOT NULL,
    ebp_practice_id integer NOT NULL,
    domain character varying(100) NOT NULL,
    objective text NOT NULL,
    mastery_criteria_pct smallint DEFAULT 80 NOT NULL,
    mastery_criteria_sessions smallint DEFAULT 3 NOT NULL,
    mastery_criteria_trials smallint DEFAULT 10 NOT NULL,
    measurement_type character varying(100),
    is_template boolean DEFAULT true NOT NULL,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ebp_practice_name text,
    default_mastery_pct integer DEFAULT 80,
    default_mastery_sessions integer DEFAULT 3,
    default_mastery_trials integer DEFAULT 10,
    difficulty_level integer DEFAULT 1,
    tags text[],
    is_active boolean DEFAULT true,
    CONSTRAINT protocol_library_mastery_criteria_pct_check CHECK (((mastery_criteria_pct >= 1) AND (mastery_criteria_pct <= 100)))
);


--
-- Name: provider_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    full_name text NOT NULL,
    council_type text DEFAULT 'CRP'::text NOT NULL,
    council_number text NOT NULL,
    council_uf text NOT NULL,
    council_valid_until date,
    specializations text[] DEFAULT '{}'::text[],
    education_level text DEFAULT 'graduacao'::text NOT NULL,
    role_in_team text DEFAULT 'terapeuta'::text NOT NULL,
    weekly_hours_total numeric(4,1),
    is_credentialed boolean DEFAULT false NOT NULL,
    credential_code text,
    credential_status text DEFAULT 'pending'::text NOT NULL,
    documents_complete boolean DEFAULT false NOT NULL,
    last_verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT provider_credentials_council_type_check CHECK ((council_type = ANY (ARRAY['CRP'::text, 'CRFa'::text, 'CREFITO'::text, 'CRM'::text, 'BCBA'::text, 'other'::text]))),
    CONSTRAINT provider_credentials_credential_status_check CHECK ((credential_status = ANY (ARRAY['active'::text, 'pending'::text, 'expired'::text, 'blocked'::text]))),
    CONSTRAINT provider_credentials_education_level_check CHECK ((education_level = ANY (ARRAY['graduacao'::text, 'especializacao'::text, 'mestrado'::text, 'doutorado'::text]))),
    CONSTRAINT provider_credentials_role_in_team_check CHECK ((role_in_team = ANY (ARRAY['supervisor'::text, 'terapeuta'::text, 'fono'::text, 'to'::text, 'psicopedagoga'::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    device_info jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_type text DEFAULT 'professional'::text NOT NULL,
    user_id text NOT NULL,
    fcm_token text NOT NULL,
    device_info text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: rag_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rag_config (
    tenant_id uuid NOT NULL,
    lookback_months integer DEFAULT 12,
    decay_enabled boolean DEFAULT true,
    decay_half_life_months integer DEFAULT 6,
    index_sources text[] DEFAULT ARRAY['notes'::text, 'decisions'::text, 'tasks'::text],
    exclude_before date,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: report_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    learner_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    report_type public.aba_report_type NOT NULL,
    data_hash text NOT NULL,
    pdf_url text NOT NULL,
    generated_by character varying(255) NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    engine_version character varying(20) NOT NULL
);

ALTER TABLE ONLY public.report_snapshots FORCE ROW LEVEL SECURITY;


--
-- Name: scheduled_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    scheduled_time timestamp with time zone NOT NULL,
    message text NOT NULL,
    sent boolean DEFAULT false,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    session_id uuid,
    user_id text,
    reminder_type text DEFAULT 'session'::text,
    title text,
    recipient_type text DEFAULT 'patient'::text,
    recipient_id uuid
);


--
-- Name: service_sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    site_name text NOT NULL,
    site_type text DEFAULT 'clinic'::text NOT NULL,
    address_encrypted bytea,
    latitude numeric(10,7),
    longitude numeric(10,7),
    radius_meters integer DEFAULT 200 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_sites_radius_meters_check CHECK (((radius_meters >= 50) AND (radius_meters <= 5000))),
    CONSTRAINT service_sites_site_type_check CHECK ((site_type = ANY (ARRAY['clinic'::text, 'home'::text, 'school'::text, 'telehealth'::text, 'community'::text, 'other'::text])))
);


--
-- Name: session_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    attachment_type text NOT NULL,
    file_name text NOT NULL,
    file_hash text NOT NULL,
    file_size_bytes integer NOT NULL,
    mime_type text NOT NULL,
    storage_path text NOT NULL,
    extracted_geo_encrypted bytea,
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_attachments_attachment_type_check CHECK ((attachment_type = ANY (ARRAY['photo_checkin'::text, 'photo_checkout'::text, 'document'::text, 'prescription'::text, 'other'::text]))),
    CONSTRAINT session_attachments_file_size_bytes_check CHECK (((file_size_bytes > 0) AND (file_size_bytes <= 10485760))),
    CONSTRAINT session_attachments_mime_type_check CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'application/pdf'::text])))
);


--
-- Name: session_attestations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_attestations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    attestor_type text NOT NULL,
    attestor_id text NOT NULL,
    attestor_name text NOT NULL,
    attestor_document_masked text,
    attestation_method text NOT NULL,
    attestation_hash text NOT NULL,
    ip_address_encrypted bytea,
    user_agent text,
    canvas_data_encrypted bytea,
    magic_link_token text,
    status text DEFAULT 'pending'::text NOT NULL,
    attested_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_attestations_attestation_method_check CHECK ((attestation_method = ANY (ARRAY['system_login'::text, 'otp_email'::text, 'magic_link'::text, 'canvas_signature'::text, 'external_certificate'::text, 'certified_timestamp'::text]))),
    CONSTRAINT session_attestations_attestor_type_check CHECK ((attestor_type = ANY (ARRAY['therapist'::text, 'supervisor'::text, 'guardian'::text]))),
    CONSTRAINT session_attestations_status_check CHECK ((status = ANY (ARRAY['completed'::text, 'pending'::text, 'expired'::text])))
);


--
-- Name: session_evidence_bundles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_evidence_bundles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    bundle_hash text NOT NULL,
    components jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'partial'::text NOT NULL,
    missing_items text[] DEFAULT '{}'::text[],
    version integer DEFAULT 1 NOT NULL,
    supersedes_id uuid,
    generated_at timestamp with time zone NOT NULL,
    generated_by text DEFAULT 'system'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_evidence_bundles_generated_by_check CHECK ((generated_by = ANY (ARRAY['system'::text, 'manual'::text]))),
    CONSTRAINT session_evidence_bundles_status_check CHECK ((status = ANY (ARRAY['complete'::text, 'partial'::text, 'exception'::text])))
);


--
-- Name: session_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    agenda_review text,
    mood_rating integer,
    mood_comparison text,
    bridge_summary text,
    main_themes text[] DEFAULT '{}'::text[],
    interventions_used text[] DEFAULT '{}'::text[],
    homework_review text,
    homework_assigned text,
    clinical_observations text,
    draft boolean DEFAULT true,
    reviewed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT session_notes_mood_rating_check CHECK (((mood_rating >= 0) AND (mood_rating <= 10)))
);

ALTER TABLE ONLY public.session_notes FORCE ROW LEVEL SECURITY;


--
-- Name: session_presence_proofs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_presence_proofs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    proof_type text NOT NULL,
    latitude_encrypted bytea,
    longitude_encrypted bytea,
    accuracy_meters numeric(8,2),
    altitude_meters numeric(8,2),
    distance_to_site_meters numeric(8,2),
    capture_source text DEFAULT 'browser_gps'::text NOT NULL,
    confidence_status text DEFAULT 'valid'::text NOT NULL,
    exception_reason text,
    device_hash text,
    ip_address_encrypted bytea,
    raw_payload_hash text,
    declared_site_id uuid,
    captured_at timestamp with time zone NOT NULL,
    captured_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_presence_proofs_capture_source_check CHECK ((capture_source = ANY (ARRAY['browser_gps'::text, 'app_gps'::text, 'manual_override'::text]))),
    CONSTRAINT session_presence_proofs_confidence_status_check CHECK ((confidence_status = ANY (ARRAY['valid'::text, 'warning'::text, 'exception'::text]))),
    CONSTRAINT session_presence_proofs_proof_type_check CHECK ((proof_type = ANY (ARRAY['checkin'::text, 'checkout'::text])))
);


--
-- Name: session_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    headline text,
    objectives text,
    summary text,
    intervention text,
    observations text,
    closing text,
    insights jsonb DEFAULT '{}'::jsonb,
    status character varying(20) DEFAULT 'draft'::character varying,
    generated_by character varying(20) DEFAULT 'ai'::character varying,
    ai_model character varying(50),
    generation_prompt_hash character varying(64),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    exported_at timestamp with time zone,
    export_count integer DEFAULT 0
);


--
-- Name: session_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    snapshot_json jsonb NOT NULL,
    sas numeric(5,2) NOT NULL,
    pis numeric(5,2) NOT NULL,
    bss numeric(5,2) NOT NULL,
    tcm numeric(5,2) NOT NULL,
    cso_aba numeric(5,2) NOT NULL,
    engine_version character varying(20) NOT NULL,
    closed_by character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_snapshots_bss_check CHECK (((bss >= (0)::numeric) AND (bss <= (100)::numeric))),
    CONSTRAINT session_snapshots_cso_aba_check CHECK (((cso_aba >= (0)::numeric) AND (cso_aba <= (100)::numeric))),
    CONSTRAINT session_snapshots_pis_check CHECK (((pis >= (0)::numeric) AND (pis <= (100)::numeric))),
    CONSTRAINT session_snapshots_sas_check CHECK (((sas >= (0)::numeric) AND (sas <= (100)::numeric))),
    CONSTRAINT session_snapshots_tcm_check CHECK (((tcm >= (0)::numeric) AND (tcm <= (100)::numeric)))
);

ALTER TABLE ONLY public.session_snapshots FORCE ROW LEVEL SECURITY;


--
-- Name: session_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    learner_id uuid NOT NULL,
    content text NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    created_by character varying(255) NOT NULL,
    approved_by character varying(255),
    approved_at timestamp with time zone,
    sent_at timestamp with time zone,
    email_log_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_module character varying(10) DEFAULT 'aba'::character varying,
    CONSTRAINT ck_sent_requires_approval CHECK ((((status)::text <> 'sent'::text) OR (approved_at IS NOT NULL))),
    CONSTRAINT session_summaries_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'sent'::character varying, 'rejected'::character varying])::text[])))
);

ALTER TABLE ONLY public.session_summaries FORCE ROW LEVEL SECURITY;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    session_type text DEFAULT 'presencial'::text NOT NULL,
    session_number integer NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    duration_minutes integer,
    status text DEFAULT 'agendada'::text NOT NULL,
    cancellation_reason text,
    agenda_items text[] DEFAULT '{}'::text[],
    bridge_from_last text,
    mood_check text,
    cso_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    time_source text DEFAULT 'manual'::text,
    reminders_sent integer DEFAULT 0,
    google_event_id text,
    google_calendar_id text,
    calendar_source text DEFAULT 'axis'::text,
    external_etag text,
    external_updated_at timestamp with time zone,
    google_meet_link text,
    patient_response text DEFAULT 'needsAction'::text
);

ALTER TABLE ONLY public.sessions FORCE ROW LEVEL SECURITY;


--
-- Name: suggestion_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suggestion_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    suggestion_id uuid NOT NULL,
    action text NOT NULL,
    edited_text text,
    cso_snapshot jsonb,
    engine_versions jsonb,
    user_id text,
    created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE ONLY public.suggestion_decisions FORCE ROW LEVEL SECURITY;


--
-- Name: suggestion_log_aba; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suggestion_log_aba (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    learner_id uuid,
    protocol_id uuid,
    session_id uuid,
    suggestion_type character varying(100) NOT NULL,
    content jsonb NOT NULL,
    confidence_score numeric(4,3),
    reviewed_by character varying(255),
    decision character varying(50),
    decision_notes text,
    reviewed_at timestamp with time zone,
    engine_version character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT suggestion_log_aba_confidence_score_check CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
    CONSTRAINT suggestion_log_aba_decision_check CHECK (((decision)::text = ANY ((ARRAY['accepted'::character varying, 'rejected'::character varying, 'deferred'::character varying])::text[])))
);

ALTER TABLE ONLY public.suggestion_log_aba FORCE ROW LEVEL SECURITY;


--
-- Name: suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    cso_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    reason text[] DEFAULT '{}'::text[],
    confidence double precision,
    context jsonb,
    engine_version text NOT NULL,
    ruleset_hash text,
    created_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone
);

ALTER TABLE ONLY public.suggestions FORCE ROW LEVEL SECURITY;


--
-- Name: system_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module text NOT NULL,
    severity text NOT NULL,
    source text NOT NULL,
    code text,
    message text NOT NULL,
    context jsonb DEFAULT '{}'::jsonb,
    resolved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    resolved_by text,
    CONSTRAINT system_alerts_module_check CHECK ((module = ANY (ARRAY['axis-tcc'::text, 'axis-aba'::text, 'axis-tdah'::text, 'shared'::text]))),
    CONSTRAINT system_alerts_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: TABLE system_alerts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.system_alerts IS 'Alertas internos do sistema. Nunca contém PII ou texto clínico.';


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    rationale text,
    difficulty_level integer,
    hierarchy_id uuid,
    hierarchy_position integer,
    status text DEFAULT 'pendente'::text NOT NULL,
    patient_feedback text,
    completion_quality integer,
    assigned_at timestamp without time zone DEFAULT now(),
    due_date date,
    confirmed_at timestamp without time zone,
    assigned_in_session_id uuid,
    reviewed_in_session_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT tasks_completion_quality_check CHECK (((completion_quality >= 1) AND (completion_quality <= 10))),
    CONSTRAINT tasks_difficulty_level_check CHECK (((difficulty_level >= 1) AND (difficulty_level <= 10)))
);


--
-- Name: tcc_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcc_analyses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    session_id uuid NOT NULL,
    facts jsonb DEFAULT '[]'::jsonb,
    thoughts jsonb DEFAULT '[]'::jsonb,
    emotions jsonb DEFAULT '[]'::jsonb,
    raw_transcription text,
    created_at timestamp with time zone DEFAULT now(),
    behaviors jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE ONLY public.tcc_analyses FORCE ROW LEVEL SECURITY;


--
-- Name: tdah_audhd_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_audhd_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    previous_status public.audhd_layer_status_enum,
    new_status public.audhd_layer_status_enum NOT NULL,
    changed_by uuid NOT NULL,
    reason text,
    engine_version character varying(20),
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.tdah_audhd_log FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE tdah_audhd_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tdah_audhd_log IS 'Log de ativação/desativação da Layer AuDHD — Bible §9.3, Anexo F';


--
-- Name: tdah_drc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_drc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    drc_date date NOT NULL,
    protocol_id uuid,
    goal_description text NOT NULL,
    goal_met boolean,
    score numeric(5,2),
    filled_by character varying(50),
    filled_by_name character varying(255),
    teacher_notes text,
    clinician_review_notes text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tdah_drc_filled_by_check CHECK (((filled_by IS NULL) OR ((filled_by)::text = ANY ((ARRAY['teacher'::character varying, 'mediator'::character varying, 'parent'::character varying, 'other'::character varying])::text[]))))
);

ALTER TABLE ONLY public.tdah_drc FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE tdah_drc; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tdah_drc IS 'Daily Report Card escolar — core do produto TDAH — Bible §17';


--
-- Name: tdah_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    antecedent text,
    behavior text,
    consequence text,
    description text,
    intensity character varying(20),
    context public.tdah_session_context_enum,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tdah_events_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['transition'::character varying, 'sensory'::character varying, 'behavioral'::character varying, 'abc'::character varying, 'task_avoidance'::character varying, 'task_engagement'::character varying, 'self_regulation'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT tdah_events_intensity_check CHECK (((intensity IS NULL) OR ((intensity)::text = ANY ((ARRAY['leve'::character varying, 'moderada'::character varying, 'alta'::character varying, 'severa'::character varying])::text[]))))
);

ALTER TABLE ONLY public.tdah_events FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE tdah_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tdah_events IS 'Eventos clínicos TDAH com ABC opcional — Bible §10';


--
-- Name: tdah_family_access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_family_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    token_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.tdah_family_access_log FORCE ROW LEVEL SECURITY;


--
-- Name: tdah_family_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_family_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    guardian_id uuid,
    token character varying(64) NOT NULL,
    guardian_name character varying(255) NOT NULL,
    guardian_email character varying(255),
    relationship character varying(50),
    consent_accepted_at timestamp with time zone,
    consent_version character varying(10) DEFAULT '1.0'::character varying,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_accessed_at timestamp with time zone,
    revoked_at timestamp with time zone,
    revoked_by uuid
);


--
-- Name: tdah_guardians; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_guardians (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    relationship character varying(50),
    is_primary boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.tdah_guardians FORCE ROW LEVEL SECURITY;


--
-- Name: tdah_observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_observations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    protocol_id uuid,
    task_block_number integer,
    task_description text,
    sas_score numeric(5,2),
    pis_level character varying(20),
    bss_level character varying(20),
    exr_level character varying(30),
    sen_level character varying(30),
    trf_level character varying(30),
    rig_state character varying(30),
    rig_severity character varying(20),
    msk_value numeric(5,2),
    msk_status character varying(30) DEFAULT 'validation_pending'::character varying,
    observation_notes text,
    observed_at timestamp with time zone DEFAULT now() NOT NULL,
    observed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tdah_observations_bss_level_check CHECK (((bss_level IS NULL) OR ((bss_level)::text = ANY ((ARRAY['estavel'::character varying, 'leve'::character varying, 'desregulado'::character varying])::text[])))),
    CONSTRAINT tdah_observations_exr_level_check CHECK (((exr_level IS NULL) OR ((exr_level)::text = ANY ((ARRAY['excelente'::character varying, 'adequado'::character varying, 'prejudicado'::character varying, 'severamente_prejudicado'::character varying])::text[])))),
    CONSTRAINT tdah_observations_msk_status_check CHECK (((msk_status IS NULL) OR ((msk_status)::text = ANY ((ARRAY['validation_pending'::character varying, 'valid'::character varying, 'missing'::character varying])::text[])))),
    CONSTRAINT tdah_observations_pis_level_check CHECK (((pis_level IS NULL) OR ((pis_level)::text = ANY ((ARRAY['independente'::character varying, 'minimo'::character varying, 'moderado'::character varying, 'total'::character varying])::text[])))),
    CONSTRAINT tdah_observations_rig_severity_check CHECK (((rig_severity IS NULL) OR ((rig_severity)::text = ANY ((ARRAY['none'::character varying, 'mild'::character varying, 'moderate'::character varying, 'high'::character varying])::text[])))),
    CONSTRAINT tdah_observations_rig_state_check CHECK (((rig_state IS NULL) OR ((rig_state)::text = ANY ((ARRAY['balanced'::character varying, 'rigidity_leaning'::character varying, 'impulsivity_leaning'::character varying, 'dual_risk'::character varying])::text[])))),
    CONSTRAINT tdah_observations_sen_level_check CHECK (((sen_level IS NULL) OR ((sen_level)::text = ANY ((ARRAY['ausente'::character varying, 'leve'::character varying, 'moderado'::character varying, 'severo'::character varying])::text[])))),
    CONSTRAINT tdah_observations_trf_level_check CHECK (((trf_level IS NULL) OR ((trf_level)::text = ANY ((ARRAY['ausente'::character varying, 'leve'::character varying, 'moderado'::character varying, 'severo'::character varying])::text[]))))
);

ALTER TABLE ONLY public.tdah_observations FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE tdah_observations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tdah_observations IS 'Observações por bloco de tarefa com 3 camadas — Bible §7-§9';


--
-- Name: COLUMN tdah_observations.rig_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tdah_observations.rig_state IS 'CATEGÓRICO: 4 estados, NUNCA escala linear — Bible §G3';


--
-- Name: COLUMN tdah_observations.msk_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tdah_observations.msk_value IS 'EM VALIDAÇÃO: campo opcional até piloto — Bible §9.6.4';


--
-- Name: tdah_patient_therapists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_patient_therapists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    is_primary boolean DEFAULT false,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid,
    role_in_case text
);

ALTER TABLE ONLY public.tdah_patient_therapists FORCE ROW LEVEL SECURITY;


--
-- Name: tdah_patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    birth_date date,
    gender character varying(20),
    diagnosis text,
    cid_code character varying(20),
    support_level character varying(20),
    audhd_layer_status public.audhd_layer_status_enum DEFAULT 'active_core'::public.audhd_layer_status_enum NOT NULL,
    audhd_layer_activated_by uuid,
    audhd_layer_activated_at timestamp with time zone DEFAULT now(),
    audhd_layer_reason text,
    audhd_layer_engine_version character varying(20) DEFAULT 'v1.0.0'::character varying,
    school_name character varying(255),
    school_contact character varying(255),
    teacher_name character varying(255),
    teacher_email character varying(255),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    deleted_at timestamp with time zone,
    clinical_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT tdah_patients_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'archived'::character varying])::text[])))
);

ALTER TABLE ONLY public.tdah_patients FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE tdah_patients; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tdah_patients IS 'Pacientes TDAH com Layer AuDHD — Bible v2.5 §1-§9';


--
-- Name: tdah_plan_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_plan_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    domain character varying(50) NOT NULL,
    goal_description text NOT NULL,
    target_criteria text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    progress numeric(5,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tdah_plan_goals_domain_check CHECK (((domain)::text = ANY ((ARRAY['atencao_sustentada'::character varying, 'inicio_tarefa'::character varying, 'permanencia_tarefa'::character varying, 'conclusao_tarefa'::character varying, 'seguimento_instrucao'::character varying, 'rotina_domestica'::character varying, 'rotina_escolar'::character varying, 'controle_inibitorio'::character varying, 'espera_turno'::character varying, 'organizacao'::character varying, 'autorregulacao'::character varying, 'transicoes'::character varying, 'integracao_contextual'::character varying, 'audhd'::character varying])::text[]))),
    CONSTRAINT tdah_plan_goals_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'achieved'::character varying, 'paused'::character varying, 'discontinued'::character varying])::text[])))
);

ALTER TABLE ONLY public.tdah_plan_goals FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE tdah_plan_goals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tdah_plan_goals IS 'Metas do plano com domínios clínicos — Bible §13';


--
-- Name: tdah_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    start_date date,
    end_date date,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT tdah_plans_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'completed'::character varying, 'archived'::character varying])::text[])))
);

ALTER TABLE ONLY public.tdah_plans FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE tdah_plans; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tdah_plans IS 'Plano TDAH por paciente';


--
-- Name: tdah_protocol_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_protocol_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    block character varying(10) NOT NULL,
    priority character varying(10) DEFAULT 'P1'::character varying NOT NULL,
    requires_audhd_layer boolean DEFAULT false,
    min_audhd_status character varying(20),
    description text,
    objective text,
    procedure_text text,
    measurement text,
    mastery_criteria text,
    regression_criteria text,
    generalization_criteria text,
    maintenance_criteria text,
    audhd_adaptation text,
    audhd_considerations text,
    domain character varying(50),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    bible_version character varying(10),
    system_fields jsonb,
    is_active boolean DEFAULT true,
    CONSTRAINT tdah_protocol_library_min_audhd_status_check CHECK (((min_audhd_status IS NULL) OR ((min_audhd_status)::text = ANY ((ARRAY['active_core'::character varying, 'active_full'::character varying])::text[])))),
    CONSTRAINT tdah_protocol_library_priority_check CHECK (((priority)::text = ANY ((ARRAY['P1'::character varying, 'P1.1'::character varying, 'P2'::character varying])::text[]))),
    CONSTRAINT tdah_protocol_library_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'deprecated'::character varying, 'draft'::character varying])::text[])))
);


--
-- Name: TABLE tdah_protocol_library; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tdah_protocol_library IS 'Biblioteca P1 de protocolos TDAH — Bible §20-§23, Anexo B';


--
-- Name: tdah_protocols; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_protocols (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    library_protocol_id uuid,
    code character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    block character varying(10) NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    requires_audhd_layer boolean DEFAULT false,
    audhd_adaptation_notes text,
    protocol_engine_version character varying(20) DEFAULT 'v1.0.0'::character varying NOT NULL,
    started_at timestamp with time zone,
    mastered_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT tdah_protocols_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'mastered'::character varying, 'generalization'::character varying, 'maintenance'::character varying, 'maintained'::character varying, 'regression'::character varying, 'suspended'::character varying, 'discontinued'::character varying, 'archived'::character varying])::text[])))
);

ALTER TABLE ONLY public.tdah_protocols FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE tdah_protocols; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tdah_protocols IS 'Protocolos ativos por paciente com ciclo de vida — Bible §12';


--
-- Name: tdah_routines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_routines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    routine_type character varying(50) NOT NULL,
    routine_name character varying(255) NOT NULL,
    steps_json jsonb,
    reinforcement_plan text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tdah_routines_routine_type_check CHECK (((routine_type)::text = ANY ((ARRAY['morning'::character varying, 'afternoon'::character varying, 'evening'::character varying, 'homework'::character varying, 'school_prep'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT tdah_routines_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'paused'::character varying, 'completed'::character varying, 'archived'::character varying])::text[])))
);

ALTER TABLE ONLY public.tdah_routines FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE tdah_routines; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tdah_routines IS 'Rotinas domésticas estruturadas — Bible §18';


--
-- Name: tdah_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    session_context public.tdah_session_context_enum DEFAULT 'clinical'::public.tdah_session_context_enum NOT NULL,
    session_number integer,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    duration_minutes integer,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    clinician_id uuid,
    therapist_id uuid,
    session_notes text,
    google_event_id character varying(255),
    google_calendar_id character varying(255),
    google_meet_link character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tdah_sessions_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'no_show'::character varying])::text[])))
);

ALTER TABLE ONLY public.tdah_sessions FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE tdah_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tdah_sessions IS 'Sessões TDAH tricontextuais (clinical/home/school) — Bible §16';


--
-- Name: tdah_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    snapshot_type public.tdah_snapshot_type_enum NOT NULL,
    session_id uuid,
    source_record_id uuid,
    engine_name character varying(20) DEFAULT 'CSO-TDAH'::character varying NOT NULL,
    engine_version character varying(20) NOT NULL,
    calculation_contract_version character varying(20),
    audhd_layer_status public.audhd_layer_status_enum NOT NULL,
    core_score numeric(5,2),
    executive_score numeric(5,2),
    audhd_layer_score numeric(5,2),
    final_score numeric(5,2),
    final_band public.tdah_final_band_enum NOT NULL,
    confidence_flag public.tdah_confidence_enum NOT NULL,
    missing_data_primary_flag character varying(30) NOT NULL,
    missing_data_flags_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    source_contexts_json jsonb NOT NULL,
    core_metrics_json jsonb,
    executive_metrics_json jsonb,
    audhd_metrics_json jsonb,
    audhd_flags_json jsonb,
    generated_by_type character varying(20) DEFAULT 'system'::character varying NOT NULL,
    generated_by_user_id uuid,
    snapshot_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_snapshot_override_author CHECK (((((generated_by_type)::text = 'human_override'::text) AND (generated_by_user_id IS NOT NULL)) OR ((snapshot_type = 'manual_override'::public.tdah_snapshot_type_enum) AND (generated_by_user_id IS NOT NULL)) OR (((generated_by_type)::text = 'system'::text) AND (snapshot_type <> 'manual_override'::public.tdah_snapshot_type_enum)))),
    CONSTRAINT chk_snapshot_session_required CHECK ((((snapshot_type = 'session_close'::public.tdah_snapshot_type_enum) AND (session_id IS NOT NULL)) OR (snapshot_type <> 'session_close'::public.tdah_snapshot_type_enum))),
    CONSTRAINT tdah_snapshots_generated_by_type_check CHECK (((generated_by_type)::text = ANY ((ARRAY['system'::character varying, 'human_override'::character varying])::text[])))
);

ALTER TABLE ONLY public.tdah_snapshots FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE tdah_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tdah_snapshots IS 'Snapshot imutável com snapshot_type condicional — Bible Anexo G §G6';


--
-- Name: COLUMN tdah_snapshots.snapshot_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tdah_snapshots.snapshot_at IS 'IMUTÁVEL: snapshots nunca são sobrescritos';


--
-- Name: tdah_teacher_access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_teacher_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    token_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.tdah_teacher_access_log FORCE ROW LEVEL SECURITY;


--
-- Name: tdah_teacher_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_teacher_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    token character varying(64) NOT NULL,
    teacher_name character varying(255) NOT NULL,
    teacher_email character varying(255),
    school_name character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    revoked_by uuid
);


--
-- Name: tdah_token_economy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_token_economy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    system_name character varying(255) DEFAULT 'Economia de Fichas'::character varying NOT NULL,
    token_type character varying(50) DEFAULT 'star'::character varying NOT NULL,
    token_label character varying(100),
    target_behaviors jsonb DEFAULT '[]'::jsonb NOT NULL,
    reinforcers jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    current_balance integer DEFAULT 0 NOT NULL,
    protocol_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tdah_token_economy_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'paused'::character varying, 'completed'::character varying, 'archived'::character varying])::text[])))
);

ALTER TABLE ONLY public.tdah_token_economy FORCE ROW LEVEL SECURITY;


--
-- Name: tdah_token_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tdah_token_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    economy_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    transaction_type character varying(20) NOT NULL,
    amount integer NOT NULL,
    balance_after integer NOT NULL,
    reason text,
    behavior_index integer,
    reinforcer_index integer,
    notes text,
    recorded_by character varying(50),
    recorded_by_name character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tdah_token_transactions_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['earn'::character varying, 'spend'::character varying, 'bonus'::character varying, 'reset'::character varying])::text[])))
);

ALTER TABLE ONLY public.tdah_token_transactions FORCE ROW LEVEL SECURITY;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    plan text DEFAULT 'standard'::text,
    created_at timestamp without time zone DEFAULT now(),
    clerk_user_id text,
    crp text,
    crp_uf text,
    email text,
    phone text,
    role text DEFAULT 'professional'::text,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    trial_status text DEFAULT 'active'::text,
    max_patients integer DEFAULT 5,
    max_sessions integer DEFAULT 15,
    is_admin boolean DEFAULT false,
    terms_accepted_at timestamp with time zone,
    onboarding_completed_at timestamp without time zone,
    clinic_name character varying(255),
    cnpj character varying(18),
    address_street text,
    address_city text,
    address_state character varying(2),
    address_zip character varying(10),
    plan_tier text DEFAULT 'free'::text,
    cancellation_scheduled_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    anonymized_at timestamp with time zone,
    updated_at timestamp without time zone DEFAULT now(),
    status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT tenants_plan_tier_check CHECK ((plan_tier = ANY (ARRAY['free'::text, 'founders'::text, 'clinica_100'::text, 'clinica_250'::text, 'trial'::text, 'starter'::text, 'professional'::text, 'clinic'::text]))),
    CONSTRAINT tenants_status_check CHECK ((status = ANY (ARRAY['active'::text, 'orphan'::text, 'inactive'::text])))
);


--
-- Name: COLUMN tenants.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.status IS 'Status do tenant: active (uso normal), orphan (sem profiles, fallback admin rejeita), inactive (suspenso). Mudanças via UPDATE, não DELETE — auditoria rígida AXIS.';


--
-- Name: transcript_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transcript_segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transcript_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    segment_index integer NOT NULL,
    start_seconds numeric(10,3) NOT NULL,
    end_seconds numeric(10,3) NOT NULL,
    text text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE ONLY public.transcript_segments FORCE ROW LEVEL SECURITY;


--
-- Name: transcription_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transcription_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    audio_path text NOT NULL,
    original_filename text,
    file_size_bytes bigint,
    transcript_id uuid,
    error_message text,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    locked_at timestamp with time zone,
    worker_id text,
    heartbeat_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    CONSTRAINT transcription_jobs_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT transcription_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);

ALTER TABLE ONLY public.transcription_jobs FORCE ROW LEVEL SECURITY;


--
-- Name: transcription_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transcription_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    month character varying(7) NOT NULL,
    minutes_used integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: transcripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transcripts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    session_id uuid,
    session_date date,
    text text,
    quality_score double precision,
    processed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    transcript_path text,
    text_preview text,
    char_count integer DEFAULT 0,
    raw_path text,
    final_path text,
    char_count_raw integer,
    char_count_final integer,
    postprocess_version character varying(20),
    asr_model character varying(100),
    audio_duration_seconds numeric(10,3)
);

ALTER TABLE ONLY public.transcripts FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN transcripts.raw_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.transcripts.raw_path IS 'Path em disco do texto bruto do ASR (preservado para auditoria)';


--
-- Name: COLUMN transcripts.final_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.transcripts.final_path IS 'Path em disco do texto pós-processado (fonte principal para UI e análise)';


--
-- Name: COLUMN transcripts.char_count_raw; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.transcripts.char_count_raw IS 'Tamanho em chars do raw_text';


--
-- Name: COLUMN transcripts.char_count_final; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.transcripts.char_count_final IS 'Tamanho em chars do final_text (exibido na UI)';


--
-- Name: COLUMN transcripts.postprocess_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.transcripts.postprocess_version IS 'Versão do pipeline de pós-processamento (legacy, 1.0.0, ...)';


--
-- Name: COLUMN transcripts.asr_model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.transcripts.asr_model IS 'Modelo ASR usado na transcrição (ex: whisper-1)';


--
-- Name: COLUMN transcripts.audio_duration_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.transcripts.audio_duration_seconds IS 'Duracao real do audio em segundos, extraida do ultimo segment do ASR. NULL para transcripts legados.';


--
-- Name: user_licenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_licenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    clerk_user_id character varying(255) NOT NULL,
    product_type public.aba_product_type NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    valid_from date DEFAULT CURRENT_DATE NOT NULL,
    valid_until date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hotmart_transaction text,
    hotmart_event text,
    hotmart_offer text,
    hotmart_plan text,
    buyer_email text
);


--
-- Name: v_active_protocols; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_active_protocols AS
 SELECT lp.id,
    lp.tenant_id,
    lp.learner_id,
    l.name AS learner_name,
    lp.title,
    lp.status,
    lp.generalization_status,
    lp.regression_count,
    lp.protocol_engine_version,
    ep.name AS ebp_practice_name,
    ep.name_pt AS ebp_practice_name_pt,
    lp.mastery_criteria_pct,
    lp.activated_at,
    lp.mastered_at,
    lp.suspended_at,
        CASE
            WHEN ((lp.status = 'suspended'::public.aba_protocol_status) AND (lp.suspended_at < (now() - '30 days'::interval))) THEN true
            ELSE false
        END AS suspension_overdue
   FROM ((public.learner_protocols lp
     JOIN public.learners l ON ((l.id = lp.learner_id)))
     JOIN public.ebp_practices ep ON ((ep.id = lp.ebp_practice_id)))
  WHERE (lp.status <> ALL (ARRAY['archived'::public.aba_protocol_status, 'discontinued'::public.aba_protocol_status]));


--
-- Name: v_convenio_report_ready; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_convenio_report_ready AS
 SELECT cr.id,
    cr.tenant_id,
    cr.learner_id,
    l.name AS learner_name,
    l.cid_code,
    l.support_level,
    cr.period_start,
    cr.period_end,
    cr.total_sessions,
    cr.total_hours,
    cr.cso_aba_avg,
    cr.status,
    cr.generated_by,
    cr.generated_at,
    cr.finalized_at,
    cr.report_snapshot_id,
    rs.data_hash,
    rs.pdf_url,
    rs.engine_version AS report_engine_version,
    cr.ans_reference,
    cr.sbni_reference,
    cr.justificativa_text
   FROM ((public.convenio_reports cr
     JOIN public.learners l ON ((l.id = cr.learner_id)))
     LEFT JOIN public.report_snapshots rs ON ((rs.id = cr.report_snapshot_id)));


--
-- Name: v_guardian_portal_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_guardian_portal_status AS
 SELECT g.id AS guardian_id,
    g.name AS guardian_name,
    g.email AS guardian_email,
    g.tenant_id,
    g.learner_id,
    l.name AS learner_name,
    COALESCE(( SELECT true
           FROM public.guardian_consents gc
          WHERE ((gc.guardian_id = g.id) AND (gc.learner_id = g.learner_id) AND (gc.consent_type = 'portal_access'::public.aba_consent_type) AND (gc.revoked_at IS NULL))
         LIMIT 1), false) AS portal_consent_active,
    COALESCE(( SELECT true
           FROM public.guardian_consents gc
          WHERE ((gc.guardian_id = g.id) AND (gc.learner_id = g.learner_id) AND (gc.consent_type = 'email_summary'::public.aba_consent_type) AND (gc.revoked_at IS NULL))
         LIMIT 1), false) AS email_consent_active,
    COALESCE(( SELECT true
           FROM public.family_portal_access fpa
          WHERE ((fpa.guardian_id = g.id) AND (fpa.learner_id = g.learner_id) AND (fpa.is_active = true))
         LIMIT 1), false) AS portal_active,
    ( SELECT max(ss.sent_at) AS max
           FROM public.session_summaries ss
          WHERE ((ss.learner_id = g.learner_id) AND ((ss.status)::text = 'sent'::text))) AS last_summary_sent_at
   FROM (public.guardians g
     JOIN public.learners l ON (((l.id = g.learner_id) AND (l.tenant_id = g.tenant_id))));


--
-- Name: v_learner_cso_current; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_learner_cso_current AS
 SELECT DISTINCT ON (cs.learner_id) cs.learner_id,
    cs.tenant_id,
    cs.sas,
    cs.pis,
    cs.bss,
    cs.tcm,
    cs.cso_aba,
    cs.cso_band,
    cs.engine_version,
    cs.created_at AS last_calculated_at,
    l.name AS learner_name,
    l.support_level
   FROM (public.clinical_states_aba cs
     JOIN public.learners l ON ((l.id = cs.learner_id)))
  ORDER BY cs.learner_id, cs.created_at DESC;


--
-- Name: v_maintenance_due; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_maintenance_due AS
 SELECT mp.id,
    mp.tenant_id,
    mp.protocol_id,
    mp.learner_id,
    lp.title AS protocol_title,
    l.name AS learner_name,
    mp.week_number,
    mp.scheduled_at,
    mp.status
   FROM ((public.maintenance_probes mp
     JOIN public.learner_protocols lp ON ((lp.id = mp.protocol_id)))
     JOIN public.learners l ON ((l.id = mp.learner_id)))
  WHERE (((mp.status)::text = 'pending'::text) AND (mp.scheduled_at <= (now() + '7 days'::interval)))
  ORDER BY mp.scheduled_at;


--
-- Name: v_pending_notifications; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_pending_notifications AS
 SELECT id,
    tenant_id,
    recipient_id,
    notification_type,
    title,
    body,
    data,
    created_at
   FROM public.notifications n
  WHERE ((status)::text = 'pending'::text);


--
-- Name: _migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations ALTER COLUMN id SET DEFAULT nextval('public._migrations_id_seq'::regclass);


--
-- Name: ebp_practices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ebp_practices ALTER COLUMN id SET DEFAULT nextval('public.ebp_practices_id_seq'::regclass);


--
-- Name: engine_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engine_versions ALTER COLUMN id SET DEFAULT nextval('public.engine_versions_id_seq'::regclass);


--
-- Name: onboarding_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress ALTER COLUMN id SET DEFAULT nextval('public.onboarding_progress_id_seq'::regclass);


--
-- Name: _migrations _migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_pkey PRIMARY KEY (id);


--
-- Name: _migrations _migrations_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_version_key UNIQUE (version);


--
-- Name: analyze_usage analyze_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analyze_usage
    ADD CONSTRAINT analyze_usage_pkey PRIMARY KEY (id);


--
-- Name: assist_audit_log assist_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assist_audit_log
    ADD CONSTRAINT assist_audit_log_pkey PRIMARY KEY (id);


--
-- Name: assist_suggestions assist_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assist_suggestions
    ADD CONSTRAINT assist_suggestions_pkey PRIMARY KEY (id);


--
-- Name: axis_audit_logs axis_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.axis_audit_logs
    ADD CONSTRAINT axis_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: calendar_connections calendar_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_pkey PRIMARY KEY (id);


--
-- Name: calendar_connections calendar_connections_tenant_id_user_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_tenant_id_user_id_provider_key UNIQUE (tenant_id, user_id, provider);


--
-- Name: calendar_sync_state calendar_sync_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sync_state
    ADD CONSTRAINT calendar_sync_state_pkey PRIMARY KEY (id);


--
-- Name: calendar_sync_state calendar_sync_state_tenant_id_user_id_provider_calendar_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sync_state
    ADD CONSTRAINT calendar_sync_state_tenant_id_user_id_provider_calendar_id_key UNIQUE (tenant_id, user_id, provider, calendar_id);


--
-- Name: case_bases case_bases_patient_id_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_bases
    ADD CONSTRAINT case_bases_patient_id_tenant_id_key UNIQUE (patient_id, tenant_id);


--
-- Name: case_bases case_bases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_bases
    ADD CONSTRAINT case_bases_pkey PRIMARY KEY (id);


--
-- Name: claim_packet_items claim_packet_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_packet_items
    ADD CONSTRAINT claim_packet_items_pkey PRIMARY KEY (id);


--
-- Name: claim_packets claim_packets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_packets
    ADD CONSTRAINT claim_packets_pkey PRIMARY KEY (id);


--
-- Name: clinic_documents clinic_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_documents
    ADD CONSTRAINT clinic_documents_pkey PRIMARY KEY (id);


--
-- Name: clinical_records clinical_records_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_records
    ADD CONSTRAINT clinical_records_patient_id_key UNIQUE (patient_id);


--
-- Name: clinical_records clinical_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_records
    ADD CONSTRAINT clinical_records_pkey PRIMARY KEY (id);


--
-- Name: clinical_states_aba clinical_states_aba_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_states_aba
    ADD CONSTRAINT clinical_states_aba_pkey PRIMARY KEY (id);


--
-- Name: clinical_states clinical_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_states
    ADD CONSTRAINT clinical_states_pkey PRIMARY KEY (id);


--
-- Name: clinical_states_tdah clinical_states_tdah_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_states_tdah
    ADD CONSTRAINT clinical_states_tdah_pkey PRIMARY KEY (id);


--
-- Name: compliance_checklist compliance_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklist
    ADD CONSTRAINT compliance_checklist_pkey PRIMARY KEY (id);


--
-- Name: convenio_reports convenio_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_reports
    ADD CONSTRAINT convenio_reports_pkey PRIMARY KEY (id);


--
-- Name: ebp_practices ebp_practices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ebp_practices
    ADD CONSTRAINT ebp_practices_pkey PRIMARY KEY (id);


--
-- Name: ebp_practices ebp_practices_practice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ebp_practices
    ADD CONSTRAINT ebp_practices_practice_number_key UNIQUE (practice_number);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: engine_versions engine_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engine_versions
    ADD CONSTRAINT engine_versions_pkey PRIMARY KEY (id);


--
-- Name: engine_versions engine_versions_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engine_versions
    ADD CONSTRAINT engine_versions_version_key UNIQUE (version);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: exposure_hierarchies exposure_hierarchies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exposure_hierarchies
    ADD CONSTRAINT exposure_hierarchies_pkey PRIMARY KEY (id);


--
-- Name: exposure_items exposure_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exposure_items
    ADD CONSTRAINT exposure_items_pkey PRIMARY KEY (id);


--
-- Name: family_portal_access family_portal_access_access_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_portal_access
    ADD CONSTRAINT family_portal_access_access_token_key UNIQUE (access_token);


--
-- Name: family_portal_access family_portal_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_portal_access
    ADD CONSTRAINT family_portal_access_pkey PRIMARY KEY (id);


--
-- Name: generalization_probes generalization_probes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generalization_probes
    ADD CONSTRAINT generalization_probes_pkey PRIMARY KEY (id);


--
-- Name: guardian_consents guardian_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_consents
    ADD CONSTRAINT guardian_consents_pkey PRIMARY KEY (id);


--
-- Name: guardians guardians_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardians
    ADD CONSTRAINT guardians_pkey PRIMARY KEY (id);


--
-- Name: integrity_flags integrity_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrity_flags
    ADD CONSTRAINT integrity_flags_pkey PRIMARY KEY (id);


--
-- Name: learner_coverage_profiles learner_coverage_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_coverage_profiles
    ADD CONSTRAINT learner_coverage_profiles_pkey PRIMARY KEY (id);


--
-- Name: learner_protocols learner_protocols_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_protocols
    ADD CONSTRAINT learner_protocols_pkey PRIMARY KEY (id);


--
-- Name: learner_support_levels learner_support_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_support_levels
    ADD CONSTRAINT learner_support_levels_pkey PRIMARY KEY (id);


--
-- Name: learner_therapists learner_therapists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_therapists
    ADD CONSTRAINT learner_therapists_pkey PRIMARY KEY (id);


--
-- Name: learner_therapists learner_therapists_tenant_id_learner_id_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_therapists
    ADD CONSTRAINT learner_therapists_tenant_id_learner_id_profile_id_key UNIQUE (tenant_id, learner_id, profile_id);


--
-- Name: learners learners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learners
    ADD CONSTRAINT learners_pkey PRIMARY KEY (id);


--
-- Name: maintenance_probes maintenance_probes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_probes
    ADD CONSTRAINT maintenance_probes_pkey PRIMARY KEY (id);


--
-- Name: maintenance_probes maintenance_probes_protocol_id_week_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_probes
    ADD CONSTRAINT maintenance_probes_protocol_id_week_number_key UNIQUE (protocol_id, week_number);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: onboarding_progress onboarding_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_pkey PRIMARY KEY (id);


--
-- Name: patient_onboarding_status patient_onboarding_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_onboarding_status
    ADD CONSTRAINT patient_onboarding_status_pkey PRIMARY KEY (patient_id);


--
-- Name: patient_push_tokens patient_push_tokens_patient_id_fcm_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_push_tokens
    ADD CONSTRAINT patient_push_tokens_patient_id_fcm_token_key UNIQUE (patient_id, fcm_token);


--
-- Name: patient_push_tokens patient_push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_push_tokens
    ADD CONSTRAINT patient_push_tokens_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: patients patients_push_auth_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_push_auth_token_key UNIQUE (push_auth_token);


--
-- Name: payer_requirement_profiles payer_requirement_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payer_requirement_profiles
    ADD CONSTRAINT payer_requirement_profiles_pkey PRIMARY KEY (id);


--
-- Name: payer_submissions payer_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payer_submissions
    ADD CONSTRAINT payer_submissions_pkey PRIMARY KEY (id);


--
-- Name: pei_goals pei_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pei_goals
    ADD CONSTRAINT pei_goals_pkey PRIMARY KEY (id);


--
-- Name: pei_plans pei_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pei_plans
    ADD CONSTRAINT pei_plans_pkey PRIMARY KEY (id);


--
-- Name: professional_preferences professional_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_preferences
    ADD CONSTRAINT professional_preferences_pkey PRIMARY KEY (tenant_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_tenant_id_clerk_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_tenant_id_clerk_user_id_key UNIQUE (tenant_id, clerk_user_id);


--
-- Name: protocol_library protocol_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_library
    ADD CONSTRAINT protocol_library_pkey PRIMARY KEY (id);


--
-- Name: provider_credentials provider_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_credentials
    ADD CONSTRAINT provider_credentials_pkey PRIMARY KEY (id);


--
-- Name: provider_credentials provider_credentials_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_credentials
    ADD CONSTRAINT provider_credentials_profile_id_key UNIQUE (profile_id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_user_id_fcm_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fcm_token_key UNIQUE (user_id, fcm_token);


--
-- Name: rag_config rag_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_config
    ADD CONSTRAINT rag_config_pkey PRIMARY KEY (tenant_id);


--
-- Name: report_snapshots report_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_snapshots
    ADD CONSTRAINT report_snapshots_pkey PRIMARY KEY (id);


--
-- Name: scheduled_reminders scheduled_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_reminders
    ADD CONSTRAINT scheduled_reminders_pkey PRIMARY KEY (id);


--
-- Name: service_sites service_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sites
    ADD CONSTRAINT service_sites_pkey PRIMARY KEY (id);


--
-- Name: session_attachments session_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attachments
    ADD CONSTRAINT session_attachments_pkey PRIMARY KEY (id);


--
-- Name: session_attestations session_attestations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attestations
    ADD CONSTRAINT session_attestations_pkey PRIMARY KEY (id);


--
-- Name: session_attestations session_attestations_session_id_attestor_type_attestor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attestations
    ADD CONSTRAINT session_attestations_session_id_attestor_type_attestor_id_key UNIQUE (session_id, attestor_type, attestor_id);


--
-- Name: session_behaviors session_behaviors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_behaviors
    ADD CONSTRAINT session_behaviors_pkey PRIMARY KEY (id);


--
-- Name: session_evidence_bundles session_evidence_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_evidence_bundles
    ADD CONSTRAINT session_evidence_bundles_pkey PRIMARY KEY (id);


--
-- Name: session_notes session_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_pkey PRIMARY KEY (id);


--
-- Name: session_presence_proofs session_presence_proofs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_presence_proofs
    ADD CONSTRAINT session_presence_proofs_pkey PRIMARY KEY (id);


--
-- Name: session_presence_proofs session_presence_proofs_session_id_proof_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_presence_proofs
    ADD CONSTRAINT session_presence_proofs_session_id_proof_type_key UNIQUE (session_id, proof_type);


--
-- Name: session_reports session_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_reports
    ADD CONSTRAINT session_reports_pkey PRIMARY KEY (id);


--
-- Name: session_reports session_reports_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_reports
    ADD CONSTRAINT session_reports_session_id_key UNIQUE (session_id);


--
-- Name: session_snapshots session_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_snapshots
    ADD CONSTRAINT session_snapshots_pkey PRIMARY KEY (id);


--
-- Name: session_summaries session_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_summaries
    ADD CONSTRAINT session_summaries_pkey PRIMARY KEY (id);


--
-- Name: session_summaries session_summaries_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_summaries
    ADD CONSTRAINT session_summaries_session_id_key UNIQUE (session_id);


--
-- Name: session_targets session_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_targets
    ADD CONSTRAINT session_targets_pkey PRIMARY KEY (id);


--
-- Name: sessions_aba sessions_aba_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_aba
    ADD CONSTRAINT sessions_aba_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: suggestion_decisions suggestion_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_decisions
    ADD CONSTRAINT suggestion_decisions_pkey PRIMARY KEY (id);


--
-- Name: suggestion_log_aba suggestion_log_aba_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_log_aba
    ADD CONSTRAINT suggestion_log_aba_pkey PRIMARY KEY (id);


--
-- Name: suggestions suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_pkey PRIMARY KEY (id);


--
-- Name: system_alerts system_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_alerts
    ADD CONSTRAINT system_alerts_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tcc_analyses tcc_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcc_analyses
    ADD CONSTRAINT tcc_analyses_pkey PRIMARY KEY (id);


--
-- Name: tdah_audhd_log tdah_audhd_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_audhd_log
    ADD CONSTRAINT tdah_audhd_log_pkey PRIMARY KEY (id);


--
-- Name: tdah_drc tdah_drc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_drc
    ADD CONSTRAINT tdah_drc_pkey PRIMARY KEY (id);


--
-- Name: tdah_events tdah_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_events
    ADD CONSTRAINT tdah_events_pkey PRIMARY KEY (id);


--
-- Name: tdah_family_access_log tdah_family_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_family_access_log
    ADD CONSTRAINT tdah_family_access_log_pkey PRIMARY KEY (id);


--
-- Name: tdah_family_tokens tdah_family_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_family_tokens
    ADD CONSTRAINT tdah_family_tokens_pkey PRIMARY KEY (id);


--
-- Name: tdah_family_tokens tdah_family_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_family_tokens
    ADD CONSTRAINT tdah_family_tokens_token_key UNIQUE (token);


--
-- Name: tdah_guardians tdah_guardians_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_guardians
    ADD CONSTRAINT tdah_guardians_pkey PRIMARY KEY (id);


--
-- Name: tdah_observations tdah_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_observations
    ADD CONSTRAINT tdah_observations_pkey PRIMARY KEY (id);


--
-- Name: tdah_patient_therapists tdah_patient_therapists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_patient_therapists
    ADD CONSTRAINT tdah_patient_therapists_pkey PRIMARY KEY (id);


--
-- Name: tdah_patient_therapists tdah_patient_therapists_tenant_id_patient_id_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_patient_therapists
    ADD CONSTRAINT tdah_patient_therapists_tenant_id_patient_id_profile_id_key UNIQUE (tenant_id, patient_id, profile_id);


--
-- Name: tdah_patients tdah_patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_patients
    ADD CONSTRAINT tdah_patients_pkey PRIMARY KEY (id);


--
-- Name: tdah_plan_goals tdah_plan_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_plan_goals
    ADD CONSTRAINT tdah_plan_goals_pkey PRIMARY KEY (id);


--
-- Name: tdah_plans tdah_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_plans
    ADD CONSTRAINT tdah_plans_pkey PRIMARY KEY (id);


--
-- Name: tdah_protocol_library tdah_protocol_library_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_protocol_library
    ADD CONSTRAINT tdah_protocol_library_code_key UNIQUE (code);


--
-- Name: tdah_protocol_library tdah_protocol_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_protocol_library
    ADD CONSTRAINT tdah_protocol_library_pkey PRIMARY KEY (id);


--
-- Name: tdah_protocols tdah_protocols_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_protocols
    ADD CONSTRAINT tdah_protocols_pkey PRIMARY KEY (id);


--
-- Name: tdah_routines tdah_routines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_routines
    ADD CONSTRAINT tdah_routines_pkey PRIMARY KEY (id);


--
-- Name: tdah_sessions tdah_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_sessions
    ADD CONSTRAINT tdah_sessions_pkey PRIMARY KEY (id);


--
-- Name: tdah_snapshots tdah_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_snapshots
    ADD CONSTRAINT tdah_snapshots_pkey PRIMARY KEY (id);


--
-- Name: tdah_teacher_access_log tdah_teacher_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_teacher_access_log
    ADD CONSTRAINT tdah_teacher_access_log_pkey PRIMARY KEY (id);


--
-- Name: tdah_teacher_tokens tdah_teacher_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_teacher_tokens
    ADD CONSTRAINT tdah_teacher_tokens_pkey PRIMARY KEY (id);


--
-- Name: tdah_teacher_tokens tdah_teacher_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_teacher_tokens
    ADD CONSTRAINT tdah_teacher_tokens_token_key UNIQUE (token);


--
-- Name: tdah_token_economy tdah_token_economy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_token_economy
    ADD CONSTRAINT tdah_token_economy_pkey PRIMARY KEY (id);


--
-- Name: tdah_token_transactions tdah_token_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_token_transactions
    ADD CONSTRAINT tdah_token_transactions_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: transcript_segments transcript_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcript_segments
    ADD CONSTRAINT transcript_segments_pkey PRIMARY KEY (id);


--
-- Name: transcription_jobs transcription_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcription_jobs
    ADD CONSTRAINT transcription_jobs_pkey PRIMARY KEY (id);


--
-- Name: transcription_usage transcription_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcription_usage
    ADD CONSTRAINT transcription_usage_pkey PRIMARY KEY (id);


--
-- Name: transcription_usage transcription_usage_tenant_id_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcription_usage
    ADD CONSTRAINT transcription_usage_tenant_id_month_key UNIQUE (tenant_id, month);


--
-- Name: transcripts transcripts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcripts
    ADD CONSTRAINT transcripts_pkey PRIMARY KEY (id);


--
-- Name: sessions unique_session_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT unique_session_number UNIQUE (patient_id, session_number);


--
-- Name: compliance_checklist uq_compliance_item; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklist
    ADD CONSTRAINT uq_compliance_item UNIQUE (tenant_id, item_key);


--
-- Name: learner_therapists uq_learner_therapist; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_therapists
    ADD CONSTRAINT uq_learner_therapist UNIQUE (learner_id, profile_id);


--
-- Name: session_snapshots uq_one_snapshot_per_session; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_snapshots
    ADD CONSTRAINT uq_one_snapshot_per_session UNIQUE (session_id);


--
-- Name: family_portal_access uq_portal_access; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_portal_access
    ADD CONSTRAINT uq_portal_access UNIQUE (guardian_id, learner_id);


--
-- Name: user_licenses uq_user_product; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_licenses
    ADD CONSTRAINT uq_user_product UNIQUE (tenant_id, clerk_user_id, product_type);


--
-- Name: user_licenses user_licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_licenses
    ADD CONSTRAINT user_licenses_pkey PRIMARY KEY (id);


--
-- Name: idx_analyze_usage_route; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analyze_usage_route ON public.analyze_usage USING btree (tenant_id, route, created_at DESC);


--
-- Name: idx_analyze_usage_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analyze_usage_tenant_created ON public.analyze_usage USING btree (tenant_id, created_at DESC);


--
-- Name: idx_assist_audit_log_suggestion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assist_audit_log_suggestion ON public.assist_audit_log USING btree (assist_suggestion_id);


--
-- Name: idx_assist_suggestions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assist_suggestions_status ON public.assist_suggestions USING btree (status);


--
-- Name: idx_attachments_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_hash ON public.session_attachments USING btree (tenant_id, file_hash);


--
-- Name: idx_attachments_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_session ON public.session_attachments USING btree (session_id);


--
-- Name: idx_attachments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_tenant ON public.session_attachments USING btree (tenant_id, uploaded_at DESC);


--
-- Name: idx_attestations_magic_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attestations_magic_link ON public.session_attestations USING btree (magic_link_token) WHERE (magic_link_token IS NOT NULL);


--
-- Name: idx_attestations_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attestations_pending ON public.session_attestations USING btree (status, expires_at) WHERE (status = 'pending'::text);


--
-- Name: idx_attestations_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attestations_session ON public.session_attestations USING btree (session_id);


--
-- Name: idx_attestations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attestations_tenant ON public.session_attestations USING btree (tenant_id, created_at DESC);


--
-- Name: idx_axis_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_axis_audit_action ON public.axis_audit_logs USING btree (action);


--
-- Name: idx_axis_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_axis_audit_entity ON public.axis_audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_axis_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_axis_audit_logs_action ON public.axis_audit_logs USING btree (action);


--
-- Name: idx_axis_audit_logs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_axis_audit_logs_tenant ON public.axis_audit_logs USING btree (tenant_id, created_at DESC);


--
-- Name: idx_axis_audit_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_axis_audit_tenant ON public.axis_audit_logs USING btree (tenant_id, created_at DESC);


--
-- Name: idx_behaviors_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_behaviors_session ON public.session_behaviors USING btree (session_id);


--
-- Name: idx_behaviors_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_behaviors_tenant ON public.session_behaviors USING btree (tenant_id);


--
-- Name: idx_case_bases_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_bases_patient ON public.case_bases USING btree (patient_id);


--
-- Name: idx_case_bases_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_bases_tenant ON public.case_bases USING btree (tenant_id);


--
-- Name: idx_claim_packets_coverage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_packets_coverage ON public.claim_packets USING btree (coverage_id) WHERE (coverage_id IS NOT NULL);


--
-- Name: idx_claim_packets_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_packets_learner ON public.claim_packets USING btree (learner_id);


--
-- Name: idx_claim_packets_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_packets_period ON public.claim_packets USING btree (period_start, period_end);


--
-- Name: idx_claim_packets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_packets_status ON public.claim_packets USING btree (packet_status);


--
-- Name: idx_claim_packets_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claim_packets_tenant ON public.claim_packets USING btree (tenant_id);


--
-- Name: idx_clinic_documents_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_documents_tenant ON public.clinic_documents USING btree (tenant_id, doc_type);


--
-- Name: idx_clinical_states_aba_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_states_aba_learner ON public.clinical_states_aba USING btree (learner_id, created_at DESC);


--
-- Name: idx_clinical_states_aba_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_states_aba_tenant ON public.clinical_states_aba USING btree (tenant_id, created_at DESC);


--
-- Name: idx_clinical_states_event_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_states_event_hash ON public.clinical_states USING btree (event_hash);


--
-- Name: idx_clinical_states_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_states_patient ON public.clinical_states USING btree (patient_id, created_at DESC);


--
-- Name: idx_clinical_states_tdah_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_states_tdah_patient ON public.clinical_states_tdah USING btree (patient_id, created_at DESC);


--
-- Name: idx_clinical_states_tdah_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_states_tdah_tenant ON public.clinical_states_tdah USING btree (tenant_id);


--
-- Name: idx_consents_guardian; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consents_guardian ON public.guardian_consents USING btree (guardian_id, consent_type);


--
-- Name: idx_consents_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consents_learner ON public.guardian_consents USING btree (learner_id, consent_type);


--
-- Name: idx_convenio_reports_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_convenio_reports_learner ON public.convenio_reports USING btree (learner_id);


--
-- Name: idx_convenio_reports_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_convenio_reports_tenant ON public.convenio_reports USING btree (tenant_id, period_start DESC);


--
-- Name: idx_coverage_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coverage_learner ON public.learner_coverage_profiles USING btree (learner_id);


--
-- Name: idx_coverage_payer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coverage_payer ON public.learner_coverage_profiles USING btree (payer_profile_id) WHERE (payer_profile_id IS NOT NULL);


--
-- Name: idx_coverage_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coverage_status ON public.learner_coverage_profiles USING btree (status);


--
-- Name: idx_coverage_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coverage_tenant ON public.learner_coverage_profiles USING btree (tenant_id);


--
-- Name: idx_csa_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csa_learner ON public.clinical_states_aba USING btree (learner_id, created_at DESC);


--
-- Name: idx_email_logs_related; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_related ON public.email_logs USING btree (related_type, related_id);


--
-- Name: idx_email_logs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_tenant ON public.email_logs USING btree (tenant_id, created_at DESC);


--
-- Name: idx_engine_versions_current; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_engine_versions_current ON public.engine_versions USING btree (is_current) WHERE (is_current = true);


--
-- Name: idx_engine_versions_single_current; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_engine_versions_single_current ON public.engine_versions USING btree (is_current) WHERE (is_current = true);


--
-- Name: idx_events_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_patient ON public.events USING btree (patient_id, created_at DESC);


--
-- Name: idx_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_type ON public.events USING btree (event_type);


--
-- Name: idx_evidence_bundles_latest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evidence_bundles_latest ON public.session_evidence_bundles USING btree (session_id, version DESC);


--
-- Name: idx_evidence_bundles_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evidence_bundles_session ON public.session_evidence_bundles USING btree (session_id);


--
-- Name: idx_evidence_bundles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evidence_bundles_status ON public.session_evidence_bundles USING btree (tenant_id, status) WHERE (status <> 'complete'::text);


--
-- Name: idx_evidence_bundles_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evidence_bundles_tenant ON public.session_evidence_bundles USING btree (tenant_id, generated_at DESC);


--
-- Name: idx_exposure_items_hierarchy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exposure_items_hierarchy ON public.exposure_items USING btree (hierarchy_id, "position");


--
-- Name: idx_family_access_log_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_family_access_log_token ON public.tdah_family_access_log USING btree (token_id, created_at DESC);


--
-- Name: idx_family_tokens_guardian; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_family_tokens_guardian ON public.tdah_family_tokens USING btree (guardian_id);


--
-- Name: idx_family_tokens_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_family_tokens_patient ON public.tdah_family_tokens USING btree (tenant_id, patient_id);


--
-- Name: idx_family_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_family_tokens_token ON public.tdah_family_tokens USING btree (token) WHERE (is_active = true);


--
-- Name: idx_gc_guardian; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gc_guardian ON public.guardian_consents USING btree (guardian_id);


--
-- Name: idx_gen_probes_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gen_probes_learner ON public.generalization_probes USING btree (learner_id);


--
-- Name: idx_gen_probes_protocol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gen_probes_protocol ON public.generalization_probes USING btree (protocol_id);


--
-- Name: idx_gp_protocol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gp_protocol ON public.generalization_probes USING btree (protocol_id);


--
-- Name: idx_guardians_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guardians_learner ON public.guardians USING btree (learner_id);


--
-- Name: idx_guardians_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guardians_tenant ON public.guardians USING btree (tenant_id, is_active);


--
-- Name: idx_integrity_flags_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integrity_flags_entity ON public.integrity_flags USING btree (entity_type, entity_id);


--
-- Name: idx_integrity_flags_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integrity_flags_open ON public.integrity_flags USING btree (tenant_id, status) WHERE (status = ANY (ARRAY['open'::text, 'reviewing'::text]));


--
-- Name: idx_integrity_flags_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integrity_flags_rule ON public.integrity_flags USING btree (rule_code);


--
-- Name: idx_integrity_flags_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integrity_flags_severity ON public.integrity_flags USING btree (severity);


--
-- Name: idx_integrity_flags_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integrity_flags_status ON public.integrity_flags USING btree (status);


--
-- Name: idx_integrity_flags_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integrity_flags_tenant ON public.integrity_flags USING btree (tenant_id);


--
-- Name: idx_integrity_flags_upsert; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_integrity_flags_upsert ON public.integrity_flags USING btree (tenant_id, entity_type, entity_id, rule_code) WHERE (status = ANY (ARRAY['open'::text, 'reviewing'::text]));


--
-- Name: idx_learners_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learners_active ON public.learners USING btree (tenant_id) WHERE ((is_active = true) AND (deleted_at IS NULL));


--
-- Name: idx_learners_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learners_tenant ON public.learners USING btree (tenant_id, is_active);


--
-- Name: idx_lp_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lp_learner ON public.learner_protocols USING btree (learner_id);


--
-- Name: idx_lp_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lp_status ON public.learner_protocols USING btree (status);


--
-- Name: idx_lp_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lp_tenant ON public.learner_protocols USING btree (tenant_id);


--
-- Name: idx_lt_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lt_learner ON public.learner_therapists USING btree (learner_id);


--
-- Name: idx_lt_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lt_profile ON public.learner_therapists USING btree (profile_id);


--
-- Name: idx_lt_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lt_tenant ON public.learner_therapists USING btree (tenant_id);


--
-- Name: idx_maint_probes_protocol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maint_probes_protocol ON public.maintenance_probes USING btree (protocol_id);


--
-- Name: idx_maint_probes_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maint_probes_scheduled ON public.maintenance_probes USING btree (tenant_id, scheduled_at);


--
-- Name: idx_mp_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mp_learner ON public.maintenance_probes USING btree (learner_id);


--
-- Name: idx_mp_protocol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mp_protocol ON public.maintenance_probes USING btree (protocol_id);


--
-- Name: idx_notifications_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_recipient ON public.notifications USING btree (recipient_id, status);


--
-- Name: idx_notifications_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_tenant ON public.notifications USING btree (tenant_id, recipient_id);


--
-- Name: idx_notifications_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_tenant_status ON public.notifications USING btree (tenant_id, status);


--
-- Name: idx_packet_items_packet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_packet_items_packet ON public.claim_packet_items USING btree (packet_id);


--
-- Name: idx_packet_items_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_packet_items_ref ON public.claim_packet_items USING btree (item_ref_id) WHERE (item_ref_id IS NOT NULL);


--
-- Name: idx_packet_items_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_packet_items_type ON public.claim_packet_items USING btree (item_type);


--
-- Name: idx_patient_push_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_push_patient ON public.patient_push_tokens USING btree (patient_id);


--
-- Name: idx_patients_full_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_full_name ON public.patients USING btree (tenant_id, full_name);


--
-- Name: idx_patients_push_auth_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_push_auth_token ON public.patients USING btree (push_auth_token) WHERE (push_auth_token IS NOT NULL);


--
-- Name: idx_payer_req_profiles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payer_req_profiles_active ON public.payer_requirement_profiles USING btree (tenant_id, is_active) WHERE (is_active = true);


--
-- Name: idx_payer_req_profiles_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payer_req_profiles_name ON public.payer_requirement_profiles USING btree (tenant_id, payer_name);


--
-- Name: idx_payer_req_profiles_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payer_req_profiles_tenant ON public.payer_requirement_profiles USING btree (tenant_id);


--
-- Name: idx_pei_goals_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pei_goals_plan ON public.pei_goals USING btree (pei_plan_id);


--
-- Name: idx_pei_plans_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pei_plans_learner ON public.pei_plans USING btree (learner_id, status);


--
-- Name: idx_portal_access_guardian; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portal_access_guardian ON public.family_portal_access USING btree (guardian_id, is_active);


--
-- Name: idx_portal_access_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portal_access_learner ON public.family_portal_access USING btree (learner_id);


--
-- Name: idx_presence_proofs_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presence_proofs_session ON public.session_presence_proofs USING btree (session_id);


--
-- Name: idx_presence_proofs_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presence_proofs_site ON public.session_presence_proofs USING btree (declared_site_id) WHERE (declared_site_id IS NOT NULL);


--
-- Name: idx_presence_proofs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presence_proofs_status ON public.session_presence_proofs USING btree (tenant_id, confidence_status) WHERE (confidence_status <> 'valid'::text);


--
-- Name: idx_presence_proofs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presence_proofs_tenant ON public.session_presence_proofs USING btree (tenant_id, captured_at DESC);


--
-- Name: idx_profiles_clerk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_clerk ON public.profiles USING btree (clerk_user_id);


--
-- Name: idx_profiles_clerk_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_profiles_clerk_tenant ON public.profiles USING btree (clerk_user_id, tenant_id);


--
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_email ON public.profiles USING btree (lower(email));


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (tenant_id, role);


--
-- Name: idx_profiles_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_tenant ON public.profiles USING btree (tenant_id);


--
-- Name: idx_protocol_library_ebp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocol_library_ebp ON public.protocol_library USING btree (ebp_practice_id);


--
-- Name: idx_protocol_library_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocol_library_tenant ON public.protocol_library USING btree (tenant_id);


--
-- Name: idx_protocols_learner_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocols_learner_status ON public.learner_protocols USING btree (learner_id, status);


--
-- Name: idx_protocols_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocols_tenant ON public.learner_protocols USING btree (tenant_id, status);


--
-- Name: idx_provider_cred_council_exp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_cred_council_exp ON public.provider_credentials USING btree (council_valid_until) WHERE (council_valid_until IS NOT NULL);


--
-- Name: idx_provider_cred_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_cred_profile ON public.provider_credentials USING btree (profile_id);


--
-- Name: idx_provider_cred_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_cred_status ON public.provider_credentials USING btree (credential_status);


--
-- Name: idx_provider_cred_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_cred_tenant ON public.provider_credentials USING btree (tenant_id);


--
-- Name: idx_push_tenant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_tenant_user ON public.push_subscriptions USING btree (tenant_id, user_id);


--
-- Name: idx_push_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_tokens_user ON public.push_tokens USING btree (user_id);


--
-- Name: idx_reminders_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reminders_scheduled ON public.scheduled_reminders USING btree (scheduled_time) WHERE (sent = false);


--
-- Name: idx_report_snapshots_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_snapshots_learner ON public.report_snapshots USING btree (learner_id, generated_at DESC);


--
-- Name: idx_report_snapshots_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_snapshots_tenant ON public.report_snapshots USING btree (tenant_id, generated_at DESC);


--
-- Name: idx_rs_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rs_learner ON public.report_snapshots USING btree (learner_id);


--
-- Name: idx_sa_applied_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sa_applied_by ON public.sessions_aba USING btree (applied_by);


--
-- Name: idx_sb_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sb_session ON public.session_behaviors USING btree (session_id);


--
-- Name: idx_service_sites_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_sites_tenant ON public.service_sites USING btree (tenant_id) WHERE (is_active = true);


--
-- Name: idx_service_sites_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_sites_type ON public.service_sites USING btree (tenant_id, site_type);


--
-- Name: idx_session_notes_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_notes_session ON public.session_notes USING btree (session_id);


--
-- Name: idx_session_reports_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_reports_session ON public.session_reports USING btree (session_id);


--
-- Name: idx_session_reports_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_reports_tenant ON public.session_reports USING btree (tenant_id);


--
-- Name: idx_session_summaries_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_summaries_learner ON public.session_summaries USING btree (learner_id, status);


--
-- Name: idx_session_summaries_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_summaries_module ON public.session_summaries USING btree (source_module);


--
-- Name: idx_session_targets_protocol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_targets_protocol ON public.session_targets USING btree (protocol_id);


--
-- Name: idx_session_targets_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_targets_session ON public.session_targets USING btree (session_id);


--
-- Name: idx_session_targets_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_targets_tenant ON public.session_targets USING btree (tenant_id);


--
-- Name: idx_sessions_aba_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_aba_learner ON public.sessions_aba USING btree (learner_id);


--
-- Name: idx_sessions_aba_service_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_aba_service_mode ON public.sessions_aba USING btree (tenant_id, service_mode);


--
-- Name: idx_sessions_aba_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_aba_site ON public.sessions_aba USING btree (declared_site_id) WHERE (declared_site_id IS NOT NULL);


--
-- Name: idx_sessions_aba_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_aba_status ON public.sessions_aba USING btree (status);


--
-- Name: idx_sessions_aba_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_aba_tenant ON public.sessions_aba USING btree (tenant_id, scheduled_at DESC);


--
-- Name: idx_sessions_aba_tenant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_aba_tenant_date ON public.sessions_aba USING btree (tenant_id, scheduled_at DESC);


--
-- Name: idx_sessions_aba_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_aba_tenant_status ON public.sessions_aba USING btree (tenant_id, status);


--
-- Name: idx_sessions_aba_therapist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_aba_therapist ON public.sessions_aba USING btree (therapist_id, status);


--
-- Name: idx_sessions_google_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_google_event ON public.sessions USING btree (google_event_id) WHERE (google_event_id IS NOT NULL);


--
-- Name: idx_sessions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_patient ON public.sessions USING btree (patient_id, scheduled_at DESC);


--
-- Name: idx_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_status ON public.sessions USING btree (status);


--
-- Name: idx_sessions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_tenant ON public.sessions USING btree (tenant_id, scheduled_at DESC);


--
-- Name: idx_snapshots_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snapshots_learner ON public.session_snapshots USING btree (learner_id, created_at DESC);


--
-- Name: idx_ss2_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ss2_session ON public.session_summaries USING btree (session_id);


--
-- Name: idx_ss_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ss_session ON public.session_snapshots USING btree (session_id);


--
-- Name: idx_st_applied_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_st_applied_by ON public.session_targets USING btree (applied_by);


--
-- Name: idx_st_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_st_session ON public.session_targets USING btree (session_id);


--
-- Name: idx_submissions_packet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_packet ON public.payer_submissions USING btree (packet_id);


--
-- Name: idx_submissions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_status ON public.payer_submissions USING btree (response_status) WHERE (response_status IS NOT NULL);


--
-- Name: idx_submissions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_tenant ON public.payer_submissions USING btree (tenant_id);


--
-- Name: idx_suggestion_decisions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestion_decisions_patient ON public.suggestion_decisions USING btree (patient_id, created_at DESC);


--
-- Name: idx_suggestion_log_aba_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestion_log_aba_learner ON public.suggestion_log_aba USING btree (learner_id);


--
-- Name: idx_suggestion_log_aba_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestion_log_aba_tenant ON public.suggestion_log_aba USING btree (tenant_id, created_at DESC);


--
-- Name: idx_suggestions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestions_patient ON public.suggestions USING btree (patient_id, created_at DESC);


--
-- Name: idx_suggestions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestions_type ON public.suggestions USING btree (type);


--
-- Name: idx_support_levels_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_levels_learner ON public.learner_support_levels USING btree (learner_id, changed_at DESC);


--
-- Name: idx_system_alerts_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_alerts_created ON public.system_alerts USING btree (created_at DESC);


--
-- Name: idx_system_alerts_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_alerts_module ON public.system_alerts USING btree (module, created_at DESC);


--
-- Name: idx_system_alerts_unresolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_alerts_unresolved ON public.system_alerts USING btree (resolved, severity) WHERE (resolved = false);


--
-- Name: idx_tasks_hierarchy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_hierarchy ON public.tasks USING btree (hierarchy_id);


--
-- Name: idx_tasks_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_patient ON public.tasks USING btree (patient_id, assigned_at DESC);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);


--
-- Name: idx_tcc_analyses_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tcc_analyses_patient ON public.tcc_analyses USING btree (patient_id);


--
-- Name: idx_tcc_analyses_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tcc_analyses_session ON public.tcc_analyses USING btree (session_id);


--
-- Name: idx_tdah_audhd_log_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_audhd_log_patient ON public.tdah_audhd_log USING btree (patient_id, changed_at DESC);


--
-- Name: idx_tdah_drc_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_drc_patient ON public.tdah_drc USING btree (patient_id, drc_date DESC);


--
-- Name: idx_tdah_drc_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_drc_tenant ON public.tdah_drc USING btree (tenant_id);


--
-- Name: idx_tdah_events_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_events_session ON public.tdah_events USING btree (session_id);


--
-- Name: idx_tdah_events_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_events_tenant ON public.tdah_events USING btree (tenant_id);


--
-- Name: idx_tdah_guardians_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_guardians_patient ON public.tdah_guardians USING btree (patient_id);


--
-- Name: idx_tdah_observations_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_observations_session ON public.tdah_observations USING btree (session_id);


--
-- Name: idx_tdah_observations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_observations_tenant ON public.tdah_observations USING btree (tenant_id);


--
-- Name: idx_tdah_patients_audhd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_patients_audhd ON public.tdah_patients USING btree (tenant_id, audhd_layer_status);


--
-- Name: idx_tdah_patients_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_patients_status ON public.tdah_patients USING btree (tenant_id, status);


--
-- Name: idx_tdah_patients_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_patients_tenant ON public.tdah_patients USING btree (tenant_id);


--
-- Name: idx_tdah_plan_goals_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_plan_goals_plan ON public.tdah_plan_goals USING btree (plan_id);


--
-- Name: idx_tdah_plans_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_plans_patient ON public.tdah_plans USING btree (patient_id);


--
-- Name: idx_tdah_protocols_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_protocols_patient ON public.tdah_protocols USING btree (patient_id, status);


--
-- Name: idx_tdah_protocols_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_protocols_tenant ON public.tdah_protocols USING btree (tenant_id);


--
-- Name: idx_tdah_pt_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_pt_lookup ON public.tdah_patient_therapists USING btree (tenant_id, profile_id);


--
-- Name: idx_tdah_pt_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_pt_patient ON public.tdah_patient_therapists USING btree (patient_id);


--
-- Name: idx_tdah_pt_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_pt_profile ON public.tdah_patient_therapists USING btree (profile_id);


--
-- Name: idx_tdah_pt_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_pt_tenant ON public.tdah_patient_therapists USING btree (tenant_id);


--
-- Name: idx_tdah_routines_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_routines_patient ON public.tdah_routines USING btree (patient_id);


--
-- Name: idx_tdah_sessions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_sessions_date ON public.tdah_sessions USING btree (tenant_id, scheduled_at);


--
-- Name: idx_tdah_sessions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_sessions_patient ON public.tdah_sessions USING btree (patient_id);


--
-- Name: idx_tdah_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_sessions_status ON public.tdah_sessions USING btree (tenant_id, status);


--
-- Name: idx_tdah_sessions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_sessions_tenant ON public.tdah_sessions USING btree (tenant_id);


--
-- Name: idx_tdah_snapshots_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_snapshots_patient ON public.tdah_snapshots USING btree (patient_id, snapshot_at DESC);


--
-- Name: idx_tdah_snapshots_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_snapshots_session ON public.tdah_snapshots USING btree (session_id);


--
-- Name: idx_tdah_snapshots_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tdah_snapshots_tenant ON public.tdah_snapshots USING btree (tenant_id);


--
-- Name: idx_teacher_access_log_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_access_log_token ON public.tdah_teacher_access_log USING btree (token_id, created_at DESC);


--
-- Name: idx_teacher_tokens_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_tokens_active ON public.tdah_teacher_tokens USING btree (tenant_id, is_active) WHERE (is_active = true);


--
-- Name: idx_teacher_tokens_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_tokens_patient ON public.tdah_teacher_tokens USING btree (tenant_id, patient_id);


--
-- Name: idx_teacher_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_tokens_token ON public.tdah_teacher_tokens USING btree (token) WHERE (is_active = true);


--
-- Name: idx_tenants_cancellation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_cancellation ON public.tenants USING btree (cancellation_scheduled_at) WHERE (cancellation_scheduled_at IS NOT NULL);


--
-- Name: idx_tenants_clerk_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_clerk_user ON public.tenants USING btree (clerk_user_id);


--
-- Name: idx_tenants_cnpj_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_cnpj_unique ON public.tenants USING btree (cnpj) WHERE (cnpj IS NOT NULL);


--
-- Name: idx_tenants_status_clerk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_status_clerk ON public.tenants USING btree (status, clerk_user_id) WHERE (status = 'active'::text);


--
-- Name: idx_tjobs_one_active_per_session; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tjobs_one_active_per_session ON public.transcription_jobs USING btree (session_id) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));


--
-- Name: idx_tjobs_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tjobs_pending ON public.transcription_jobs USING btree (created_at) WHERE (status = 'pending'::text);


--
-- Name: idx_tjobs_processing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tjobs_processing ON public.transcription_jobs USING btree (locked_at) WHERE (status = 'processing'::text);


--
-- Name: idx_tjobs_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tjobs_session ON public.transcription_jobs USING btree (session_id);


--
-- Name: idx_token_economy_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token_economy_patient ON public.tdah_token_economy USING btree (tenant_id, patient_id);


--
-- Name: idx_token_transactions_economy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token_transactions_economy ON public.tdah_token_transactions USING btree (economy_id, created_at DESC);


--
-- Name: idx_token_transactions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token_transactions_patient ON public.tdah_token_transactions USING btree (tenant_id, patient_id, created_at DESC);


--
-- Name: idx_transcript_segments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transcript_segments_tenant ON public.transcript_segments USING btree (tenant_id);


--
-- Name: idx_transcript_segments_transcript; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transcript_segments_transcript ON public.transcript_segments USING btree (transcript_id, segment_index);


--
-- Name: idx_transcription_usage_tenant_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transcription_usage_tenant_month ON public.transcription_usage USING btree (tenant_id, month);


--
-- Name: idx_transcripts_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transcripts_session ON public.transcripts USING btree (session_id);


--
-- Name: idx_transcripts_session_duration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transcripts_session_duration ON public.transcripts USING btree (session_id) WHERE (audio_duration_seconds IS NOT NULL);


--
-- Name: idx_transcripts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transcripts_tenant ON public.transcripts USING btree (tenant_id);


--
-- Name: idx_user_licenses_clerk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_licenses_clerk ON public.user_licenses USING btree (clerk_user_id, product_type);


--
-- Name: idx_user_licenses_clerk_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_licenses_clerk_product ON public.user_licenses USING btree (clerk_user_id, product_type) WHERE (is_active = true);


--
-- Name: idx_user_licenses_hotmart_tx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_licenses_hotmart_tx ON public.user_licenses USING btree (tenant_id, hotmart_transaction) WHERE (hotmart_transaction IS NOT NULL);


--
-- Name: idx_user_licenses_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_licenses_tenant ON public.user_licenses USING btree (tenant_id, is_active);


--
-- Name: idx_user_licenses_tenant_type_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_licenses_tenant_type_active ON public.user_licenses USING btree (tenant_id, product_type) WHERE (is_active = true);


--
-- Name: idx_user_licenses_tenant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_licenses_tenant_user ON public.user_licenses USING btree (tenant_id, clerk_user_id) WHERE (is_active = true);


--
-- Name: uq_clinical_state_per_session; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_clinical_state_per_session ON public.clinical_states_aba USING btree (session_id) WHERE (session_id IS NOT NULL);


--
-- Name: uq_guardian_consent_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_guardian_consent_active ON public.guardian_consents USING btree (guardian_id, learner_id, consent_type) WHERE (revoked_at IS NULL);


--
-- Name: uq_notification_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_notification_idempotency ON public.notifications USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: learner_support_levels trg_append_only_support_levels; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_append_only_support_levels BEFORE DELETE OR UPDATE ON public.learner_support_levels FOR EACH ROW EXECUTE FUNCTION public.trg_fn_append_only_support_levels();


--
-- Name: axis_audit_logs trg_immutable_audit_logs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_immutable_audit_logs BEFORE DELETE OR UPDATE ON public.axis_audit_logs FOR EACH ROW EXECUTE FUNCTION public.fn_immutable_audit_logs();


--
-- Name: clinical_states_aba trg_immutable_clinical_states_aba; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_immutable_clinical_states_aba BEFORE DELETE OR UPDATE ON public.clinical_states_aba FOR EACH ROW EXECUTE FUNCTION public.trg_fn_immutable_clinical_states_aba();


--
-- Name: report_snapshots trg_immutable_report_snapshots; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_immutable_report_snapshots BEFORE DELETE OR UPDATE ON public.report_snapshots FOR EACH ROW EXECUTE FUNCTION public.trg_fn_immutable_report_snapshots();


--
-- Name: session_snapshots trg_immutable_session_snapshots; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_immutable_session_snapshots BEFORE DELETE OR UPDATE ON public.session_snapshots FOR EACH ROW EXECUTE FUNCTION public.trg_fn_immutable_session_snapshots();


--
-- Name: learner_protocols trg_protocol_status_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protocol_status_audit AFTER UPDATE ON public.learner_protocols FOR EACH ROW EXECUTE FUNCTION public.trg_fn_protocol_status_audit();


--
-- Name: sessions_aba trg_session_aba_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_session_aba_audit AFTER UPDATE ON public.sessions_aba FOR EACH ROW EXECUTE FUNCTION public.trg_fn_session_aba_audit();


--
-- Name: session_summaries trg_summary_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_summary_audit AFTER UPDATE ON public.session_summaries FOR EACH ROW EXECUTE FUNCTION public.trg_fn_summary_audit();


--
-- Name: clinical_states_aba trg_validate_clinical_state_cso; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_clinical_state_cso BEFORE INSERT ON public.clinical_states_aba FOR EACH ROW EXECUTE FUNCTION public.trg_fn_validate_clinical_state_cso();


--
-- Name: learner_protocols trg_validate_protocol_transition; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_protocol_transition BEFORE UPDATE ON public.learner_protocols FOR EACH ROW EXECUTE FUNCTION public.trg_fn_validate_protocol_transition();


--
-- Name: session_snapshots trg_validate_snapshot_cso; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_snapshot_cso BEFORE INSERT ON public.session_snapshots FOR EACH ROW EXECUTE FUNCTION public.trg_fn_validate_snapshot_cso();


--
-- Name: analyze_usage analyze_usage_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analyze_usage
    ADD CONSTRAINT analyze_usage_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;


--
-- Name: analyze_usage analyze_usage_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analyze_usage
    ADD CONSTRAINT analyze_usage_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: assist_audit_log assist_audit_log_assist_suggestion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assist_audit_log
    ADD CONSTRAINT assist_audit_log_assist_suggestion_id_fkey FOREIGN KEY (assist_suggestion_id) REFERENCES public.assist_suggestions(id);


--
-- Name: assist_audit_log assist_audit_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assist_audit_log
    ADD CONSTRAINT assist_audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: assist_suggestions assist_suggestions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assist_suggestions
    ADD CONSTRAINT assist_suggestions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: assist_suggestions assist_suggestions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assist_suggestions
    ADD CONSTRAINT assist_suggestions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id);


--
-- Name: assist_suggestions assist_suggestions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assist_suggestions
    ADD CONSTRAINT assist_suggestions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: axis_audit_logs axis_audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.axis_audit_logs
    ADD CONSTRAINT axis_audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: calendar_connections calendar_connections_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: calendar_sync_state calendar_sync_state_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sync_state
    ADD CONSTRAINT calendar_sync_state_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: case_bases case_bases_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_bases
    ADD CONSTRAINT case_bases_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: case_bases case_bases_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_bases
    ADD CONSTRAINT case_bases_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: claim_packet_items claim_packet_items_packet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_packet_items
    ADD CONSTRAINT claim_packet_items_packet_id_fkey FOREIGN KEY (packet_id) REFERENCES public.claim_packets(id) ON DELETE CASCADE;


--
-- Name: claim_packets claim_packets_coverage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_packets
    ADD CONSTRAINT claim_packets_coverage_id_fkey FOREIGN KEY (coverage_id) REFERENCES public.learner_coverage_profiles(id);


--
-- Name: claim_packets claim_packets_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_packets
    ADD CONSTRAINT claim_packets_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.profiles(id);


--
-- Name: claim_packets claim_packets_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_packets
    ADD CONSTRAINT claim_packets_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id) ON DELETE CASCADE;


--
-- Name: claim_packets claim_packets_supersedes_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_packets
    ADD CONSTRAINT claim_packets_supersedes_id_fkey FOREIGN KEY (supersedes_id) REFERENCES public.claim_packets(id);


--
-- Name: claim_packets claim_packets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_packets
    ADD CONSTRAINT claim_packets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: clinic_documents clinic_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_documents
    ADD CONSTRAINT clinic_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: clinical_records clinical_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_records
    ADD CONSTRAINT clinical_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: clinical_records clinical_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_records
    ADD CONSTRAINT clinical_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: clinical_states_aba clinical_states_aba_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_states_aba
    ADD CONSTRAINT clinical_states_aba_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id) ON DELETE CASCADE;


--
-- Name: clinical_states_aba clinical_states_aba_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_states_aba
    ADD CONSTRAINT clinical_states_aba_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions_aba(id);


--
-- Name: clinical_states_aba clinical_states_aba_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_states_aba
    ADD CONSTRAINT clinical_states_aba_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: clinical_states clinical_states_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_states
    ADD CONSTRAINT clinical_states_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: clinical_states_tdah clinical_states_tdah_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_states_tdah
    ADD CONSTRAINT clinical_states_tdah_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id);


--
-- Name: clinical_states_tdah clinical_states_tdah_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_states_tdah
    ADD CONSTRAINT clinical_states_tdah_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: clinical_states clinical_states_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_states
    ADD CONSTRAINT clinical_states_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: compliance_checklist compliance_checklist_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklist
    ADD CONSTRAINT compliance_checklist_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: convenio_reports convenio_reports_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_reports
    ADD CONSTRAINT convenio_reports_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id);


--
-- Name: convenio_reports convenio_reports_report_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_reports
    ADD CONSTRAINT convenio_reports_report_snapshot_id_fkey FOREIGN KEY (report_snapshot_id) REFERENCES public.report_snapshots(id);


--
-- Name: convenio_reports convenio_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_reports
    ADD CONSTRAINT convenio_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: email_logs email_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: events events_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: events events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: exposure_hierarchies exposure_hierarchies_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exposure_hierarchies
    ADD CONSTRAINT exposure_hierarchies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: exposure_hierarchies exposure_hierarchies_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exposure_hierarchies
    ADD CONSTRAINT exposure_hierarchies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: exposure_items exposure_items_hierarchy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exposure_items
    ADD CONSTRAINT exposure_items_hierarchy_id_fkey FOREIGN KEY (hierarchy_id) REFERENCES public.exposure_hierarchies(id);


--
-- Name: family_portal_access family_portal_access_consent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_portal_access
    ADD CONSTRAINT family_portal_access_consent_id_fkey FOREIGN KEY (consent_id) REFERENCES public.guardian_consents(id);


--
-- Name: family_portal_access family_portal_access_guardian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_portal_access
    ADD CONSTRAINT family_portal_access_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES public.guardians(id) ON DELETE CASCADE;


--
-- Name: family_portal_access family_portal_access_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_portal_access
    ADD CONSTRAINT family_portal_access_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id) ON DELETE CASCADE;


--
-- Name: family_portal_access family_portal_access_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_portal_access
    ADD CONSTRAINT family_portal_access_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: learner_coverage_profiles fk_coverage_payer_profile; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_coverage_profiles
    ADD CONSTRAINT fk_coverage_payer_profile FOREIGN KEY (payer_profile_id) REFERENCES public.payer_requirement_profiles(id) ON DELETE SET NULL;


--
-- Name: tdah_observations fk_tdah_observations_protocol; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_observations
    ADD CONSTRAINT fk_tdah_observations_protocol FOREIGN KEY (protocol_id) REFERENCES public.tdah_protocols(id);


--
-- Name: tdah_teacher_tokens fk_teacher_token_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_teacher_tokens
    ADD CONSTRAINT fk_teacher_token_patient FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id);


--
-- Name: tdah_teacher_tokens fk_teacher_token_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_teacher_tokens
    ADD CONSTRAINT fk_teacher_token_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: generalization_probes generalization_probes_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generalization_probes
    ADD CONSTRAINT generalization_probes_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id) ON DELETE CASCADE;


--
-- Name: generalization_probes generalization_probes_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generalization_probes
    ADD CONSTRAINT generalization_probes_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.learner_protocols(id) ON DELETE CASCADE;


--
-- Name: generalization_probes generalization_probes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generalization_probes
    ADD CONSTRAINT generalization_probes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: guardian_consents guardian_consents_guardian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_consents
    ADD CONSTRAINT guardian_consents_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES public.guardians(id) ON DELETE CASCADE;


--
-- Name: guardian_consents guardian_consents_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_consents
    ADD CONSTRAINT guardian_consents_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id) ON DELETE CASCADE;


--
-- Name: guardian_consents guardian_consents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardian_consents
    ADD CONSTRAINT guardian_consents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: guardians guardians_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardians
    ADD CONSTRAINT guardians_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id) ON DELETE CASCADE;


--
-- Name: guardians guardians_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardians
    ADD CONSTRAINT guardians_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: integrity_flags integrity_flags_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrity_flags
    ADD CONSTRAINT integrity_flags_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: integrity_flags integrity_flags_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrity_flags
    ADD CONSTRAINT integrity_flags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: learner_coverage_profiles learner_coverage_profiles_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_coverage_profiles
    ADD CONSTRAINT learner_coverage_profiles_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id) ON DELETE CASCADE;


--
-- Name: learner_coverage_profiles learner_coverage_profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_coverage_profiles
    ADD CONSTRAINT learner_coverage_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: learner_protocols learner_protocols_ebp_practice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_protocols
    ADD CONSTRAINT learner_protocols_ebp_practice_id_fkey FOREIGN KEY (ebp_practice_id) REFERENCES public.ebp_practices(id);


--
-- Name: learner_protocols learner_protocols_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_protocols
    ADD CONSTRAINT learner_protocols_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id) ON DELETE CASCADE;


--
-- Name: learner_protocols learner_protocols_pei_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_protocols
    ADD CONSTRAINT learner_protocols_pei_goal_id_fkey FOREIGN KEY (pei_goal_id) REFERENCES public.pei_goals(id);


--
-- Name: learner_protocols learner_protocols_protocol_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_protocols
    ADD CONSTRAINT learner_protocols_protocol_library_id_fkey FOREIGN KEY (protocol_library_id) REFERENCES public.protocol_library(id);


--
-- Name: learner_protocols learner_protocols_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_protocols
    ADD CONSTRAINT learner_protocols_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: learner_support_levels learner_support_levels_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_support_levels
    ADD CONSTRAINT learner_support_levels_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id) ON DELETE CASCADE;


--
-- Name: learner_support_levels learner_support_levels_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_support_levels
    ADD CONSTRAINT learner_support_levels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: learner_therapists learner_therapists_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_therapists
    ADD CONSTRAINT learner_therapists_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id);


--
-- Name: learner_therapists learner_therapists_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_therapists
    ADD CONSTRAINT learner_therapists_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: learner_therapists learner_therapists_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_therapists
    ADD CONSTRAINT learner_therapists_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: learners learners_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learners
    ADD CONSTRAINT learners_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: maintenance_probes maintenance_probes_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_probes
    ADD CONSTRAINT maintenance_probes_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id) ON DELETE CASCADE;


--
-- Name: maintenance_probes maintenance_probes_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_probes
    ADD CONSTRAINT maintenance_probes_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.learner_protocols(id) ON DELETE CASCADE;


--
-- Name: maintenance_probes maintenance_probes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_probes
    ADD CONSTRAINT maintenance_probes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: onboarding_progress onboarding_progress_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_onboarding_status patient_onboarding_status_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_onboarding_status
    ADD CONSTRAINT patient_onboarding_status_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: patient_onboarding_status patient_onboarding_status_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_onboarding_status
    ADD CONSTRAINT patient_onboarding_status_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patient_push_tokens patient_push_tokens_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_push_tokens
    ADD CONSTRAINT patient_push_tokens_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: patient_push_tokens patient_push_tokens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_push_tokens
    ADD CONSTRAINT patient_push_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: patients patients_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payer_requirement_profiles payer_requirement_profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payer_requirement_profiles
    ADD CONSTRAINT payer_requirement_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payer_submissions payer_submissions_packet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payer_submissions
    ADD CONSTRAINT payer_submissions_packet_id_fkey FOREIGN KEY (packet_id) REFERENCES public.claim_packets(id) ON DELETE CASCADE;


--
-- Name: payer_submissions payer_submissions_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payer_submissions
    ADD CONSTRAINT payer_submissions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.profiles(id);


--
-- Name: payer_submissions payer_submissions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payer_submissions
    ADD CONSTRAINT payer_submissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: pei_goals pei_goals_pei_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pei_goals
    ADD CONSTRAINT pei_goals_pei_plan_id_fkey FOREIGN KEY (pei_plan_id) REFERENCES public.pei_plans(id) ON DELETE CASCADE;


--
-- Name: pei_plans pei_plans_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pei_plans
    ADD CONSTRAINT pei_plans_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id) ON DELETE CASCADE;


--
-- Name: pei_plans pei_plans_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pei_plans
    ADD CONSTRAINT pei_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: professional_preferences professional_preferences_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_preferences
    ADD CONSTRAINT professional_preferences_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: profiles profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: protocol_library protocol_library_ebp_practice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_library
    ADD CONSTRAINT protocol_library_ebp_practice_id_fkey FOREIGN KEY (ebp_practice_id) REFERENCES public.ebp_practices(id);


--
-- Name: protocol_library protocol_library_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_library
    ADD CONSTRAINT protocol_library_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: provider_credentials provider_credentials_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_credentials
    ADD CONSTRAINT provider_credentials_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: provider_credentials provider_credentials_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_credentials
    ADD CONSTRAINT provider_credentials_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: push_tokens push_tokens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: rag_config rag_config_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_config
    ADD CONSTRAINT rag_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: report_snapshots report_snapshots_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_snapshots
    ADD CONSTRAINT report_snapshots_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id);


--
-- Name: report_snapshots report_snapshots_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_snapshots
    ADD CONSTRAINT report_snapshots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: scheduled_reminders scheduled_reminders_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_reminders
    ADD CONSTRAINT scheduled_reminders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: scheduled_reminders scheduled_reminders_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_reminders
    ADD CONSTRAINT scheduled_reminders_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: scheduled_reminders scheduled_reminders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_reminders
    ADD CONSTRAINT scheduled_reminders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: service_sites service_sites_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sites
    ADD CONSTRAINT service_sites_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: session_attachments session_attachments_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attachments
    ADD CONSTRAINT session_attachments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions_aba(id) ON DELETE CASCADE;


--
-- Name: session_attachments session_attachments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attachments
    ADD CONSTRAINT session_attachments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: session_attachments session_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attachments
    ADD CONSTRAINT session_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);


--
-- Name: session_attestations session_attestations_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attestations
    ADD CONSTRAINT session_attestations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions_aba(id) ON DELETE CASCADE;


--
-- Name: session_attestations session_attestations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attestations
    ADD CONSTRAINT session_attestations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: session_behaviors session_behaviors_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_behaviors
    ADD CONSTRAINT session_behaviors_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions_aba(id) ON DELETE CASCADE;


--
-- Name: session_behaviors session_behaviors_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_behaviors
    ADD CONSTRAINT session_behaviors_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: session_evidence_bundles session_evidence_bundles_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_evidence_bundles
    ADD CONSTRAINT session_evidence_bundles_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions_aba(id) ON DELETE CASCADE;


--
-- Name: session_evidence_bundles session_evidence_bundles_supersedes_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_evidence_bundles
    ADD CONSTRAINT session_evidence_bundles_supersedes_id_fkey FOREIGN KEY (supersedes_id) REFERENCES public.session_evidence_bundles(id);


--
-- Name: session_evidence_bundles session_evidence_bundles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_evidence_bundles
    ADD CONSTRAINT session_evidence_bundles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: session_notes session_notes_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id);


--
-- Name: session_notes session_notes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: session_presence_proofs session_presence_proofs_captured_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_presence_proofs
    ADD CONSTRAINT session_presence_proofs_captured_by_fkey FOREIGN KEY (captured_by) REFERENCES public.profiles(id);


--
-- Name: session_presence_proofs session_presence_proofs_declared_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_presence_proofs
    ADD CONSTRAINT session_presence_proofs_declared_site_id_fkey FOREIGN KEY (declared_site_id) REFERENCES public.service_sites(id);


--
-- Name: session_presence_proofs session_presence_proofs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_presence_proofs
    ADD CONSTRAINT session_presence_proofs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions_aba(id) ON DELETE CASCADE;


--
-- Name: session_presence_proofs session_presence_proofs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_presence_proofs
    ADD CONSTRAINT session_presence_proofs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: session_reports session_reports_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_reports
    ADD CONSTRAINT session_reports_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: session_reports session_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_reports
    ADD CONSTRAINT session_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: session_snapshots session_snapshots_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_snapshots
    ADD CONSTRAINT session_snapshots_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id);


--
-- Name: session_snapshots session_snapshots_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_snapshots
    ADD CONSTRAINT session_snapshots_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions_aba(id);


--
-- Name: session_snapshots session_snapshots_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_snapshots
    ADD CONSTRAINT session_snapshots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: session_summaries session_summaries_email_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_summaries
    ADD CONSTRAINT session_summaries_email_log_id_fkey FOREIGN KEY (email_log_id) REFERENCES public.email_logs(id);


--
-- Name: session_summaries session_summaries_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_summaries
    ADD CONSTRAINT session_summaries_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id);


--
-- Name: session_summaries session_summaries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_summaries
    ADD CONSTRAINT session_summaries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: session_targets session_targets_applied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_targets
    ADD CONSTRAINT session_targets_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES public.profiles(id);


--
-- Name: session_targets session_targets_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_targets
    ADD CONSTRAINT session_targets_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.learner_protocols(id);


--
-- Name: session_targets session_targets_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_targets
    ADD CONSTRAINT session_targets_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions_aba(id) ON DELETE CASCADE;


--
-- Name: session_targets session_targets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_targets
    ADD CONSTRAINT session_targets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: sessions_aba sessions_aba_applied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_aba
    ADD CONSTRAINT sessions_aba_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES public.profiles(id);


--
-- Name: sessions_aba sessions_aba_declared_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_aba
    ADD CONSTRAINT sessions_aba_declared_site_id_fkey FOREIGN KEY (declared_site_id) REFERENCES public.service_sites(id);


--
-- Name: sessions_aba sessions_aba_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_aba
    ADD CONSTRAINT sessions_aba_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id) ON DELETE CASCADE;


--
-- Name: sessions_aba sessions_aba_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_aba
    ADD CONSTRAINT sessions_aba_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_cso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_cso_id_fkey FOREIGN KEY (cso_id) REFERENCES public.clinical_states(id);


--
-- Name: sessions sessions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: sessions sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: suggestion_decisions suggestion_decisions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_decisions
    ADD CONSTRAINT suggestion_decisions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: suggestion_decisions suggestion_decisions_suggestion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_decisions
    ADD CONSTRAINT suggestion_decisions_suggestion_id_fkey FOREIGN KEY (suggestion_id) REFERENCES public.suggestions(id);


--
-- Name: suggestion_decisions suggestion_decisions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_decisions
    ADD CONSTRAINT suggestion_decisions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: suggestion_log_aba suggestion_log_aba_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_log_aba
    ADD CONSTRAINT suggestion_log_aba_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(id);


--
-- Name: suggestion_log_aba suggestion_log_aba_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_log_aba
    ADD CONSTRAINT suggestion_log_aba_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.learner_protocols(id);


--
-- Name: suggestion_log_aba suggestion_log_aba_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_log_aba
    ADD CONSTRAINT suggestion_log_aba_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions_aba(id);


--
-- Name: suggestion_log_aba suggestion_log_aba_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestion_log_aba
    ADD CONSTRAINT suggestion_log_aba_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: suggestions suggestions_cso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_cso_id_fkey FOREIGN KEY (cso_id) REFERENCES public.clinical_states(id);


--
-- Name: suggestions suggestions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: suggestions suggestions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tasks tasks_assigned_in_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_in_session_id_fkey FOREIGN KEY (assigned_in_session_id) REFERENCES public.sessions(id);


--
-- Name: tasks tasks_hierarchy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_hierarchy_id_fkey FOREIGN KEY (hierarchy_id) REFERENCES public.exposure_hierarchies(id);


--
-- Name: tasks tasks_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: tasks tasks_reviewed_in_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_reviewed_in_session_id_fkey FOREIGN KEY (reviewed_in_session_id) REFERENCES public.sessions(id);


--
-- Name: tasks tasks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tcc_analyses tcc_analyses_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcc_analyses
    ADD CONSTRAINT tcc_analyses_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: tcc_analyses tcc_analyses_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcc_analyses
    ADD CONSTRAINT tcc_analyses_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id);


--
-- Name: tcc_analyses tcc_analyses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcc_analyses
    ADD CONSTRAINT tcc_analyses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_audhd_log tdah_audhd_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_audhd_log
    ADD CONSTRAINT tdah_audhd_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id);


--
-- Name: tdah_audhd_log tdah_audhd_log_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_audhd_log
    ADD CONSTRAINT tdah_audhd_log_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id);


--
-- Name: tdah_audhd_log tdah_audhd_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_audhd_log
    ADD CONSTRAINT tdah_audhd_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_drc tdah_drc_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_drc
    ADD CONSTRAINT tdah_drc_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id);


--
-- Name: tdah_drc tdah_drc_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_drc
    ADD CONSTRAINT tdah_drc_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.tdah_protocols(id);


--
-- Name: tdah_drc tdah_drc_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_drc
    ADD CONSTRAINT tdah_drc_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: tdah_drc tdah_drc_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_drc
    ADD CONSTRAINT tdah_drc_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_events tdah_events_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_events
    ADD CONSTRAINT tdah_events_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id);


--
-- Name: tdah_events tdah_events_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_events
    ADD CONSTRAINT tdah_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.tdah_sessions(id);


--
-- Name: tdah_events tdah_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_events
    ADD CONSTRAINT tdah_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_family_access_log tdah_family_access_log_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_family_access_log
    ADD CONSTRAINT tdah_family_access_log_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.tdah_family_tokens(id);


--
-- Name: tdah_family_tokens tdah_family_tokens_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_family_tokens
    ADD CONSTRAINT tdah_family_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: tdah_family_tokens tdah_family_tokens_guardian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_family_tokens
    ADD CONSTRAINT tdah_family_tokens_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES public.tdah_guardians(id);


--
-- Name: tdah_family_tokens tdah_family_tokens_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_family_tokens
    ADD CONSTRAINT tdah_family_tokens_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id);


--
-- Name: tdah_family_tokens tdah_family_tokens_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_family_tokens
    ADD CONSTRAINT tdah_family_tokens_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.profiles(id);


--
-- Name: tdah_family_tokens tdah_family_tokens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_family_tokens
    ADD CONSTRAINT tdah_family_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_guardians tdah_guardians_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_guardians
    ADD CONSTRAINT tdah_guardians_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id);


--
-- Name: tdah_guardians tdah_guardians_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_guardians
    ADD CONSTRAINT tdah_guardians_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_observations tdah_observations_observed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_observations
    ADD CONSTRAINT tdah_observations_observed_by_fkey FOREIGN KEY (observed_by) REFERENCES public.profiles(id);


--
-- Name: tdah_observations tdah_observations_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_observations
    ADD CONSTRAINT tdah_observations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.tdah_sessions(id);


--
-- Name: tdah_observations tdah_observations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_observations
    ADD CONSTRAINT tdah_observations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_patient_therapists tdah_patient_therapists_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_patient_therapists
    ADD CONSTRAINT tdah_patient_therapists_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id);


--
-- Name: tdah_patient_therapists tdah_patient_therapists_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_patient_therapists
    ADD CONSTRAINT tdah_patient_therapists_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id) ON DELETE CASCADE;


--
-- Name: tdah_patient_therapists tdah_patient_therapists_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_patient_therapists
    ADD CONSTRAINT tdah_patient_therapists_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: tdah_patient_therapists tdah_patient_therapists_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_patient_therapists
    ADD CONSTRAINT tdah_patient_therapists_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tdah_patients tdah_patients_audhd_layer_activated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_patients
    ADD CONSTRAINT tdah_patients_audhd_layer_activated_by_fkey FOREIGN KEY (audhd_layer_activated_by) REFERENCES public.profiles(id);


--
-- Name: tdah_patients tdah_patients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_patients
    ADD CONSTRAINT tdah_patients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: tdah_patients tdah_patients_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_patients
    ADD CONSTRAINT tdah_patients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_plan_goals tdah_plan_goals_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_plan_goals
    ADD CONSTRAINT tdah_plan_goals_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.tdah_plans(id);


--
-- Name: tdah_plan_goals tdah_plan_goals_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_plan_goals
    ADD CONSTRAINT tdah_plan_goals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_plans tdah_plans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_plans
    ADD CONSTRAINT tdah_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: tdah_plans tdah_plans_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_plans
    ADD CONSTRAINT tdah_plans_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id);


--
-- Name: tdah_plans tdah_plans_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_plans
    ADD CONSTRAINT tdah_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_protocols tdah_protocols_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_protocols
    ADD CONSTRAINT tdah_protocols_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: tdah_protocols tdah_protocols_library_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_protocols
    ADD CONSTRAINT tdah_protocols_library_protocol_id_fkey FOREIGN KEY (library_protocol_id) REFERENCES public.tdah_protocol_library(id);


--
-- Name: tdah_protocols tdah_protocols_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_protocols
    ADD CONSTRAINT tdah_protocols_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id);


--
-- Name: tdah_protocols tdah_protocols_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_protocols
    ADD CONSTRAINT tdah_protocols_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_routines tdah_routines_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_routines
    ADD CONSTRAINT tdah_routines_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id);


--
-- Name: tdah_routines tdah_routines_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_routines
    ADD CONSTRAINT tdah_routines_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_sessions tdah_sessions_clinician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_sessions
    ADD CONSTRAINT tdah_sessions_clinician_id_fkey FOREIGN KEY (clinician_id) REFERENCES public.profiles(id);


--
-- Name: tdah_sessions tdah_sessions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_sessions
    ADD CONSTRAINT tdah_sessions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id);


--
-- Name: tdah_sessions tdah_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_sessions
    ADD CONSTRAINT tdah_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_sessions tdah_sessions_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_sessions
    ADD CONSTRAINT tdah_sessions_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.profiles(id);


--
-- Name: tdah_snapshots tdah_snapshots_generated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_snapshots
    ADD CONSTRAINT tdah_snapshots_generated_by_user_id_fkey FOREIGN KEY (generated_by_user_id) REFERENCES public.profiles(id);


--
-- Name: tdah_snapshots tdah_snapshots_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_snapshots
    ADD CONSTRAINT tdah_snapshots_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id);


--
-- Name: tdah_snapshots tdah_snapshots_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_snapshots
    ADD CONSTRAINT tdah_snapshots_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.tdah_sessions(id);


--
-- Name: tdah_snapshots tdah_snapshots_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_snapshots
    ADD CONSTRAINT tdah_snapshots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_teacher_access_log tdah_teacher_access_log_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_teacher_access_log
    ADD CONSTRAINT tdah_teacher_access_log_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.tdah_teacher_tokens(id);


--
-- Name: tdah_teacher_tokens tdah_teacher_tokens_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_teacher_tokens
    ADD CONSTRAINT tdah_teacher_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: tdah_teacher_tokens tdah_teacher_tokens_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_teacher_tokens
    ADD CONSTRAINT tdah_teacher_tokens_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id);


--
-- Name: tdah_teacher_tokens tdah_teacher_tokens_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_teacher_tokens
    ADD CONSTRAINT tdah_teacher_tokens_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.profiles(id);


--
-- Name: tdah_teacher_tokens tdah_teacher_tokens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_teacher_tokens
    ADD CONSTRAINT tdah_teacher_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_token_economy tdah_token_economy_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_token_economy
    ADD CONSTRAINT tdah_token_economy_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: tdah_token_economy tdah_token_economy_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_token_economy
    ADD CONSTRAINT tdah_token_economy_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.tdah_patients(id);


--
-- Name: tdah_token_economy tdah_token_economy_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_token_economy
    ADD CONSTRAINT tdah_token_economy_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.tdah_protocols(id);


--
-- Name: tdah_token_economy tdah_token_economy_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_token_economy
    ADD CONSTRAINT tdah_token_economy_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tdah_token_transactions tdah_token_transactions_economy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tdah_token_transactions
    ADD CONSTRAINT tdah_token_transactions_economy_id_fkey FOREIGN KEY (economy_id) REFERENCES public.tdah_token_economy(id);


--
-- Name: transcript_segments transcript_segments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcript_segments
    ADD CONSTRAINT transcript_segments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: transcript_segments transcript_segments_transcript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcript_segments
    ADD CONSTRAINT transcript_segments_transcript_id_fkey FOREIGN KEY (transcript_id) REFERENCES public.transcripts(id) ON DELETE CASCADE;


--
-- Name: transcription_jobs transcription_jobs_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcription_jobs
    ADD CONSTRAINT transcription_jobs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: transcription_jobs transcription_jobs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcription_jobs
    ADD CONSTRAINT transcription_jobs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id);


--
-- Name: transcription_jobs transcription_jobs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcription_jobs
    ADD CONSTRAINT transcription_jobs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: transcription_usage transcription_usage_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcription_usage
    ADD CONSTRAINT transcription_usage_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: transcripts transcripts_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcripts
    ADD CONSTRAINT transcripts_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: transcripts transcripts_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcripts
    ADD CONSTRAINT transcripts_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id);


--
-- Name: transcripts transcripts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcripts
    ADD CONSTRAINT transcripts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: user_licenses user_licenses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_licenses
    ADD CONSTRAINT user_licenses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: analyze_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analyze_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: session_attachments attachments_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attachments_tenant_isolation ON public.session_attachments USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: session_attestations attestations_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attestations_tenant_isolation ON public.session_attestations USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: case_bases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.case_bases ENABLE ROW LEVEL SECURITY;

--
-- Name: claim_packets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.claim_packets ENABLE ROW LEVEL SECURITY;

--
-- Name: claim_packets claim_packets_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY claim_packets_tenant_isolation ON public.claim_packets USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: clinical_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_records ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_states ENABLE ROW LEVEL SECURITY;

--
-- Name: clinical_states_aba; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_states_aba ENABLE ROW LEVEL SECURITY;

--
-- Name: convenio_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.convenio_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: session_evidence_bundles evidence_bundles_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_bundles_tenant_isolation ON public.session_evidence_bundles USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: exposure_hierarchies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exposure_hierarchies ENABLE ROW LEVEL SECURITY;

--
-- Name: family_portal_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.family_portal_access ENABLE ROW LEVEL SECURITY;

--
-- Name: generalization_probes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.generalization_probes ENABLE ROW LEVEL SECURITY;

--
-- Name: guardian_consents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guardian_consents ENABLE ROW LEVEL SECURITY;

--
-- Name: guardians; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;

--
-- Name: integrity_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integrity_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: integrity_flags integrity_flags_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY integrity_flags_tenant_isolation ON public.integrity_flags USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: learner_coverage_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learner_coverage_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: learner_coverage_profiles learner_coverage_profiles_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learner_coverage_profiles_tenant_isolation ON public.learner_coverage_profiles USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: learner_protocols; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learner_protocols ENABLE ROW LEVEL SECURITY;

--
-- Name: learner_support_levels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learner_support_levels ENABLE ROW LEVEL SECURITY;

--
-- Name: learners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learners ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_probes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_probes ENABLE ROW LEVEL SECURITY;

--
-- Name: patients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

--
-- Name: payer_requirement_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payer_requirement_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: payer_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payer_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: payer_submissions payer_submissions_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payer_submissions_tenant_isolation ON public.payer_submissions USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: pei_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pei_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: session_presence_proofs presence_proofs_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presence_proofs_tenant_isolation ON public.session_presence_proofs USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: provider_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_credentials provider_credentials_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY provider_credentials_tenant_isolation ON public.provider_credentials USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: report_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: service_sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_sites ENABLE ROW LEVEL SECURITY;

--
-- Name: service_sites service_sites_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_sites_tenant_isolation ON public.service_sites USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: session_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: session_attestations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_attestations ENABLE ROW LEVEL SECURITY;

--
-- Name: session_behaviors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_behaviors ENABLE ROW LEVEL SECURITY;

--
-- Name: session_evidence_bundles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_evidence_bundles ENABLE ROW LEVEL SECURITY;

--
-- Name: session_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: session_presence_proofs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_presence_proofs ENABLE ROW LEVEL SECURITY;

--
-- Name: session_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: session_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: session_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: session_targets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_targets ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions_aba; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions_aba ENABLE ROW LEVEL SECURITY;

--
-- Name: suggestion_decisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suggestion_decisions ENABLE ROW LEVEL SECURITY;

--
-- Name: suggestion_log_aba; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suggestion_log_aba ENABLE ROW LEVEL SECURITY;

--
-- Name: suggestions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

--
-- Name: tcc_analyses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcc_analyses ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_audhd_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_audhd_log ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_drc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_drc ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_events ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_family_access_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_family_access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_guardians; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_guardians ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_observations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_observations ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_patient_therapists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_patient_therapists ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_patients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_patients ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_plan_goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_plan_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_protocols; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_protocols ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_routines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_routines ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_teacher_access_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_teacher_access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_token_economy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_token_economy ENABLE ROW LEVEL SECURITY;

--
-- Name: tdah_token_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tdah_token_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: analyze_usage tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.analyze_usage USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: case_bases tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.case_bases USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: clinical_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.clinical_records USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: clinical_states tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.clinical_states USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: clinical_states_aba tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.clinical_states_aba USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: convenio_reports tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.convenio_reports USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.events USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: exposure_hierarchies tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.exposure_hierarchies USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: family_portal_access tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.family_portal_access USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: generalization_probes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.generalization_probes USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: guardian_consents tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.guardian_consents USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: guardians tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.guardians USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: learner_protocols tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.learner_protocols USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: learner_support_levels tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.learner_support_levels USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: learners tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.learners USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: maintenance_probes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.maintenance_probes USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: patients tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.patients USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: pei_plans tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.pei_plans USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: report_snapshots tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.report_snapshots USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: session_behaviors tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.session_behaviors USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: session_notes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.session_notes USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: session_reports tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.session_reports USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: session_snapshots tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.session_snapshots USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: session_summaries tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.session_summaries USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: session_targets tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.session_targets USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: sessions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.sessions USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: sessions_aba tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.sessions_aba USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: suggestion_decisions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.suggestion_decisions USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: suggestion_log_aba tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.suggestion_log_aba USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: suggestions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.suggestions USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tcc_analyses tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tcc_analyses USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_audhd_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_audhd_log USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_drc tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_drc USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_events USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_family_access_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_family_access_log USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_guardians tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_guardians USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_observations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_observations USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_patient_therapists tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_patient_therapists USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_patients tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_patients USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_plan_goals tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_plan_goals USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_plans tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_plans USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_protocols tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_protocols USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_routines tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_routines USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_sessions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_sessions USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_snapshots tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_snapshots USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_teacher_access_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_teacher_access_log USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_token_economy tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_token_economy USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: tdah_token_transactions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tdah_token_transactions USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: transcript_segments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.transcript_segments USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: transcription_jobs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.transcription_jobs USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: transcripts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.transcripts USING ((tenant_id = public.app_tenant_id())) WITH CHECK ((tenant_id = public.app_tenant_id()));


--
-- Name: transcript_segments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;

--
-- Name: transcription_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transcription_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: transcripts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

--
-- Name: transcript_segments worker_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY worker_access ON public.transcript_segments USING ((current_setting('app.worker_mode'::text, true) = 'true'::text)) WITH CHECK ((current_setting('app.worker_mode'::text, true) = 'true'::text));


--
-- Name: transcription_jobs worker_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY worker_access ON public.transcription_jobs USING ((current_setting('app.is_worker'::text, true) = 'true'::text)) WITH CHECK ((current_setting('app.is_worker'::text, true) = 'true'::text));


--
-- PostgreSQL database dump complete
--

COMMIT;
