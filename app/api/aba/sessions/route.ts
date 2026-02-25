import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { sessionFilter, canAccessLearner, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Sessões (Multi-Terapeuta)
// admin/supervisor: veem todas. terapeuta: só suas.
// =====================================================

// GET — Listar sessões ABA do tenant (filtrado por role)
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async (ctx) => {
      const { searchParams } = new URL(request.url)
      const learnerId = searchParams.get('learner_id')
      const status = searchParams.get('status')

      // Filtro por role: terapeuta só vê suas sessões
      const filter = sessionFilter(ctx, 2)

      let query = `
        SELECT s.*, l.name as learner_name
        FROM sessions_aba s
        JOIN learners l ON l.id = s.learner_id
        WHERE s.tenant_id = $1
        ${filter.clause}
      `
      const params: any[] = [ctx.tenantId, ...filter.params]

      if (learnerId) {
        params.push(learnerId)
        query += ` AND s.learner_id = $${params.length}`
      }

      if (status) {
        params.push(status)
        query += ` AND s.status = $${params.length}`
      }

      query += ` ORDER BY s.scheduled_at DESC LIMIT 50`

      return await ctx.client.query(query, params)
    })

    return NextResponse.json({ sessions: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// POST — Criar sessão ABA (agendar)
// Terapeuta só pode agendar para seus aprendizes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { learner_id, scheduled_at, location, notes } = body

    if (!learner_id || !scheduled_at) {
      return NextResponse.json(
        { error: 'learner_id e scheduled_at são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      // Validar learner pertence ao tenant
      const learnerCheck = await ctx.client.query(
        'SELECT id FROM learners WHERE id = $1 AND tenant_id = $2 AND is_active = true',
        [learner_id, ctx.tenantId]
      )

      if (learnerCheck.rows.length === 0) {
        throw new Error('Aprendiz não encontrado')
      }

      // Terapeuta só pode agendar para seus aprendizes
      if (!(await canAccessLearner(ctx, learner_id))) {
        throw new Error('Aprendiz não vinculado a este terapeuta')
      }

      return await ctx.client.query(
        `INSERT INTO sessions_aba (tenant_id, learner_id, therapist_id, scheduled_at, location, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [ctx.tenantId, learner_id, ctx.userId, scheduled_at, location || null, notes || null]
      )
    })

    return NextResponse.json({ session: result.rows[0] }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Aprendiz não encontrado') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'Aprendiz não vinculado a este terapeuta') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
