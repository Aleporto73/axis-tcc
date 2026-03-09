-- Migration 014: Função SECURITY DEFINER para lookup de token do Portal Família
-- Necessário porque a rota /portal/[token] é pública (sem auth),
-- mas family_portal_access tem RLS com forced row security.
-- A function roda como owner (superuser), bypassing RLS para o lookup inicial.

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

-- Permissão para o role axis executar a function
GRANT EXECUTE ON FUNCTION portal_token_lookup(text) TO axis;
