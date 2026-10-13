-- Pagamento P2 — Recursos "Operadora" do ABA: quem PERDE na opção B. SÓ LEITURA (só SELECT).
--
-- Hoje:    o recurso é liberado por tenants.plan_tier (src/lib/operadora-gate.ts).
-- Opção B: o recurso passa a ser liberado pela licença ABA ativa:
--            aba_50 → recursos do founders, aba_100 → clinica_100, aba_250 → clinica_250;
--            ABA grátis / sem licença ABA ativa → nenhum; cortesia segue a chave.
-- Mostra só os tenants em que PERDE não está vazio.
--   chave_aba = plan_key; se a 081 ainda não rodou (ou a linha não tem plan_key), a
--               mesma regra do backfill da 081 sobre hotmart_plan/hotmart_offer
--               (por isso lê as colunas novas via to_jsonb: funciona antes e depois da 081)
--   USA       = registros criados nos últimos 90 dias, por recurso perdido
--               (flags/painel de integridade: revisões e varreduras manuais no axis_audit_logs)
--
-- RODAR COMO "axis": várias tabelas contadas (service_sites, session_*, claim_packets...)
-- têm RLS forçada; como axis_app, sem app.tenant_id, dá erro [AXIS RLS].
--
-- docker exec -i axis-postgres psql -U axis -d axis_tcc < pagamento_p2_operadora.sql

