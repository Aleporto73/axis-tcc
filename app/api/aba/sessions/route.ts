import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// GET — Listar sessões ABA do tenant
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      const { searchParams } = new URL(request.url)
      const learnerId = searchParams.get('learner_id')
      const status = searchParams.get('status')

      let query = `
        SELECT s.*, l.name as learner_name
        FROM sessions_aba s
        JOIN learners l ON l.id = s.learner_id
        WHERE s.tenant_id = $1
      `
      const params: any[] = [tenantId]

      if (learnerId) {
        params.push(learnerId)
        query += ` AND s.learner_id = $${params.length}`
      }

      if (status) {
        params.push(status)
        query += ` AND s.status = $${params.length}`
      }

      query += ` ORDER BY s.scheduled_at DESC LIMIT 50`

      return await client.query(query, params)
    })

    return NextResponse.json({ sessions: result.rows })
  } catch (error: any) {
    console.error('Erro ao listar sessões ABA:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Criar sessão ABA (agendar)
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

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      // Validar learner pertence ao tenant
      const learnerCheck = await client.query(
        'SELECT id FROM learners WHERE id = $1 AND tenant_id = $2 AND is_active = true',
        [learner_id, tenantId]
      )

      if (learnerCheck.rows.length === 0) {
        throw new Error('Aprendiz não encontrado')
      }

      return await client.query(
        `INSERT INTO sessions_aba (tenant_id, learner_id, therapist_id, scheduled_at, location, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [tenantId, learner_id, userId, scheduled_at, location || null, notes || null]
      )
    })

    return NextResponse.json({ session: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao criar sessão ABA:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message === 'Aprendiz não encontrado') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
