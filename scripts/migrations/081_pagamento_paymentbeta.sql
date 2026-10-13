-- 081_pagamento_paymentbeta.sql
-- Pagamento P1 (plano "plano-pagamento-paymentbeta", aprovado pela espinha em 13/10/2026)
--
-- Aditiva e idempotente, numa transação só:
--   1. user_licenses: plan_key, billing_source (hotmart|paymentbeta|cortesia),
--      access_until, paymentbeta_subscription_id — todas NULL.
--   2. Tabelas novas e vazias: paymentbeta_deliveries, checkout_intents.
--   3. RLS das tabelas novas no padrão da 080: ENABLE + FORCE + tenant_isolation.
--      Nenhuma política aberta.
--   4. Caminho de escrita do receptor (roda sem tenant): o mesmo pool do app
--      (axis_app) que o receptor Hotmart usa — que só grava direto porque
--      user_licenses não tem RLS. Nas tabelas novas, com RLS forçada, ele grava
--      só por 3 funções SECURITY DEFINER (search_path fixo, EXECUTE só para
--      axis_app), mesmo recurso das migrations 070/071/072.
--   5. BACKFILL de plan_key/billing_source nas licenças com hotmart_plan não
--      vazio. Regras = src/billing/license.ts (legacyPlanKey / legacyBillingSource):
--        billing_source: 'hotmart'  se hotmart_event é evento do receptor Hotmart
--                                   (PURCHASE_* ou SUBSCRIPTION_CANCELLATION)
--                        'cortesia' se hotmart_event é ADMIN_* ou hotmart_plan = 'admin_grant'
--                        nenhuma regra, ou as duas → ABORTA listando o id
--        ABA:  oferta gona25or ou plano clinica_250 → aba_250; resto pago → aba_100
--        TDAH: oferta hxzwuwfh ou plano clinica_250 → tdah_250; resto pago → tdah_100
--        TCC:  todo pago → tcc_100
--      Só preenche linha com plan_key e billing_source nulos (rodar de novo não
--      muda nada). Cada linha preenchida gera 1 registro em axis_audit_logs.
--
-- NÃO conta pacientes. Sem exceções: todo TCC pago vira tcc_100.
--
-- ORDEM DE DEPLOY: aplicar ANTES do pm2 restart (runbook PUBLICACAO 3.4 antes
-- do 3.5). O código antigo ignora as colunas novas; o código novo precisa delas.
--
-- =============================================================
-- VERIFICACAO POS-APLICACAO (rodar fora desta tx)
-- =============================================================
-- SELECT product_type, plan_key, billing_source, is_active, count(*)
--   FROM user_licenses
--  WHERE hotmart_plan IS NOT NULL AND hotmart_plan <> ''
--  GROUP BY 1,2,3,4 ORDER BY 1,2,3,4;
-- Esperado: nenhuma linha com plan_key ou billing_source NULL.
--
-- SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
--  WHERE relname IN ('paymentbeta_deliveries','checkout_intents');
-- Esperado: 2 linhas, t / t.
--
-- SET ROLE axis_app;
-- SELECT count(*) FROM checkout_intents;            -- ERRO [AXIS RLS] (sem tenant)
-- BEGIN;
-- SELECT paymentbeta_delivery_register(gen_random_uuid(), 'teste', 'v1');  -- t
-- ROLLBACK;
-- RESET ROLE;
--
-- =============================================================
-- ROLLBACK (DOWN — só se o código novo ainda NÃO estiver no ar)
-- =============================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS checkout_intent_lookup(uuid);
-- DROP FUNCTION IF EXISTS paymentbeta_delivery_result(uuid, text, uuid);
-- DROP FUNCTION IF EXISTS paymentbeta_delivery_register(uuid, text, text);
-- DROP TABLE IF EXISTS checkout_intents;
-- DROP TABLE IF EXISTS paymentbeta_deliveries;
-- ALTER TABLE user_licenses DROP CONSTRAINT IF EXISTS user_licenses_billing_source_check;
-- ALTER TABLE user_licenses
--   DROP COLUMN IF EXISTS paymentbeta_subscription_id,
--   DROP COLUMN IF EXISTS access_until,
--   DROP COLUMN IF EXISTS billing_source,
--   DROP COLUMN IF EXISTS plan_key;
-- COMMIT;
-- (os registros LICENSE_PLAN_KEY_BACKFILL em axis_audit_logs ficam: são imutáveis)

BEGIN;

-- =============================================================
-- 0) Pré-requisito: app_tenant_id() (usada pela política tenant_isolation)
-- =============================================================
DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_id') THEN
    RAISE EXCEPTION '[AXIS-081] funcao public.app_tenant_id() ausente.';
  END IF;
END
$check$;

