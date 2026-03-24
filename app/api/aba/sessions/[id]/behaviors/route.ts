import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { canAccessLearner, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Registrar Evento Comportamental (ABC)
// POST — Registra evento via record_behavior_event()
//
// Hardening P0:
//   - canAccessLearner: verifica vínculo terapeuta↔learner
//   - handleRouteError padronizado
//   - 404 genérico para acesso negado
// =====================================================

// POST — Registrar evento comportamental ABC
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { behavior_type, antecedent, behavior, consequence, intensity, duration_seconds, location } = body

    if (!behavior_type || !antecedent || !behavior || !consequence || !intensity) {
      return NextResponse.json(
        { error: 'behavior_type, antecedent, behavior, consequence e intensity são obrigatórios' },
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

      return await client.query(
        `SELECT * FROM record_behavior_event($1, $2, $3, $4, $5, $6, $7::aba_behavior_intensity, $8, $9)`,
        [tenantId, id, behavior_type, antecedent, behavior, consequence, intensity, duration_seconds || null, location || null]
      )
    })

    return NextResponse.json({ behavior: result.rows[0] }, { status: 201 })
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
