import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

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

    const result = await withTenant(async ({ client, tenantId }) => {
      // 1. Core insert via DB function (preserva lógica de score/snapshot)
      const res = await client.query(
        `SELECT * FROM record_target_trial($1, $2, $3, $4, $5::smallint, $6::smallint, $7::aba_prompt_level, $8)`,
        [tenantId, id, protocol_id, target_name, trials_total, trials_correct, prompt_level, notes || null]
      )

      const target = res.rows[0]

      // 2. Update com campos V2 (duration + applied_by) se fornecidos
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

        // Retorna o target atualizado
        if (duration_seconds != null) target.duration_seconds = duration_seconds
        if (applied_by) target.applied_by = applied_by
      }

      return res
    })

    return NextResponse.json({ target: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao registrar trial:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message?.includes('[AXIS ABA]')) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
