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

      const res = await ctx.client.query(`
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
      return res.rows
    })

    const alerts = result.map((r: any) => ({
      learner_id: r.learner_id,
      learner_name: r.learner_name,
      type: 'regression',
      message: 'Regressão detectada (' + r.regression_count + 'x) — protocolo retomado',
      protocol_title: r.protocol_title
    }))

    return NextResponse.json({ alerts })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    if (status === 401) return NextResponse.json({ error: message }, { status })
    return NextResponse.json({ alerts: [] })
  }
}
