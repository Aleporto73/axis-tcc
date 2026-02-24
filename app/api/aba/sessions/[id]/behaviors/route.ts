import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

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

    const result = await withTenant(async ({ client, tenantId }) => {
      return await client.query(
        `SELECT * FROM record_behavior_event($1, $2, $3, $4, $5, $6, $7::aba_behavior_intensity, $8, $9)`,
        [tenantId, id, behavior_type, antecedent, behavior, consequence, intensity, duration_seconds || null, location || null]
      )
    })

    return NextResponse.json({ behavior: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao registrar comportamento:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message?.includes('[AXIS ABA]')) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
