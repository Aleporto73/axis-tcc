-- Pagamento P1 — conferência ANTES da 081. SÓ LEITURA (só SELECT).
-- Uma linha por licença com hotmart_plan não vazio.
--   limite_antigo     = o que a licença dá hoje (product-limits.ts antes do P1)
--   previa_*          = plan_key e billing_source que a 081 vai gravar
--   limite_novo       = o que a licença vai dar com a plan_key da prévia
--   perdeu_limite     = limite_novo < limite_antigo (esperado: só TCC, 999999 → 100)
--   aborta            = linha que faria a 081 parar (motivo ao lado)
--   usada_pelo_leitor = é a licença ativa mais recente do produto (a que o leitor usa)
--
-- docker exec -i axis-postgres psql -U axis -d axis_tcc < scripts/checks/pagamento_p1_antes.sql

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
         r.ativas_mesmo_produto,
         COALESCE(starts_with(r.hotmart_event, 'PURCHASE_')
                  OR r.hotmart_event = 'SUBSCRIPTION_CANCELLATION', false) AS e_hotmart,
         COALESCE(starts_with(r.hotmart_event, 'ADMIN_'), false)
           OR r.hotmart_plan = 'admin_grant' AS e_cortesia
    FROM ranked r
   WHERE r.hotmart_plan IS NOT NULL AND r.hotmart_plan <> ''
),
previa AS (
  SELECT lic.*,
         CASE produto
           WHEN 'tcc' THEN 'tcc_100'
           WHEN 'aba' THEN CASE WHEN oferta = 'gona25or' OR hotmart_plan = 'clinica_250'
                                THEN 'aba_250' ELSE 'aba_100' END
           WHEN 'tdah' THEN CASE WHEN oferta = 'hxzwuwfh' OR hotmart_plan = 'clinica_250'
                                 THEN 'tdah_250' ELSE 'tdah_100' END
         END AS previa_plan_key,
         CASE
           WHEN e_hotmart AND NOT e_cortesia THEN 'hotmart'
           WHEN e_cortesia AND NOT e_hotmart THEN 'cortesia'
         END AS previa_billing_source,
         CASE
           WHEN produto = 'tcc' THEN 999999
           ELSE CASE hotmart_plan
                  WHEN 'founders_50' THEN 50
                  WHEN 'founders'    THEN 100
                  WHEN 'clinica_100' THEN 100
                  WHEN 'clinica_250' THEN 250
                  ELSE 100
                END
         END AS limite_antigo
    FROM lic
),
calc AS (
  SELECT previa.*,
         CASE previa_plan_key
           WHEN 'tcc_100'  THEN 100
           WHEN 'aba_100'  THEN 100
           WHEN 'aba_250'  THEN 250
           WHEN 'tdah_100' THEN 100
           WHEN 'tdah_250' THEN 250
         END AS limite_novo
    FROM previa
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
       previa_plan_key,
       previa_billing_source,
       limite_novo,
       limite_novo < limite_antigo AS perdeu_limite,
       (previa_plan_key IS NULL OR previa_billing_source IS NULL) AS aborta,
       CASE
         WHEN previa_plan_key IS NULL THEN 'produto sem regra'
         WHEN e_hotmart AND e_cortesia THEN 'evento Hotmart + admin_grant (duas regras)'
         WHEN previa_billing_source IS NULL THEN 'evento sem regra: ' || COALESCE(hotmart_event, 'NULL')
       END AS motivo_aborta,
       id AS license_id
  FROM calc
 ORDER BY aborta DESC, perdeu_limite DESC, produto, tenant_id;
