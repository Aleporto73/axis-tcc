import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const patientId = params.id

    return await withTenant(async (ctx) => {
      const result = await ctx.client.query(
        'SELECT supervision_context FROM patients WHERE id = $1 AND tenant_id = $2',
        [patientId, ctx.tenantId]
      )

      return NextResponse.json({
        context: result.rows[0]?.supervision_context || ''
      })
    })
  } catch (error) {
    console.error('Erro ao buscar contexto supervisão:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const patientId = params.id
    const body = await request.json()
    const { context: supervisionContext } = body

    if (typeof supervisionContext !== 'string' || supervisionContext.length > 800) {
      return NextResponse.json({ error: 'Texto inválido (máx 800 caracteres)' }, { status: 400 })
    }

    return await withTenant(async (ctx) => {
      await ctx.client.query(
        'UPDATE patients SET supervision_context = $1 WHERE id = $2 AND tenant_id = $3',
        [supervisionContext || null, patientId, ctx.tenantId]
      )

      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'professional', 'SUPERVISION_CONTEXT_SAVED', 'patient', $3, $4)`,
        [ctx.tenantId, ctx.userId, patientId, JSON.stringify({ patient_id: patientId, length: supervisionContext.length })]
      )

      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Erro ao salvar contexto supervisão:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
