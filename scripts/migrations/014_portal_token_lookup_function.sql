-- Migration 014: Functions SECURITY DEFINER para o Portal Família
--
-- CONTEXTO: Todas as tabelas do AXIS têm RLS com forced row security.
-- O Portal Família é rota pública (sem auth, token-based).
-- O role "axis" não tem BYPASSRLS, então queries diretas falham.
-- Solução: functions SECURITY DEFINER rodam como owner, bypassing RLS.
--
-- Schema real verificado em 09/03/2026:
--   learners: name (não full_name), birth_date, diagnosis, support_level
--   session_summaries: summary_text (não content), is_approved (não status)
--   learner_protocols: title, domain, status, created_at
--   sessions_aba: scheduled_at, duration_minutes, status
--   family_portal_access: access_token, is_active, token_expires_at

-- Drop versão anterior se existir
DROP FUNCTION IF EXISTS portal_token_lookup(text);

-- 1. Lookup do token — retorna dados de acesso + tenant_id
CREATE OR REPLACE FUNCTION portal_token_lookup(p_token text)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  guardian_id uuid,
  learner_id uuid,
  access_token text,
  token_expires_at timestamptz,
  is_active boolean,
  consent_accepted timestamptz
)
SECURITY DEFINER
LANGUAGE sql
STABLE
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

-- 2. Atualiza last_accessed_at (UPDATE também precisa bypass RLS)
CREATE OR REPLACE FUNCTION portal_update_last_access(p_token text)
RETURNS void
SECURITY DEFINER
LANGUAGE sql
AS $$
  UPDATE family_portal_access
  SET last_accessed_at = NOW()
  WHERE access_token = p_token;
$$;

-- 3. Dados do aprendiz para o portal (campos seguros, sem scores clínicos)
CREATE OR REPLACE FUNCTION portal_get_learner(p_learner_id uuid, p_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  name varchar,
  birth_date date,
  diagnosis varchar,
  support_level smallint
)
SECURITY DEFINER
LANGUAGE sql
STABLE
AS $$
  SELECT l.id, l.name, l.birth_date, l.diagnosis, l.support_level
  FROM learners l
  WHERE l.id = p_learner_id AND l.tenant_id = p_tenant_id;
$$;

-- 4. Resumos de sessão aprovados
CREATE OR REPLACE FUNCTION portal_get_summaries(p_learner_id uuid, p_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  content text,
  approved_at timestamptz,
  scheduled_at timestamptz,
  duration_minutes integer
)
SECURITY DEFINER
LANGUAGE sql
STABLE
AS $$
  SELECT ss.id, ss.content, ss.approved_at, s.scheduled_at, s.duration_minutes
  FROM session_summaries ss
  JOIN sessions_aba s ON s.id = ss.session_id
  WHERE ss.learner_id = p_learner_id AND ss.tenant_id = p_tenant_id
    AND ss.status = 'approved'
  ORDER BY s.scheduled_at DESC
  LIMIT 10;
$$;

-- 5. Protocolos com status simplificado (sem scores)
CREATE OR REPLACE FUNCTION portal_get_protocols(p_learner_id uuid, p_tenant_id uuid)
RETURNS TABLE (
  title varchar,
  domain varchar,
  status aba_protocol_status,
  status_simplificado text
)
SECURITY DEFINER
LANGUAGE sql
STABLE
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

-- 6. Próximas sessões
CREATE OR REPLACE FUNCTION portal_get_upcoming(p_learner_id uuid, p_tenant_id uuid)
RETURNS TABLE (
  scheduled_at timestamptz,
  duration_minutes integer,
  status aba_session_status
)
SECURITY DEFINER
LANGUAGE sql
STABLE
AS $$
  SELECT s.scheduled_at, s.duration_minutes, s.status
  FROM sessions_aba s
  WHERE s.learner_id = p_learner_id AND s.tenant_id = p_tenant_id
    AND s.scheduled_at > NOW() AND s.status != 'cancelled'
  ORDER BY s.scheduled_at ASC
  LIMIT 5;
$$;

-- 7. Conquistas (protocolos dominados/mantidos)
CREATE OR REPLACE FUNCTION portal_get_achievements(p_learner_id uuid, p_tenant_id uuid)
RETURNS TABLE (
  title varchar,
  domain varchar,
  updated_at timestamptz
)
SECURITY DEFINER
LANGUAGE sql
STABLE
AS $$
  SELECT lp.title, lp.domain, lp.updated_at
  FROM learner_protocols lp
  WHERE lp.learner_id = p_learner_id AND lp.tenant_id = p_tenant_id
    AND lp.status IN ('mastered','maintained','generalization','maintenance')
  ORDER BY lp.updated_at DESC
  LIMIT 10;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION portal_token_lookup(text) TO axis;
GRANT EXECUTE ON FUNCTION portal_update_last_access(text) TO axis;
GRANT EXECUTE ON FUNCTION portal_get_learner(uuid, uuid) TO axis;
GRANT EXECUTE ON FUNCTION portal_get_summaries(uuid, uuid) TO axis;
GRANT EXECUTE ON FUNCTION portal_get_protocols(uuid, uuid) TO axis;
GRANT EXECUTE ON FUNCTION portal_get_upcoming(uuid, uuid) TO axis;
GRANT EXECUTE ON FUNCTION portal_get_achievements(uuid, uuid) TO axis;
