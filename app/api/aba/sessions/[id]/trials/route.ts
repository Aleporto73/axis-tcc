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
    const { protocol_id, target_name, trials_total, trials_correct, prompt_level, notes } = body

    if (!protocol_id || !target_name || trials_total == null || trials_correct == null || !prompt_level) {
      return NextResponse.json(
        { error: 'protocol_id, target_name, trials_total, trials_correct e prompt_level são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await withTenant(async ({ client, tenantId }) => {
      return await client.query(
        `SELECT * FROM record_target_trial($1, $2, $3, $4, $5::smallint, $6::smallint, $7::aba_prompt_level, $8)`,
        [tenantId, id, protocol_id, target_name, trials_total, trials_correct, prompt_level, notes || null]
      )
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
