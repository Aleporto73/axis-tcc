-- Pagamento P1 — conferência DEPOIS da 081. SÓ LEITURA (só SELECT).
-- Mesmas colunas do "antes", com plan_key e billing_source LIDOS do banco.
--   limite_novo      = regra de src/billing/license.ts sobre a plan_key gravada
--   perdeu_limite    = limite_novo < limite_antigo (esperado: só TCC, 999999 → 100)
--   aborta           = licença paga que ficou sem plan_key/billing_source (esperado: nenhuma)
--   difere_da_previa = chave gravada ≠ regra do backfill (esperado: nenhuma)
--
-- docker exec -i axis-postgres psql -U axis -d axis_tcc < scripts/checks/pagamento_p1_depois.sql

WITH ranked AS (
  SELECT ul.*,
         ul.is_active
           AND row_number() OVER (PARTITION BY ul.tenant_id, ul.product_type, ul.is_active
                                  ORDER BY ul.created_at DESC) = 1 AS usada_pelo_leitor,
         count(*) FILTER (WHERE ul.is_active) OVER (PARTITION BY ul.tenant_id, ul.product_type) AS ativas_mesmo_produto
    FROM user_licenses ul
),
lic AS (
  SELECT r.id, r.tenant_id, r.product_type::text AS produto, r.hotmart_plan,
         r.hotmart_offer AS oferta, r.hotmart_event, r.is_active, r.usada_pelo_leitor,
         r.ativas_mesmo_produto, r.plan_key, r.billing_source,
         COALESCE(starts_with(r.hotmart_event, 'PURCHASE_')
                  OR r.hotmart_event = 'SUBSCRIPTION_CANCELLATION', false) AS e_hotmart,
         COALESCE(starts_with(r.hotmart_event, 'ADMIN_'), false)
           OR r.hotmart_plan = 'admin_grant' AS e_cortesia
    FROM ranked r
   WHERE (r.hotmart_plan IS NOT NULL AND r.hotmart_plan <> '')
      OR r.plan_key IS NOT NULL
),
regra AS (
  SELECT lic.*,
         CASE produto
           WHEN 'tcc' THEN 'tcc_100'
           WHEN 'aba' THEN CASE WHEN oferta = 'gona25or' OR hotmart_plan = 'clinica_250'
                                THEN 'aba_250' ELSE 'aba_100' END
           WHEN 'tdah' THEN CASE WHEN oferta = 'hxzwuwfh' OR hotmart_plan = 'clinica_250'
                                 THEN 'tdah_250' ELSE 'tdah_100' END
         END AS regra_plan_key,
         CASE
           WHEN e_hotmart AND NOT e_cortesia THEN 'hotmart'
           WHEN e_cortesia AND NOT e_hotmart THEN 'cortesia'
         END AS regra_billing_source,
         -- plan_key que o leitor usa: a gravada; sem ela e com hotmart_plan, a da regra (fallback + alerta)
         CASE
           WHEN plan_key IS NOT NULL AND plan_key <> '' THEN plan_key
           WHEN hotmart_plan IS NOT NULL AND hotmart_plan <> '' THEN
             CASE produto
               WHEN 'tcc' THEN 'tcc_100'
               WHEN 'aba' THEN CASE WHEN oferta = 'gona25or' OR hotmart_plan = 'clinica_250'
                                    THEN 'aba_250' ELSE 'aba_100' END
               WHEN 'tdah' THEN CASE WHEN oferta = 'hxzwuwfh' OR hotmart_plan = 'clinica_250'
                                     THEN 'tdah_250' ELSE 'tdah_100' END
             END
         END AS chave_efetiva
    FROM lic
),
calc AS (
  SELECT regra.*,
         CASE
           WHEN hotmart_plan IS NULL OR hotmart_plan = '' THEN 1
           WHEN produto = 'tcc' THEN 999999
           ELSE CASE hotmart_plan
                  WHEN 'founders_50' THEN 50
                  WHEN 'founders'    THEN 100
                  WHEN 'clinica_100' THEN 100
                  WHEN 'clinica_250' THEN 250
                  ELSE 100
                END
         END AS limite_antigo,
         CASE
           WHEN chave_efetiva IS NULL THEN 1
           WHEN split_part(chave_efetiva, '_', 1) <> produto THEN 100   -- chave de outro produto: 100 + alerta
           WHEN chave_efetiva IN ('aba_50', 'tdah_50', 'tcc_50') THEN 50
           WHEN chave_efetiva IN ('aba_100', 'tdah_100', 'tcc_100') THEN 100
           WHEN chave_efetiva IN ('aba_250', 'tdah_250') THEN 250
           ELSE 100                                                     -- desconhecida: 100 + alerta
         END AS limite_novo
    FROM regra
)
SELECT tenant_id,
       produto,
       hotmart_plan,
       oferta,
       hotmart_event,
       is_active,
       usada_pelo_leitor,
       ativas_mesmo_produto,
       limite_antigo,
       plan_key,
       billing_source,
       limite_novo,
       limite_novo < limite_antigo AS perdeu_limite,
       (hotmart_plan IS NOT NULL AND hotmart_plan <> ''
        AND (plan_key IS NULL OR billing_source IS NULL)) AS aborta,
       (plan_key IS DISTINCT FROM regra_plan_key
        OR billing_source IS DISTINCT FROM regra_billing_source) AS difere_da_previa,
       id AS license_id
  FROM calc
 ORDER BY aborta DESC, difere_da_previa DESC, perdeu_limite DESC, produto, tenant_id;
