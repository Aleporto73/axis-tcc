import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { learnerFilter, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Alertas (Multi-Terapeuta)
// admin/supervisor: todos alertas. terapeuta: só seus aprendizes.
// =====================================================

export async function GET() {
  try {
    const result = await withTenant(async (ctx) => {
      const filter = learnerFilter(ctx, 2)

      // Alertas de regressão
      const regressions = await ctx.client.query(`
        SELECT
          lp.learner_id,
          l.name as learner_name,
          lp.title as protocol_title,
          lp.regression_count,
          lp.status
        FROM learner_protocols lp
        JOIN learners l ON l.id = lp.learner_id
        WHERE lp.tenant_id = $1
        AND lp.regression_count > 0
        ${filter.clause ? filter.clause.replace('AND id IN', 'AND lp.learner_id IN') : ''}
        ORDER BY lp.regression_count DESC
      `, [ctx.tenantId, ...filter.params])

      // Alertas de sondas de manutenção pendentes (agendadas para hoje ou antes)
      const probes = await ctx.client.query(`
        SELECT
          mp.id as probe_id,
          mp.label,
          mp.scheduled_at,
          mp.protocol_id,
          lp.learner_id,
          l.name as learner_name,
          lp.title as protocol_title
        FROM maintenance_probes mp
        JOIN learner_protocols lp ON lp.id = mp.protocol_id
        JOIN learners l ON l.id = lp.learner_id
        WHERE mp.tenant_id = $1
        AND mp.status = 'pending'
        AND mp.scheduled_at::date <= CURRENT_DATE
        ${filter.clause ? filter.clause.replace('AND id IN', 'AND lp.learner_id IN') : ''}
        ORDER BY mp.scheduled_at ASC
      `, [ctx.tenantId, ...filter.params])

      return { regressions: regressions.rows, probes: probes.rows }
    })

    const alerts = [
      ...result.regressions.map((r: any) => ({
        learner_id: r.learner_id,
        learner_name: r.learner_name,
        type: 'regression',
        message: 'Regressão detectada (' + r.regression_count + 'x) — protocolo retomado',
        protocol_title: r.protocol_title
      })),
      ...result.probes.map((p: any) => ({
        learner_id: p.learner_id,
        learner_name: p.learner_name,
        type: 'maintenance_probe',
        message: p.label + ' — verificação pronta para registrar resultado',
        protocol_title: p.protocol_title,
        link: '/aba/aprendizes/' + p.learner_id + '/manutencao?protocol_id=' + p.protocol_id
      }))
    ]

    return NextResponse.json({ alerts })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    if (status === 401) return NextResponse.json({ error: message }, { status })
    return NextResponse.json({ alerts: [] })
  }
}
