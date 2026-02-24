import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// GET — Sessão individual com targets e behaviors
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async ({ client, tenantId }) => {
      const session = await client.query(
        `SELECT s.*, l.name as learner_name
         FROM sessions_aba s
         JOIN learners l ON l.id = s.learner_id
         WHERE s.id = $1 AND s.tenant_id = $2`,
        [id, tenantId]
      )

      if (session.rows.length === 0) {
        throw new Error('Sessão não encontrada')
      }

      const targets = await client.query(
        `SELECT st.*, lp.objective as protocol_objective
         FROM session_targets st
         JOIN learner_protocols lp ON lp.id = st.protocol_id
         WHERE st.session_id = $1 AND st.tenant_id = $2
         ORDER BY st.created_at`,
        [id, tenantId]
      )

      const behaviors = await client.query(
        `SELECT * FROM session_behaviors
         WHERE session_id = $1 AND tenant_id = $2
         ORDER BY recorded_at`,
        [id, tenantId]
      )

      return {
        session: session.rows[0],
        targets: targets.rows,
        behaviors: behaviors.rows,
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Erro ao buscar sessão ABA:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message === 'Sessão não encontrada') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH — Ações na sessão (abrir, fechar)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action } = body

    if (!action || !['open', 'close'].includes(action)) {
      return NextResponse.json(
        { error: 'action deve ser "open" ou "close"' },
        { status: 400 }
      )
    }

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      if (action === 'open') {
        return await client.query(
          'SELECT * FROM open_session_aba($1, $2)',
          [tenantId, id]
        )
      } else {
        return await client.query(
          'SELECT * FROM close_session_aba($1, $2)',
          [id, userId || 'system']
        )
      }
    })

    return NextResponse.json({ session: result.rows[0] })
  } catch (error: any) {
    console.error('Erro ao atualizar sessão ABA:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message?.includes('[AXIS ABA]')) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
