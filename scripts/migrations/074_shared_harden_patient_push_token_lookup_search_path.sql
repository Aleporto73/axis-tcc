-- 074_shared_harden_patient_push_token_lookup_search_path.sql
-- F7 hardening: fixa search_path em patient_push_token_lookup()
--
-- Contexto:
--   A migration 070 criou patient_push_token_lookup() como SECURITY DEFINER,
--   mas sem SET search_path fixo.
--   071/072 ja adotam SET search_path = public para reduzir risco de
--   schema hijacking em SECURITY DEFINER.
--
-- Compatibilidade:
--   Prod possui patients.push_auth_token_expires_at.
--   Staging pode estar defasado e nao possuir essa coluna.
--   Para manter a migration aplicavel nos dois bancos, a function retorna:
--     - coluna real, quando existir;
--     - NULL::timestamptz, quando nao existir.
--
-- Objetivo:
--   Recriar patient_push_token_lookup() sem mudar assinatura, adicionando:
--   SET search_path = public

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'patients'
      AND column_name = 'push_auth_token_expires_at'
  ) THEN
    EXECUTE $fn$
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
      AS $body$
        SELECT
          p.id,
          p.tenant_id,
          p.full_name,
          p.push_auth_token_expires_at
        FROM patients p
        WHERE p.push_auth_token = p_token;
      $body$;
    $fn$;
  ELSE
    EXECUTE $fn$
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
      AS $body$
        SELECT
          p.id,
          p.tenant_id,
          p.full_name,
          NULL::timestamptz AS push_auth_token_expires_at
        FROM patients p
        WHERE p.push_auth_token = p_token;
      $body$;
    $fn$;
  END IF;
END $$;

REVOKE ALL ON FUNCTION patient_push_token_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION patient_push_token_lookup(text) TO axis_app;

COMMIT;