-- =============================================================
-- 1) user_licenses: colunas novas (todas NULL)
-- =============================================================
ALTER TABLE public.user_licenses
  ADD COLUMN IF NOT EXISTS plan_key text,
  ADD COLUMN IF NOT EXISTS billing_source text,
  ADD COLUMN IF NOT EXISTS access_until timestamptz,
  ADD COLUMN IF NOT EXISTS paymentbeta_subscription_id text;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'user_licenses_billing_source_check'
       AND conrelid = 'public.user_licenses'::regclass
  ) THEN
    ALTER TABLE public.user_licenses
      ADD CONSTRAINT user_licenses_billing_source_check
      CHECK (billing_source IN ('hotmart', 'paymentbeta', 'cortesia'));
  END IF;
END
$constraint$;

COMMENT ON COLUMN public.user_licenses.plan_key IS
  'Chave do catálogo src/billing/plans.ts. Decide limite e pago/free. NULL = free.';
COMMENT ON COLUMN public.user_licenses.billing_source IS
  'Origem do pagamento: hotmart | paymentbeta | cortesia. Hotmart não sobrescreve nem desativa cortesia/paymentbeta.';

-- =============================================================
-- 2) Tabelas novas
-- =============================================================
-- Entregas recebidas do PaymentBeta (idempotência por delivery_id).
-- tenant_id NULL enquanto o tenant não é descoberto; se o tenant for apagado
-- (LGPD), a entrega fica sem tenant (não guarda dado pessoal).
CREATE TABLE IF NOT EXISTS public.paymentbeta_deliveries (
  delivery_id   uuid PRIMARY KEY,
  event         text,
  event_version text,
  tenant_id     uuid NULL REFERENCES public.tenants(id) ON DELETE SET NULL,
  received_at   timestamptz NOT NULL DEFAULT now(),
  result        text
);

CREATE INDEX IF NOT EXISTS idx_paymentbeta_deliveries_tenant
  ON public.paymentbeta_deliveries (tenant_id, received_at DESC);

-- Intenção de compra criada no checkout; consumida quando o pagamento confirma.
CREATE TABLE IF NOT EXISTS public.checkout_intents (
  partner_reference uuid PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  clerk_user_id     text,
  product_type      public.aba_product_type NOT NULL,
  plan_key          text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  consumed_at       timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_checkout_intents_tenant
  ON public.checkout_intents (tenant_id, created_at DESC);

-- =============================================================
-- 3) RLS das tabelas novas (padrão 080/073: ENABLE + FORCE + tenant_isolation)
-- =============================================================
ALTER TABLE public.paymentbeta_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paymentbeta_deliveries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.paymentbeta_deliveries;
CREATE POLICY tenant_isolation ON public.paymentbeta_deliveries
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE public.checkout_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_intents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.checkout_intents;
CREATE POLICY tenant_isolation ON public.checkout_intents
  FOR ALL
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- Permissões explícitas (REVOKE antes: não depender de default privileges).
-- O app só lê as entregas do próprio tenant; quem grava é o receptor (funções abaixo).
REVOKE ALL ON public.paymentbeta_deliveries FROM axis_app;
GRANT SELECT ON public.paymentbeta_deliveries TO axis_app;
-- Checkout (com tenant) cria e consome a intenção; RLS restringe ao tenant.
REVOKE ALL ON public.checkout_intents FROM axis_app;
GRANT SELECT, INSERT, UPDATE ON public.checkout_intents TO axis_app;

-- =============================================================
-- 4) Funções do receptor (sem tenant). SECURITY DEFINER com search_path fixo,
--    EXECUTE só para axis_app (padrão 071/072). Fazem só o mínimo:
--    o resto do processamento roda com app.tenant_id setado.
-- =============================================================

