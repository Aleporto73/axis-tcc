import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET() {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      const res = await client.query(`
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
        ORDER BY lp.regression_count DESC
      `, [tenantId])
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
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json({ alerts: [] })
  }
}
