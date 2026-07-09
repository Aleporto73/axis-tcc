import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { canAccessLearner, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Sessão Individual
// GET — Detalhe com targets e behaviors
// PATCH — Abrir/fechar sessão, atualizar campos V2
//
// Hardening P0:
//   - canAccessLearner em GET e PATCH
//   - open/close: SQL direto (functions PL/pgSQL não estão em migrations)
//   - handleRouteError padronizado
//   - 404 genérico para acesso negado
// =====================================================

// GET — Sessão individual com targets e behaviors
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx
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
        throw new Error('Não encontrado')
      }

      // Hardening: verificar acesso ao learner
      const canAccess = await canAccessLearner(ctx, session.rows[0].learner_id)
      if (!canAccess) throw new Error('Não encontrado')

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
  } catch (err: unknown) {
    const { message, status } = handleRouteError(err)
    if (status < 500) return NextResponse.json({ error: message }, { status })
    // Erro genérico para 'Não encontrado' que não é capturado por handleRouteError
    if (err instanceof Error && err.message === 'Não encontrado') {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
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

      const result = await withTenant(async (ctx) => {
        const { client, tenantId, userId } = ctx

        // Verificar sessão + acesso ao learner
        const check = await client.query(
          `SELECT id, learner_id, status FROM sessions_aba WHERE id = $1 AND tenant_id = $2`,
          [id, tenantId]
        )
        if (check.rows.length === 0) throw new Error('Não encontrado')

        const canAccess = await canAccessLearner(ctx, check.rows[0].learner_id)
        if (!canAccess) throw new Error('Não encontrado')

        const sess = check.rows[0]

        if (action === 'open') {
          // SQL direto: abrir sessão (substituindo open_session_aba que não está em migrations)
          if (sess.status === 'in_progress') {
            throw new Error('[AXIS ABA] Sessão já está aberta')
          }
          if (sess.status === 'completed') {
            throw new Error('[AXIS ABA] Sessão já foi finalizada')
          }
          const res = await client.query(
            `UPDATE sessions_aba SET status = 'in_progress', started_at = COALESCE(started_at, NOW())
             WHERE id = $1 AND tenant_id = $2 RETURNING *`,
            [id, tenantId]
          )
          return res
        } else {
          // D2 (Fase D): religa o motor CSO. close_session_aba fecha a sessão E gera
          // session_snapshots + clinical_states_aba + CSO, atômico na transação do withTenant.
          // Recusa qualquer sessão != in_progress (000:555-557) → não toca as órfãs históricas.
          if (sess.status !== 'in_progress') {
            throw new Error('[AXIS ABA] Sessão não está em andamento')
          }
          await client.query(
            'SELECT close_session_aba($1::uuid, $2::varchar)',
            [id, userId || 'system']
          )
          const res = await client.query(
            `SELECT * FROM sessions_aba WHERE id = $1::uuid AND tenant_id = $2::uuid`,
            [id, tenantId]
          )
          return res
        }
      })

      return NextResponse.json({ session: result.rows[0] })
    }

    // Atualizar campos V2 (duration_minutes_override, applied_by)
    if (duration_minutes_override !== undefined || applied_by !== undefined) {
      // B2: motivo obrigatório ao editar sessão concluída (aceita reason|motivo)
      const reason = (body.reason ?? body.motivo ?? '').toString().trim()

      const result = await withTenant(async (ctx) => {
        const { client, tenantId, userId } = ctx
        // Verificar que a sessão existe e pertence ao tenant
        const check = await client.query(
          `SELECT id, learner_id, status, duration_minutes_override, applied_by
           FROM sessions_aba WHERE id = $1 AND tenant_id = $2`,
          [id, tenantId]
        )
        if (check.rows.length === 0) throw new Error('Não encontrado')

        // Hardening: verificar acesso ao learner
        const canAccess = await canAccessLearner(ctx, check.rows[0].learner_id)
        if (!canAccess) throw new Error('Não encontrado')

        const sess = check.rows[0]

        // B2: carve-out auditado (não bloqueio). Sessão concluída exige motivo.
        // Sentinel local em vez de throw — evita virar 500 no handleRouteError.
        if (sess.status === 'completed' && !reason) {
          return {
            validationError: {
              status: 422,
              error: 'Motivo obrigatório para editar sessão concluída.',
            },
          }
        }

        const setClauses: string[] = []
        const vals: any[] = []
        let idx = 1

        if (duration_minutes_override !== undefined) {
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

        // B2: edição de sessão concluída → audit log explícito na mesma transação.
        // (Nenhum trigger loga edição de duração; só mudança de status.)
        if (sess.status === 'completed') {
          await client.query(
            `INSERT INTO axis_audit_logs
               (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
             VALUES ($1, $2, 'human', 'SESSION_ABA_COMPLETED_OVERRIDE_EDIT', 'sessions_aba', $3, $4, NOW())`,
            [
              tenantId,
              userId,
              id,
              JSON.stringify({
                reason,
                previous_duration_minutes_override: sess.duration_minutes_override,
                new_duration_minutes_override:
                  duration_minutes_override !== undefined
                    ? duration_minutes_override
                    : sess.duration_minutes_override,
                previous_applied_by: sess.applied_by,
                new_applied_by: applied_by !== undefined ? applied_by : sess.applied_by,
                status: 'completed',
                source: 'aba_sessions_patch',
              }),
            ]
          )
        }

        return res
      })

      // B2: propaga o sentinel de validação como 422 (fora da transação)
      if ('validationError' in result) {
        return NextResponse.json(
          { error: result.validationError.error },
          { status: result.validationError.status }
        )
      }

      return NextResponse.json({ session: result.rows[0] })
    }

    return NextResponse.json(
      { error: 'Nenhuma ação ou campo válido fornecido' },
      { status: 400 }
    )
  } catch (err: unknown) {
    const { message, status } = handleRouteError(err)
    if (status < 500) return NextResponse.json({ error: message }, { status })
    if (err instanceof Error && err.message === 'Não encontrado') {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    }
    if (err instanceof Error && err.message?.includes('[AXIS ABA]')) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