-- Registra a entrega antes de processar. true = nova (processar); false = repetida.
CREATE OR REPLACE FUNCTION public.paymentbeta_delivery_register(
  p_delivery_id uuid,
  p_event text,
  p_event_version text
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO paymentbeta_deliveries (delivery_id, event, event_version)
  VALUES (p_delivery_id, p_event, p_event_version)
  ON CONFLICT (delivery_id) DO NOTHING;
  RETURN FOUND;
END;
$$;

-- Grava o resultado do processamento (e o tenant, quando descoberto).
CREATE OR REPLACE FUNCTION public.paymentbeta_delivery_result(
  p_delivery_id uuid,
  p_result text,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE paymentbeta_deliveries
     SET result = p_result,
         tenant_id = COALESCE(p_tenant_id, tenant_id)
   WHERE delivery_id = p_delivery_id;
  RETURN FOUND;
END;
$$;

-- Acha a intenção pelo partner_reference (o receptor ainda não sabe o tenant).
-- Só leitura; consumir (consumed_at) é feito depois, já com app.tenant_id.
CREATE OR REPLACE FUNCTION public.checkout_intent_lookup(p_partner_reference uuid)
RETURNS TABLE (
  tenant_id uuid,
  clerk_user_id text,
  product_type public.aba_product_type,
  plan_key text,
  consumed_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT ci.tenant_id, ci.clerk_user_id, ci.product_type, ci.plan_key, ci.consumed_at
    FROM checkout_intents ci
   WHERE ci.partner_reference = p_partner_reference;
$$;

REVOKE ALL ON FUNCTION public.paymentbeta_delivery_register(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.paymentbeta_delivery_register(uuid, text, text) TO axis_app;

REVOKE ALL ON FUNCTION public.paymentbeta_delivery_result(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.paymentbeta_delivery_result(uuid, text, uuid) TO axis_app;

REVOKE ALL ON FUNCTION public.checkout_intent_lookup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_intent_lookup(uuid) TO axis_app;

-- =============================================================
-- 5) BACKFILL (só licenças com hotmart_plan não vazio e ainda sem chave)
-- =============================================================
CREATE TEMP TABLE _axis081_backfill ON COMMIT DROP AS
SELECT ul.id,
       ul.hotmart_event,
       ul.hotmart_plan,
       CASE ul.product_type::text
         WHEN 'tcc' THEN 'tcc_100'
         WHEN 'aba' THEN
           CASE WHEN ul.hotmart_offer = 'gona25or' OR ul.hotmart_plan = 'clinica_250'
                THEN 'aba_250' ELSE 'aba_100' END
         WHEN 'tdah' THEN
           CASE WHEN ul.hotmart_offer = 'hxzwuwfh' OR ul.hotmart_plan = 'clinica_250'
                THEN 'tdah_250' ELSE 'tdah_100' END
       END AS plan_key,
       CASE
         WHEN r.e_hotmart AND NOT r.e_cortesia THEN 'hotmart'
         WHEN r.e_cortesia AND NOT r.e_hotmart THEN 'cortesia'
       END AS billing_source
  FROM public.user_licenses ul
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(starts_with(ul.hotmart_event, 'PURCHASE_')
               OR ul.hotmart_event = 'SUBSCRIPTION_CANCELLATION', false) AS e_hotmart,
      COALESCE(starts_with(ul.hotmart_event, 'ADMIN_'), false)
        OR ul.hotmart_plan = 'admin_grant' AS e_cortesia
  ) r
 WHERE ul.hotmart_plan IS NOT NULL
   AND ul.hotmart_plan <> ''
   AND ul.plan_key IS NULL
   AND ul.billing_source IS NULL;

-- Linha que não se encaixa em nenhuma regra (ou em duas): ABORTA. Nunca chutar.
DO $abort$
DECLARE
  v_count integer;
  v_list  text;
BEGIN
  SELECT count(*),
         string_agg(id::text || ' [evento=' || COALESCE(hotmart_event, 'NULL')
                    || ' plano=' || hotmart_plan || ']', ', ' ORDER BY id)
    INTO v_count, v_list
    FROM _axis081_backfill
   WHERE plan_key IS NULL OR billing_source IS NULL;

  IF v_count > 0 THEN
    RAISE EXCEPTION '[AXIS-081] % licença(s) com hotmart_plan sem regra de backfill; nada foi aplicado: %',
      v_count, v_list;
  END IF;
END
$abort$;

WITH upd AS (
  UPDATE public.user_licenses ul
     SET plan_key = b.plan_key,
         billing_source = b.billing_source
    FROM _axis081_backfill b
   WHERE ul.id = b.id
  RETURNING ul.id, ul.tenant_id, ul.product_type, ul.plan_key, ul.billing_source,
            ul.is_active, ul.hotmart_plan, ul.hotmart_offer, ul.hotmart_event
)
INSERT INTO public.axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
SELECT tenant_id, NULL, 'system', 'LICENSE_PLAN_KEY_BACKFILL', 'user_licenses', id,
       jsonb_build_object(
         'source', 'migration_081',
         'product_type', product_type::text,
         'plan_key', plan_key,
         'billing_source', billing_source,
         'is_active', is_active,
         'hotmart_plan', hotmart_plan,
         'hotmart_offer', hotmart_offer,
         'hotmart_event', hotmart_event
       )
  FROM upd;

-- Conferência: nenhuma licença com hotmart_plan pode ficar sem plan_key.
DO $verify$
DECLARE
  v_left    integer;
  v_resumo  text;
BEGIN
  SELECT count(*) INTO v_left
    FROM public.user_licenses
   WHERE hotmart_plan IS NOT NULL AND hotmart_plan <> '' AND plan_key IS NULL;

  IF v_left > 0 THEN
    RAISE EXCEPTION '[AXIS-081] % licença(s) com hotmart_plan continuam sem plan_key', v_left;
  END IF;

  SELECT string_agg(plan_key || '/' || billing_source || '=' || n, ', ' ORDER BY plan_key, billing_source)
    INTO v_resumo
    FROM (SELECT plan_key, billing_source, count(*) AS n
            FROM _axis081_backfill
           GROUP BY plan_key, billing_source) s;

  RAISE NOTICE '[AXIS-081] backfill: %', COALESCE(v_resumo, 'nenhuma linha (já aplicado ou sem licença paga)');
END
$verify$;

COMMIT;
