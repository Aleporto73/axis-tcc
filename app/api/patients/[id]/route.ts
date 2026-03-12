import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params

    const data = await withTenant(async (ctx) => {
      const patientResult = await ctx.client.query(
        `SELECT p.*,
                p.full_name as name,
                COUNT(DISTINCT s.id) as total_sessions
         FROM patients p
         LEFT JOIN sessions s ON s.patient_id = p.id
         WHERE p.id = $1 AND p.tenant_id = $2
         GROUP BY p.id`,
        [patientId, ctx.tenantId]
      )

      if (patientResult.rows.length === 0) {
        throw Object.assign(new Error('Paciente nao encontrado'), { statusCode: 404 })
      }

      const sessionsResult = await ctx.client.query(
        `SELECT * FROM sessions
         WHERE patient_id = $1 AND tenant_id = $2
         ORDER BY created_at DESC
         LIMIT 10`,
        [patientId, ctx.tenantId]
      )

      const suggestionsResult = await ctx.client.query(
        `SELECT * FROM suggestions
         WHERE patient_id = $1 AND tenant_id = $2
         ORDER BY created_at DESC
         LIMIT 10`,
        [patientId, ctx.tenantId]
      )

      return {
        patient: patientResult.rows[0],
        sessions: sessionsResult.rows,
        suggestions: suggestionsResult.rows,
      }
    })

    return NextResponse.json(data)
  } catch (error: any) {
    if (error?.statusCode === 404) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('Erro ao buscar paciente:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params
    const body = await request.json()
    const { full_name, birth_date, gender, phone, email, notes, diagnosis, medication } = body

    if (!full_name || full_name.trim() === '') {
      return NextResponse.json({ error: 'Nome obrigatorio' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      const check = await ctx.client.query(
        'SELECT id FROM patients WHERE id = $1 AND tenant_id = $2',
        [patientId, ctx.tenantId]
      )
      if (check.rows.length === 0) {
        throw Object.assign(new Error('Paciente nao encontrado'), { statusCode: 404 })
      }

      return await ctx.client.query(
        `UPDATE patients SET
          full_name = $1,
          birth_date = $2,
          gender = $3,
          phone = $4,
          email = $5,
          notes = $6,
          diagnosis = $7,
          medication = $8,
          updated_at = NOW()
        WHERE id = $9 AND tenant_id = $10
        RETURNING *`,
        [full_name.trim(), birth_date || null, gender || null, phone || null, email || null, notes || null, diagnosis || null, medication || null, patientId, ctx.tenantId]
      )
    })

    return NextResponse.json({ success: true, patient: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode === 404) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('Erro ao atualizar paciente:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params

    await withTenant(async (ctx) => {
      const check = await ctx.client.query(
        'SELECT id FROM patients WHERE id = $1 AND tenant_id = $2',
        [patientId, ctx.tenantId]
      )
      if (check.rows.length === 0) {
        throw Object.assign(new Error('Paciente nao encontrado'), { statusCode: 404 })
      }

      // Deletar em ordem por causa das foreign keys
      await ctx.client.query('DELETE FROM suggestion_decisions WHERE suggestion_id IN (SELECT id FROM suggestions WHERE patient_id = $1 AND tenant_id = $2)', [patientId, ctx.tenantId])
      await ctx.client.query('DELETE FROM suggestions WHERE patient_id = $1 AND tenant_id = $2', [patientId, ctx.tenantId])
      await ctx.client.query('DELETE FROM tcc_analyses WHERE patient_id = $1 AND tenant_id = $2', [patientId, ctx.tenantId])
      await ctx.client.query('DELETE FROM clinical_states WHERE patient_id = $1 AND tenant_id = $2', [patientId, ctx.tenantId])
      await ctx.client.query('DELETE FROM events WHERE patient_id = $1 AND tenant_id = $2', [patientId, ctx.tenantId])
      await ctx.client.query('DELETE FROM transcripts WHERE patient_id = $1 AND tenant_id = $2', [patientId, ctx.tenantId])
      await ctx.client.query('DELETE FROM sessions WHERE patient_id = $1 AND tenant_id = $2', [patientId, ctx.tenantId])
      await ctx.client.query('DELETE FROM patients WHERE id = $1 AND tenant_id = $2', [patientId, ctx.tenantId])
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.statusCode === 404) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('Erro ao deletar paciente:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
