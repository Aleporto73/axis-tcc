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

    const row = metricsResult.rows[0]

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
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
        },
      }
    )
  })
}
