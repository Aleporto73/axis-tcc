import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learner_id')
    const result = await withTenant(async ({ client, tenantId }) => {
      let q = 'SELECT p.*, l.name as learner_name FROM pei_plans p JOIN learners l ON l.id = p.learner_id WHERE p.tenant_id = $1'
      const params: any[] = [tenantId]
      if (learnerId) { params.push(learnerId); q += ' AND p.learner_id = $' + params.length }
      q += ' ORDER BY p.start_date DESC'
      const plans = await client.query(q, params)
      const result = []
      for (const plan of plans.rows) {
        const goals = await client.query('SELECT * FROM pei_goals WHERE pei_plan_id = $1 ORDER BY domain, title', [plan.id])
        const linked = await client.query('SELECT lp.id, lp.title, lp.status, lp.pei_goal_id FROM learner_protocols lp WHERE lp.pei_goal_id IN (SELECT id FROM pei_goals WHERE pei_plan_id = $1)', [plan.id])
        result.push({ ...plan, goals: goals.rows, linked_protocols: linked.rows })
      }
      return result
    })
    return NextResponse.json({ plans: result })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    console.error('PEI GET error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { learner_id, title, start_date, goals } = body
    if (!learner_id || !title || !start_date) {
      return NextResponse.json({ error: 'learner_id, title e start_date são obrigatórios' }, { status: 400 })
    }
    const result = await withTenant(async ({ client, tenantId, userId }) => {
      const plan = await client.query(
        'INSERT INTO pei_plans (tenant_id, learner_id, title, start_date, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [tenantId, learner_id, title, start_date, userId]
      )
      const planId = plan.rows[0].id
      if (goals && goals.length > 0) {
        for (const g of goals) {
          await client.query(
            'INSERT INTO pei_goals (pei_plan_id, title, domain, target_pct, notes) VALUES ($1, $2, $3, $4, $5)',
            [planId, g.title, g.domain, g.target_pct || 80, g.notes || null]
          )
        }
      }
      return plan.rows[0]
    })
    return NextResponse.json({ plan: result }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    console.error('PEI POST error:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
