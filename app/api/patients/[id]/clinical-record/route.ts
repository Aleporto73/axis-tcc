import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// GET - Buscar registro clínico do paciente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params

    return await withTenant(async (ctx) => {
      const result = await ctx.client.query(
        'SELECT * FROM clinical_records WHERE patient_id = $1 AND tenant_id = $2',
        [patientId, ctx.tenantId]
      )

      if (result.rows.length === 0) {
        return NextResponse.json({ exists: false, record: null })
      }

      return NextResponse.json({ exists: true, record: result.rows[0] })
    })
  } catch (error) {
    console.error('Erro ao buscar registro clínico:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST - Criar registro clínico
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params
    const body = await request.json()
    const { complaint, patterns, interventions, current_state, original_transcript } = body

    return await withTenant(async (ctx) => {
      // Verificar se já existe (com tenant_id para isolamento multi-tenant)
      const existingResult = await ctx.client.query(
        'SELECT id FROM clinical_records WHERE patient_id = $1 AND tenant_id = $2',
        [patientId, ctx.tenantId]
      )
      if (existingResult.rows.length > 0) {
        return NextResponse.json({ error: 'Registro clínico já existe para este paciente' }, { status: 400 })
      }

      const result = await ctx.client.query(
        `INSERT INTO clinical_records (patient_id, tenant_id, complaint, patterns, interventions, current_state, original_transcript)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [patientId, ctx.tenantId, complaint, patterns, interventions, current_state, original_transcript]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'CLINICAL_RECORD_CREATED', 'clinical_record', $3, $4)`,
        [ctx.tenantId, ctx.userId, result.rows[0].id, JSON.stringify({ patient_id: patientId })]
      )

      return NextResponse.json({ success: true, record: result.rows[0] })
    })
  } catch (error) {
    console.error('Erro ao criar registro clínico:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT - Atualizar registro clínico
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params
    const body = await request.json()
    const { complaint, patterns, interventions, current_state } = body

    return await withTenant(async (ctx) => {
      const result = await ctx.client.query(
        `UPDATE clinical_records
         SET complaint = $1, patterns = $2, interventions = $3, current_state = $4, updated_at = NOW()
         WHERE patient_id = $5 AND tenant_id = $6
         RETURNING *`,
        [complaint, patterns, interventions, current_state, patientId, ctx.tenantId]
      )

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
      }

      return NextResponse.json({ success: true, record: result.rows[0] })
    })
  } catch (error) {
    console.error('Erro ao atualizar registro clínico:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
