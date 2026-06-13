-- 074_shared_harden_patient_push_token_lookup_search_path.sql
-- F7 hardening: fixa search_path em patient_push_token_lookup()
--
-- Contexto:
--   A migration 070 criou patient_push_token_lookup() como SECURITY DEFINER,
--   mas sem SET search_path fixo.
--   071/072 ja adotam SET search_path = public para reduzir risco de
--   schema hijacking em SECURITY DEFINER.
--
-- Objetivo:
--   Recriar a mesma function da 070, sem mudar contrato, adicionando:
--   SET search_path = public
--
-- Reversivel:
--   Reaplicar a definicao anterior da 070, se necessario.

BEGIN;

CREATE OR REPLACE FUNCTION patient_push_token_lookup(p_token text)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  full_name text,
  push_auth_token_expires_at timestamptz
)
SECURITY DEFINER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    p.id,
    p.tenant_id,
    p.full_name,
    p.push_auth_token_expires_at
  FROM patients p
  WHERE p.push_auth_token = p_token;
$$;

REVOKE ALL ON FUNCTION patient_push_token_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION patient_push_token_lookup(text) TO axis_app;

COMMIT;