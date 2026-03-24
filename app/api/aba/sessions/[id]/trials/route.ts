import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { canAccessLearner, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Registrar Trial de Alvo
// POST — Registra trial via record_target_trial()
//
// Hardening P0:
//   - canAccessLearner: verifica vínculo terapeuta↔learner
//   - handleRouteError padronizado
//   - 404 genérico para acesso negado
// =====================================================

// POST — Registrar trial de um alvo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { protocol_id, target_name, trials_total, trials_correct, prompt_level, notes, duration_seconds, applied_by } = body

    if (!protocol_id || !target_name || trials_total == null || trials_correct == null || !prompt_level) {
      return NextResponse.json(
        { error: 'protocol_id, target_name, trials_total, trials_correct e prompt_level são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      // Hardening: verificar sessão + acesso ao learner
      const sessCheck = await client.query(
        'SELECT learner_id FROM sessions_aba WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )
      if (sessCheck.rows.length === 0) throw new Error('Não encontrado')

      const canAccess = await canAccessLearner(ctx, sessCheck.rows[0].learner_id)
      if (!canAccess) throw new Error('Não encontrado')

      // Core insert via DB function (preserva lógica de score/snapshot)
      const res = await client.query(
        `SELECT * FROM record_target_trial($1, $2, $3, $4, $5::smallint, $6::smallint, $7::aba_prompt_level, $8)`,
        [tenantId, id, protocol_id, target_name, trials_total, trials_correct, prompt_level, notes || null]
      )

      const target = res.rows[0]

      // Update com campos V2 (duration + applied_by) se fornecidos
      const hasV2Fields = duration_seconds != null || applied_by
      if (hasV2Fields && target?.id) {
        const setClauses: string[] = []
        const vals: any[] = []
        let idx = 1

        if (duration_seconds != null) {
          setClauses.push(`duration_seconds = $${idx}`)
          vals.push(duration_seconds)
          idx++
        }
        if (applied_by) {
          setClauses.push(`applied_by = $${idx}`)
          vals.push(applied_by)
          idx++
        }

        vals.push(target.id)
        await client.query(
          `UPDATE session_targets SET ${setClauses.join(', ')} WHERE id = $${idx}`,
          vals
        )

        if (duration_seconds != null) target.duration_seconds = duration_seconds
        if (applied_by) target.applied_by = applied_by
      }

      return res
    })

    return NextResponse.json({ target: result.rows[0] }, { status: 201 })
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
