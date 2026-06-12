-- 072_shared_calendar_webhook_lookup.sql
-- Onda 10 / F7 passo 5 — lookup de webhook Google Calendar via SECURITY DEFINER
--
-- Contexto:
--   /api/google/webhook (TCC) e /api/aba/google/webhook (ABA) sao rotas
--   PUBLICAS chamadas pelo Google — chegam SEM tenant. O tenant e resolvido
--   pelo x-goog-channel-id (+ x-goog-resource-id no TCC) com SELECT direto
--   em calendar_connections via pool (sem GUC). Quando calendar_connections
--   receber ENABLE + FORCE ROW LEVEL SECURITY (proxima migration da F7),
--   app_tenant_id() (058) levanta EXCEPTION sem GUC -> webhooks quebram.
--
--   Solucao: mesmo precedente das migrations 014/070/071 — function
--   SECURITY DEFINER fura a RLS APENAS para o lookup pontual por channel,
--   retornando o minimo necessario. O processamento do sync ja roda dentro
--   de withTenantClient nas duas rotas.
--
-- Uma function serve os dois webhooks:
--   - TCC passa (channel_id, resource_id): mismatch de resource_id = 0 rows
--     = 404 (semantica de validacao da Auditoria ABA P0 preservada).
--   - ABA passa so (channel_id): p_resource_id NULL nao filtra.
--   - clerk_user_id vem do LEFT JOIN com profiles DENTRO da function
--     (ABA usa; TCC ignora a coluna).
--
-- Pre-condicoes:
--   - calendar_connections.webhook_channel_id/webhook_resource_id/
--     webhook_token existem (baseline)
--   - axis_app: rolsuper=f, rolbypassrls=f (validado em prod)
--   - aplicar ANTES de deployar a versao dos webhooks que chama esta funcao
--   - a migration de RLS de calendar_connections vem DEPOIS desta
--
-- Reversivel: ver bloco ROLLBACK comentado abaixo.

-- =============================================================
-- VERIFICACAO POS-APLICACAO (rodar fora desta tx)
-- =============================================================
-- SELECT proname, prosecdef FROM pg_proc
-- WHERE proname = 'calendar_webhook_lookup';
-- Esperado: 1 linha, prosecdef = t
--
-- SET ROLE axis_app;
-- SELECT * FROM calendar_webhook_lookup('canal-inexistente');
-- SELECT * FROM calendar_webhook_lookup('canal-inexistente', 'res-x');
-- Esperado: 0 rows (sem erro de RLS/GUC)
-- RESET ROLE;

-- =============================================================
-- ROLLBACK (DOWN — em caso de regressao)
-- =============================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS calendar_webhook_lookup(text, text);
-- COMMIT;
-- (reverter tambem o codigo dos 2 webhooks para o SELECT direto)

BEGIN;

-- Lookup de conexao de calendario por channel do webhook Google.
-- SET search_path fixado (hardening SECURITY DEFINER, mesmo padrao da 071).
CREATE OR REPLACE FUNCTION calendar_webhook_lookup(
  p_channel_id text,
  p_resource_id text DEFAULT NULL
)
RETURNS TABLE (
  tenant_id uuid,
  user_id text,
  webhook_token text,
  clerk_user_id text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    cc.tenant_id,
    cc.user_id,
    cc.webhook_token,
    p.clerk_user_id
  FROM calendar_connections cc
  LEFT JOIN profiles p
    ON p.id::text = cc.user_id
   AND p.tenant_id = cc.tenant_id
  WHERE cc.webhook_channel_id = p_channel_id
    AND (p_resource_id IS NULL OR cc.webhook_resource_id = p_resource_id);
$$;

-- Permissoes: somente o user de runtime executa (mesmo padrao da 070/071)
REVOKE ALL ON FUNCTION calendar_webhook_lookup(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calendar_webhook_lookup(text, text) TO axis_app;

COMMIT;
