import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET() {
  return withTenant(async ({ client, tenantId }) => {
    const engineResult = await client.query(
      'SELECT version FROM engine_versions WHERE is_current = true LIMIT 1'
    )

    if (!engineResult.rows[0]?.version) {
      console.error('[AXIS ABA] CRITICAL: Nenhuma engine_version ativa encontrada.')
      return NextResponse.json(
        { error: 'ENGINE_VERSION_MISSING', message: 'Versão do motor clínico não encontrada. Contacte o suporte.' },
        { status: 503 }
      )
    }

    const engineVersion = engineResult.rows[0].version

    // KPIs básicos (existentes)
    const metricsResult = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM learners WHERE tenant_id = $1)::int
          AS total_learners,
        (SELECT COUNT(*) FROM sessions_aba WHERE tenant_id = $1 AND DATE(scheduled_at) = CURRENT_DATE)::int
          AS sessions_today,
        (SELECT COUNT(*) FROM sessions_aba WHERE tenant_id = $1 AND scheduled_at >= CURRENT_DATE - INTERVAL '7 days')::int
          AS sessions_week,
        (SELECT COUNT(*) FROM learner_protocols WHERE tenant_id = $1 AND status = 'active')::int
          AS active_protocols,
        (SELECT COUNT(*) FROM learner_protocols WHERE tenant_id = $1 AND status = 'mastered')::int
          AS mastered_protocols,
        (SELECT ROUND(AVG(cs.cso_aba)) FROM clinical_states_aba cs
          INNER JOIN (SELECT learner_id, MAX(created_at) AS last FROM clinical_states_aba WHERE tenant_id = $1 GROUP BY learner_id) latest
          ON cs.learner_id = latest.learner_id AND cs.created_at = latest.last WHERE cs.tenant_id = $1)::int
          AS avg_cso,
        (SELECT COUNT(DISTINCT cs.learner_id) FROM clinical_states_aba cs
          INNER JOIN (SELECT learner_id, MAX(created_at) AS last FROM clinical_states_aba WHERE tenant_id = $1 GROUP BY learner_id) latest
          ON cs.learner_id = latest.learner_id AND cs.created_at = latest.last WHERE cs.tenant_id = $1 AND cs.cso_band = 'critico')::int
          AS learners_critical
    `, [tenantId])

    // KPIs avançados
    const advancedResult = await client.query(`
      SELECT
        -- Taxa de mastery: protocolos dominados / total protocolos (%)
        (SELECT CASE WHEN COUNT(*) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE status IN ('mastered','maintained','generalization','maintenance'))::numeric / COUNT(*)::numeric * 100)
          ELSE 0 END
         FROM learner_protocols WHERE tenant_id = $1)::int
          AS mastery_rate,

        -- Total de protocolos (todos os status)
        (SELECT COUNT(*) FROM learner_protocols WHERE tenant_id = $1)::int
          AS total_protocols,

        -- Tempo médio até mastery (dias entre activated_at e mastered_at)
        (SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (mastered_at - activated_at)) / 86400)), 0)
         FROM learner_protocols WHERE tenant_id = $1 AND mastered_at IS NOT NULL AND activated_at IS NOT NULL)::int
          AS avg_days_to_mastery,

        -- Sessões completas no total
        (SELECT COUNT(*) FROM sessions_aba WHERE tenant_id = $1 AND status = 'completed')::int
          AS total_sessions_completed,

        -- Duração média das sessões (minutos)
        (SELECT COALESCE(ROUND(AVG(duration_minutes)), 0)
         FROM sessions_aba WHERE tenant_id = $1 AND status = 'completed' AND duration_minutes IS NOT NULL)::int
          AS avg_session_duration,

        -- Protocolos em regressão
        (SELECT COUNT(*) FROM learner_protocols WHERE tenant_id = $1 AND status = 'regression')::int
          AS protocols_regression,

        -- Taxa de cancelamento de sessões nos últimos 30 dias
        (SELECT CASE WHEN COUNT(*) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE status = 'cancelled')::numeric / COUNT(*)::numeric * 100)
          ELSE 0 END
         FROM sessions_aba WHERE tenant_id = $1 AND scheduled_at >= CURRENT_DATE - INTERVAL '30 days')::int
          AS cancel_rate_30d,

        -- Protocolos em generalização + manutenção
        (SELECT COUNT(*) FROM learner_protocols WHERE tenant_id = $1 AND status IN ('generalization','maintenance'))::int
          AS protocols_gen_maint,

        -- Total de regressões registradas (soma regression_count)
        (SELECT COALESCE(SUM(regression_count), 0)
         FROM learner_protocols WHERE tenant_id = $1)::int
          AS total_regressions,

        -- Aprendizes ativos (com pelo menos 1 protocolo ativo)
        (SELECT COUNT(DISTINCT learner_id) FROM learner_protocols WHERE tenant_id = $1 AND status = 'active')::int
          AS active_learners
    `, [tenantId])

    const row = metricsResult.rows[0]
    const adv = advancedResult.rows[0]

    return NextResponse.json(
      {
        total_learners: row.total_learners,
        sessions_today: row.sessions_today,
        sessions_week: row.sessions_week,
        active_protocols: row.active_protocols,
        mastered_protocols: row.mastered_protocols || 0,
        avg_cso: row.avg_cso || null,
        learners_critical: row.learners_critical || 0,
        engine_version: engineVersion,
        // KPIs avançados
        mastery_rate: adv.mastery_rate || 0,
        total_protocols: adv.total_protocols || 0,
        avg_days_to_mastery: adv.avg_days_to_mastery || 0,
        total_sessions_completed: adv.total_sessions_completed || 0,
        avg_session_duration: adv.avg_session_duration || 0,
        protocols_regression: adv.protocols_regression || 0,
        cancel_rate_30d: adv.cancel_rate_30d || 0,
        protocols_gen_maint: adv.protocols_gen_maint || 0,
        total_regressions: adv.total_regressions || 0,
        active_learners: adv.active_learners || 0,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
        },
      }
    )
  })
}
