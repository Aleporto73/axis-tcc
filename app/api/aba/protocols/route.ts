import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// GET — Listar protocolos de um aprendiz
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      const { searchParams } = new URL(request.url)
      const learnerId = searchParams.get('learner_id')
      const status = searchParams.get('status')

      let query = `
        SELECT lp.*, l.name as learner_name, ep.name as ebp_name,
               pg.title as pei_goal_title, pg.domain as pei_goal_domain
        FROM learner_protocols lp
        JOIN learners l ON l.id = lp.learner_id
        JOIN ebp_practices ep ON ep.id = lp.ebp_practice_id
        LEFT JOIN pei_goals pg ON pg.id = lp.pei_goal_id
        WHERE lp.tenant_id = $1
      `
      const params: any[] = [tenantId]

      if (learnerId) {
        params.push(learnerId)
        query += ` AND lp.learner_id = $${params.length}`
      }

      if (status) {
        params.push(status)
        query += ` AND lp.status = $${params.length}`
      }

      query += ` ORDER BY lp.created_at DESC`

      return await client.query(query, params)
    })

    return NextResponse.json({ protocols: result.rows })
  } catch (error: any) {
    console.error('Erro ao listar protocolos:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Criar protocolo para um aprendiz
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

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      // Validar learner pertence ao tenant
      const learnerCheck = await client.query(
        'SELECT id FROM learners WHERE id = $1 AND tenant_id = $2 AND is_active = true',
        [learner_id, tenantId]
      )

      if (learnerCheck.rows.length === 0) {
        throw new Error('Aprendiz não encontrado')
      }

      // Validar EBP existe
      const ebpCheck = await client.query(
        'SELECT id FROM ebp_practices WHERE id = $1',
        [ebp_practice_id]
      )

      if (ebpCheck.rows.length === 0) {
        throw new Error('Prática EBP não encontrada')
      }

      // Buscar engine version atual
      const engineResult = await client.query(
        "SELECT version FROM engine_versions WHERE is_current = true"
      )

      const engineVersion = engineResult.rows[0]?.version || '2.6.1'

      return await client.query(
        `INSERT INTO learner_protocols (
          tenant_id, learner_id, title, ebp_practice_id, domain, objective,
          mastery_criteria_pct, mastery_criteria_sessions, mastery_criteria_trials,
          measurement_type, protocol_library_id, pei_goal_id,
          protocol_engine_version, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          tenantId, learner_id, title, ebp_practice_id, domain, objective,
          mastery_criteria_pct || 80, mastery_criteria_sessions || 3, mastery_criteria_trials || 10,
          measurement_type || null, protocol_library_id || null, pei_goal_id || null,
          engineVersion, userId
        ]
      )
    })

    return NextResponse.json({ protocol: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao criar protocolo:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message === 'Aprendiz não encontrado' || error.message === 'Prática EBP não encontrada') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
