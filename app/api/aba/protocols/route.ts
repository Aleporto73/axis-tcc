import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, learnerFilter, canAccessLearner, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Protocolos (Multi-Terapeuta)
// GET: filtrado por role. POST: admin/supervisor apenas.
// Conforme Bible v2.6.1 — Ciclo de Vida do Protocolo (8 status)
// =====================================================

// GET — Listar protocolos (filtrado por role)
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async (ctx) => {
      const { searchParams } = new URL(request.url)
      const learnerId = searchParams.get('learner_id')
      const status = searchParams.get('status')

      // Filtro por role: terapeuta só vê protocolos de seus aprendizes
      const filter = learnerFilter(ctx, 2)

      let query = `
        SELECT lp.*, l.name as learner_name, ep.name as ebp_name,
               pg.title as pei_goal_title, pg.domain as pei_goal_domain
        FROM learner_protocols lp
        JOIN learners l ON l.id = lp.learner_id
        JOIN ebp_practices ep ON ep.id = lp.ebp_practice_id
        LEFT JOIN pei_goals pg ON pg.id = lp.pei_goal_id
        WHERE lp.tenant_id = $1
        ${filter.clause ? filter.clause.replace('AND id IN', 'AND lp.learner_id IN') : ''}
      `
      const params: any[] = [ctx.tenantId, ...filter.params]

      if (learnerId) {
        params.push(learnerId)
        query += ` AND lp.learner_id = $${params.length}`
      }

      if (status) {
        params.push(status)
        query += ` AND lp.status = $${params.length}`
      }

      query += ` ORDER BY lp.created_at DESC`

      return await ctx.client.query(query, params)
    })

    return NextResponse.json({ protocols: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// POST — Criar protocolo para um aprendiz (admin/supervisor)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      learner_id, title, ebp_practice_id, domain, objective,
      mastery_criteria_pct, mastery_criteria_sessions, mastery_criteria_trials,
      measurement_type, protocol_library_id, pei_goal_id
    } = body

    if (!learner_id || !title || !ebp_practice_id || !domain || !objective) {
      return NextResponse.json(
        { error: 'learner_id, title, ebp_practice_id, domain e objective são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      // Apenas admin/supervisor podem criar protocolos
      requireAdminOrSupervisor(ctx)

      // Validar learner pertence ao tenant
      const learnerCheck = await ctx.client.query(
        'SELECT id FROM learners WHERE id = $1 AND tenant_id = $2 AND is_active = true',
        [learner_id, ctx.tenantId]
      )

      if (learnerCheck.rows.length === 0) {
        throw new Error('Aprendiz não encontrado')
      }

      // Validar EBP existe
      const ebpCheck = await ctx.client.query(
        'SELECT id FROM ebp_practices WHERE id = $1',
        [ebp_practice_id]
      )

      if (ebpCheck.rows.length === 0) {
        throw new Error('Prática EBP não encontrada')
      }

      // Buscar engine version atual
      const engineResult = await ctx.client.query(
        "SELECT version FROM engine_versions WHERE is_current = true"
      )

      const engineVersion = engineResult.rows[0]?.version || '2.6.1'

      return await ctx.client.query(
        `INSERT INTO learner_protocols (
          tenant_id, learner_id, title, ebp_practice_id, domain, objective,
          mastery_criteria_pct, mastery_criteria_sessions, mastery_criteria_trials,
          measurement_type, protocol_library_id, pei_goal_id,
          protocol_engine_version, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          ctx.tenantId, learner_id, title, ebp_practice_id, domain, objective,
          mastery_criteria_pct || 80, mastery_criteria_sessions || 3, mastery_criteria_trials || 10,
          measurement_type || null, protocol_library_id || null, pei_goal_id || null,
          engineVersion, ctx.userId
        ]
      )
    })

    return NextResponse.json({ protocol: result.rows[0] }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Aprendiz não encontrado' || error.message === 'Prática EBP não encontrada') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
