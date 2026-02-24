import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// GET — Listar acessos do portal família
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      const { searchParams } = new URL(request.url)
      const learnerId = searchParams.get('learner_id')

      let query = `
        SELECT fpa.*, g.name as guardian_name, l.name as learner_name
        FROM family_portal_access fpa
        JOIN guardians g ON g.id = fpa.guardian_id
        JOIN learners l ON l.id = fpa.learner_id
        WHERE fpa.tenant_id = $1
      `
      const params: any[] = [tenantId]

      if (learnerId) {
        params.push(learnerId)
        query += ` AND fpa.learner_id = $${params.length}`
      }

      query += ` ORDER BY fpa.created_at DESC`

      return await client.query(query, params)
    })

    return NextResponse.json({ accesses: result.rows })
  } catch (error: any) {
    console.error('Erro ao listar acessos portal:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Conceder ou revogar acesso ao portal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (!action || !['grant', 'revoke'].includes(action)) {
      return NextResponse.json(
        { error: 'action deve ser "grant" ou "revoke"' },
        { status: 400 }
      )
    }

    if (action === 'grant') {
      const { guardian_id, learner_id } = body

      if (!guardian_id || !learner_id) {
        return NextResponse.json(
          { error: 'guardian_id e learner_id são obrigatórios' },
          { status: 400 }
        )
      }

      const result = await withTenant(async ({ client, tenantId, userId }) => {
        return await client.query(
          'SELECT grant_portal_access($1, $2, $3, $4) as access_id',
          [guardian_id, learner_id, tenantId, userId]
        )
      })

      return NextResponse.json({ access_id: result.rows[0]?.access_id }, { status: 201 })
    }

    if (action === 'revoke') {
      const { access_id } = body

      if (!access_id) {
        return NextResponse.json(
          { error: 'access_id é obrigatório para revogar' },
          { status: 400 }
        )
      }

      await withTenant(async ({ client, tenantId, userId }) => {
        await client.query(
          'SELECT revoke_portal_access($1, $2, $3)',
          [access_id, tenantId, userId]
        )
      })

      return NextResponse.json({ revoked: true }, { status: 200 })
    }
  } catch (error: any) {
    console.error('Erro ao gerenciar portal:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message?.includes('[AXIS ABA]')) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
