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
        `SELECT s.*, l.name as learner_name,
                p_applied.name as applied_by_name
         FROM sessions_aba s
         JOIN learners l ON l.id = s.learner_id
         LEFT JOIN profiles p_applied ON p_applied.id = s.applied_by
         WHERE s.id = $1 AND s.tenant_id = $2`,
        [id, tenantId]
      )

      if (session.rows.length === 0) {
        throw new Error('Sessão não encontrada')
      }

      const targets = await client.query(
        `SELECT st.*, lp.objective as protocol_objective,
                p_applied.name as applied_by_name
         FROM session_targets st
         JOIN learner_protocols lp ON lp.id = st.protocol_id
         LEFT JOIN profiles p_applied ON p_applied.id = st.applied_by
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

      // Calcular duração ativa (soma dos trials com cronômetro)
      const activeDurationRes = await client.query(
        `SELECT COALESCE(SUM(duration_seconds), 0) as active_seconds,
                COUNT(*) FILTER (WHERE duration_seconds IS NOT NULL) as timed_trials
         FROM session_targets
         WHERE session_id = $1 AND tenant_id = $2`,
        [id, tenantId]
      )

      // Buscar perfis do tenant para dropdown de applied_by
      const profiles = await client.query(
        `SELECT id, name, role FROM profiles
         WHERE tenant_id = $1 AND is_active = true
         ORDER BY name`,
        [tenantId]
      )

      return {
        session: {
          ...session.rows[0],
          active_duration_seconds: parseInt(activeDurationRes.rows[0].active_seconds),
          timed_trials: parseInt(activeDurationRes.rows[0].timed_trials),
        },
        targets: targets.rows,
        behaviors: behaviors.rows,
        profiles: profiles.rows,
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

// PATCH — Ações na sessão (abrir, fechar, atualizar duração)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, duration_minutes_override, applied_by } = body

    // Ação de abrir/fechar sessão
    if (action) {
      if (!['open', 'close'].includes(action)) {
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
    }

    // Atualizar campos V2 (duration_minutes_override, applied_by)
    if (duration_minutes_override !== undefined || applied_by !== undefined) {
      const result = await withTenant(async ({ client, tenantId }) => {
        // Verificar que a sessão existe e pertence ao tenant
        const check = await client.query(
          `SELECT id, status FROM sessions_aba WHERE id = $1 AND tenant_id = $2`,
          [id, tenantId]
        )
        if (check.rows.length === 0) {
          throw new Error('Sessão não encontrada')
        }

        const setClauses: string[] = []
        const vals: any[] = []
        let idx = 1

        if (duration_minutes_override !== undefined) {
          // null para limpar override, number para setar
          setClauses.push(`duration_minutes_override = $${idx}`)
          vals.push(duration_minutes_override)
          idx++
        }
        if (applied_by !== undefined) {
          setClauses.push(`applied_by = $${idx}`)
          vals.push(applied_by)
          idx++
        }

        vals.push(id, tenantId)
        const res = await client.query(
          `UPDATE sessions_aba SET ${setClauses.join(', ')}
           WHERE id = $${idx} AND tenant_id = $${idx + 1}
           RETURNING *`,
          vals
        )

        return res
      })

      return NextResponse.json({ session: result.rows[0] })
    }

    return NextResponse.json(
      { error: 'Nenhuma ação ou campo válido fornecido' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Erro ao atualizar sessão ABA:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message === 'Sessão não encontrada') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message?.includes('[AXIS ABA]')) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
