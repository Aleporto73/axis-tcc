import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// GET — Listar aprendizes do tenant
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      const { searchParams } = new URL(request.url)
      const activeOnly = searchParams.get('active') !== 'false'

      let query = `
        SELECT l.*,
          (SELECT COUNT(*) FROM sessions_aba s WHERE s.learner_id = l.id AND s.tenant_id = l.tenant_id) as total_sessions,
          (SELECT COUNT(*) FROM learner_protocols lp WHERE lp.learner_id = l.id AND lp.tenant_id = l.tenant_id AND lp.status = 'active') as active_protocols
        FROM learners l
        WHERE l.tenant_id = $1
      `
      const params: any[] = [tenantId]

      if (activeOnly) {
        query += ` AND l.is_active = true AND l.deleted_at IS NULL`
      }

      query += ` ORDER BY l.name`

      return await client.query(query, params)
    })

    return NextResponse.json({ learners: result.rows })
  } catch (error: any) {
    console.error('Erro ao listar aprendizes:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Criar aprendiz
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, birth_date, diagnosis, cid_code, support_level, school, notes } = body

    if (!name || !birth_date) {
      return NextResponse.json(
        { error: 'name e birth_date são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await withTenant(async ({ client, tenantId }) => {
      return await client.query(
        `INSERT INTO learners (tenant_id, name, birth_date, diagnosis, cid_code, support_level, school, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [tenantId, name, birth_date, diagnosis || null, cid_code || null, support_level || 2, school || null, notes || null]
      )
    })

    return NextResponse.json({ learner: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao criar aprendiz:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