WITH recurso(recurso, ordem, founders, clinica_100, clinica_250) AS (
  VALUES
    ('locais_atendimento',        1, true,  true,  true),
    ('presenca_gps',              2, true,  true,  true),
    ('atestacao_terapeuta',       3, true,  true,  true),
    ('pacotes_evidencia',         4, true,  true,  true),
    ('anexos',                    5, true,  true,  true),
    ('credenciais_profissionais', 6, true,  true,  true),
    ('atestacao_responsavel',     7, false, true,  true),
    ('perfis_cobertura',          8, false, true,  true),
    ('pacotes_faturamento',       9, false, true,  true),
    ('perfis_pagador',           10, false, true,  true),
    ('flags_integridade',        11, false, false, true),
    ('painel_compliance',        12, false, false, true)
),
lic AS (
  SELECT ul.tenant_id,
         ul.is_active,
         ul.created_at,
         ul.product_type::text AS produto,
         NULLIF(to_jsonb(ul) ->> 'plan_key', '') AS plan_key,
         to_jsonb(ul) ->> 'billing_source' AS billing_source,
         NULLIF(ul.hotmart_plan, '') AS hotmart_plan,
         ul.hotmart_offer,
         ul.hotmart_event
    FROM user_licenses ul
),
chave AS (
  SELECT lic.*,
         COALESCE(
           plan_key,
           CASE WHEN hotmart_plan IS NOT NULL THEN
             CASE produto
               WHEN 'tcc'  THEN 'tcc_100'
               WHEN 'aba'  THEN CASE WHEN hotmart_offer = 'gona25or' OR hotmart_plan = 'clinica_250' THEN 'aba_250' ELSE 'aba_100' END
               WHEN 'tdah' THEN CASE WHEN hotmart_offer = 'hxzwuwfh' OR hotmart_plan = 'clinica_250' THEN 'tdah_250' ELSE 'tdah_100' END
             END
           END
         ) AS chave,
         COALESCE(
           billing_source,
           CASE
             WHEN (COALESCE(starts_with(hotmart_event, 'PURCHASE_') OR hotmart_event = 'SUBSCRIPTION_CANCELLATION', false))
                  AND NOT (COALESCE(starts_with(hotmart_event, 'ADMIN_'), false) OR hotmart_plan = 'admin_grant') THEN 'hotmart'
             WHEN (COALESCE(starts_with(hotmart_event, 'ADMIN_'), false) OR hotmart_plan = 'admin_grant') THEN 'cortesia'
           END
         ) AS origem
    FROM lic
),
-- licença ABA que o leitor usa: a ativa mais recente; sem ativa, a mais recente (só para mostrar)
aba AS (
  SELECT DISTINCT ON (tenant_id) tenant_id, chave, origem, is_active
    FROM chave
   WHERE produto = 'aba'
   ORDER BY tenant_id, is_active DESC, created_at DESC
),
outros AS (
  SELECT tenant_id, string_agg(produto || ':' || COALESCE(chave, 'gratis') || ':' || COALESCE(origem, '-'), ', ' ORDER BY produto) AS outras_licencas_ativas
    FROM chave
   WHERE is_active AND produto <> 'aba'
   GROUP BY tenant_id
),
nivel AS (
  SELECT t.id AS tenant_id,
         t.name AS tenant,
         COALESCE(t.plan_tier, 'free') AS plan_tier,
         aba.chave AS aba_plan_key,
         aba.origem AS aba_billing_source,
         aba.is_active AS aba_is_active,
         CASE WHEN aba.is_active THEN
           CASE aba.chave
             WHEN 'aba_50'  THEN 'founders'
             WHEN 'aba_100' THEN 'clinica_100'
             WHEN 'aba_250' THEN 'clinica_250'
           END
         END AS nivel_opcao_b,
         outros.outras_licencas_ativas
    FROM tenants t
    LEFT JOIN aba ON aba.tenant_id = t.id
    LEFT JOIN outros ON outros.tenant_id = t.id
),
acesso AS (
  SELECT n.tenant_id, r.recurso, r.ordem,
         CASE n.plan_tier WHEN 'founders' THEN r.founders WHEN 'clinica_100' THEN r.clinica_100 WHEN 'clinica_250' THEN r.clinica_250 ELSE false END AS hoje,
         CASE n.nivel_opcao_b WHEN 'founders' THEN r.founders WHEN 'clinica_100' THEN r.clinica_100 WHEN 'clinica_250' THEN r.clinica_250 ELSE false END AS opcao_b
    FROM nivel n
   CROSS JOIN recurso r
),
uso AS (
  SELECT tenant_id, 'locais_atendimento' AS recurso, count(*) AS n FROM service_sites WHERE created_at >= now() - interval '90 days' GROUP BY 1
  UNION ALL SELECT tenant_id, 'presenca_gps', count(*) FROM session_presence_proofs WHERE created_at >= now() - interval '90 days' GROUP BY 1
  UNION ALL SELECT tenant_id, 'atestacao_terapeuta', count(*) FROM session_attestations WHERE attestor_type IN ('therapist', 'supervisor') AND created_at >= now() - interval '90 days' GROUP BY 1
  UNION ALL SELECT tenant_id, 'atestacao_responsavel', count(*) FROM session_attestations WHERE attestor_type = 'guardian' AND created_at >= now() - interval '90 days' GROUP BY 1
  UNION ALL SELECT tenant_id, 'pacotes_evidencia', count(*) FROM session_evidence_bundles WHERE created_at >= now() - interval '90 days' GROUP BY 1
  UNION ALL SELECT tenant_id, 'anexos', count(*) FROM session_attachments WHERE created_at >= now() - interval '90 days' GROUP BY 1
  UNION ALL SELECT tenant_id, 'credenciais_profissionais', count(*) FROM provider_credentials WHERE created_at >= now() - interval '90 days' GROUP BY 1
  UNION ALL SELECT tenant_id, 'perfis_cobertura', count(*) FROM learner_coverage_profiles WHERE created_at >= now() - interval '90 days' GROUP BY 1
  UNION ALL SELECT tenant_id, 'pacotes_faturamento', count(*) FROM claim_packets WHERE created_at >= now() - interval '90 days' GROUP BY 1
  UNION ALL SELECT tenant_id, 'perfis_pagador', count(*) FROM payer_requirement_profiles WHERE created_at >= now() - interval '90 days' GROUP BY 1
  UNION ALL SELECT tenant_id, 'flags_integridade', count(*) FROM axis_audit_logs WHERE action IN ('INTEGRITY_FLAG_REVIEWED', 'INTEGRITY_SCAN_TRIGGERED') AND created_at >= now() - interval '90 days' GROUP BY 1
  UNION ALL SELECT tenant_id, 'painel_compliance', count(*) FROM axis_audit_logs WHERE action IN ('INTEGRITY_FLAG_REVIEWED', 'INTEGRITY_SCAN_TRIGGERED') AND created_at >= now() - interval '90 days' GROUP BY 1
),
por_tenant AS (
  SELECT a.tenant_id,
         string_agg(a.recurso, ', ' ORDER BY a.ordem) FILTER (WHERE a.hoje) AS tem_hoje,
         string_agg(a.recurso, ', ' ORDER BY a.ordem) FILTER (WHERE a.opcao_b) AS teria_opcao_b,
         string_agg(a.recurso, ', ' ORDER BY a.ordem) FILTER (WHERE a.hoje AND NOT a.opcao_b) AS perde,
         string_agg(a.recurso || '=' || COALESCE(u.n, 0), ', ' ORDER BY a.ordem) FILTER (WHERE a.hoje AND NOT a.opcao_b) AS usa,
         COALESCE(sum(u.n) FILTER (WHERE a.hoje AND NOT a.opcao_b), 0) AS usa_total_90d
    FROM acesso a
    LEFT JOIN uso u ON u.tenant_id = a.tenant_id AND u.recurso = a.recurso
   GROUP BY a.tenant_id
)
SELECT n.tenant_id,
       n.tenant,
       n.plan_tier,
       n.aba_plan_key,
       n.aba_billing_source,
       n.aba_is_active,
       COALESCE(n.nivel_opcao_b, 'nenhum') AS nivel_opcao_b,
       n.outras_licencas_ativas,
       p.tem_hoje,
       p.teria_opcao_b,
       p.perde,
       p.usa,
       p.usa_total_90d
  FROM por_tenant p
  JOIN nivel n ON n.tenant_id = p.tenant_id
 WHERE p.perde IS NOT NULL
 ORDER BY p.usa_total_90d DESC, n.plan_tier, n.tenant;
