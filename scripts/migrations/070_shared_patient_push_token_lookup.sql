-- 070_shared_patient_push_token_lookup.sql
-- Onda 10 / F7 passo 3 — lookup de push_auth_token via SECURITY DEFINER
--
-- Contexto:
--   /api/patient/push/authorize e rota publica (portal do paciente,
--   token-based, sem auth Clerk). O resolver de tenant era um SELECT
--   direto em patients via pool (sem GUC). patients tem ENABLE + FORCE
--   ROW LEVEL SECURITY (baseline :4003/:10720) com policy
--   tenant_isolation = app_tenant_id(), e app_tenant_id() (058) levanta
--   EXCEPTION sem GUC -> a rota esta quebrada em prod (500).
--
--   Solucao: mesmo precedente da migration 014 (Portal Familia) —
--   function SECURITY DEFINER roda como owner e bypassa RLS apenas
--   para o lookup pontual por token.
--
-- Diferenca deliberada vs 014: a expiracao do token NAO e filtrada no
-- SQL. A rota distingue 404 (token inexistente) de 401 (token expirado)
-- e essa checagem permanece no TypeScript (comportamento atual).
--
-- Pre-condicoes:
--   - patients.push_auth_token / push_auth_token_expires_at existem (066)
--   - axis_app: rolsuper=f, rolbypassrls=f (validado em prod)
--   - aplicar ANTES de deployar a versao da rota que chama esta funcao
--
-- Reversivel: ver bloco ROLLBACK comentado abaixo.

-- =============================================================
-- VERIFICACAO POS-APLICACAO (rodar fora desta tx)
-- =============================================================
-- SELECT proname, prosecdef FROM pg_proc
-- WHERE proname = 'patient_push_token_lookup';
-- Esperado: 1 linha, prosecdef = t
--
-- SET ROLE axis_app;
-- SELECT * FROM patient_push_token_lookup('token-inexistente');
-- Esperado: 0 rows (sem erro de RLS/GUC)
-- RESET ROLE;

-- =============================================================
-- ROLLBACK (DOWN — em caso de regressao)
-- =============================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS patient_push_token_lookup(text);
-- COMMIT;
-- (a rota /api/patient/push/authorize volta a falhar com 500 — versao
--  anterior ja falhava por RLS; nao ha estado intermediario funcional)

BEGIN;

-- Lookup do token de push do paciente — retorna dados minimos + tenant_id
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
AS $$
  SELECT
    p.id,
    p.tenant_id,
    p.full_name,
    p.push_auth_token_expires_at
  FROM patients p
  WHERE p.push_auth_token = p_token;
$$;

-- Permissoes: somente o user de runtime executa (014 dava a "axis",
-- era pre-axis_app; runtime atual e axis_app)
REVOKE ALL ON FUNCTION patient_push_token_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION patient_push_token_lookup(text) TO axis_app;

COMMIT;
