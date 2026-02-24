import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

async function getTenantId(userId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT id FROM tenants WHERE clerk_user_id = $1',
    [userId]
  )
  return result.rows.length > 0 ? result.rows[0].id : null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const tenantId = await getTenantId(userId)
    if (!tenantId) return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })

    const { id: patientId } = await params

    const patientResult = await pool.query(
      `SELECT p.*,
              p.full_name as name,
              COUNT(DISTINCT s.id) as total_sessions
       FROM patients p
       LEFT JOIN sessions s ON s.patient_id = p.id
       WHERE p.id = $1 AND p.tenant_id = $2
       GROUP BY p.id`,
      [patientId, tenantId]
    )

    if (patientResult.rows.length === 0) {
      return NextResponse.json({ error: 'Paciente nao encontrado' }, { status: 404 })
    }

    const sessionsResult = await pool.query(
      `SELECT * FROM sessions 
       WHERE patient_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC
       LIMIT 10`,
      [patientId, tenantId]
    )

    const suggestionsResult = await pool.query(
      `SELECT * FROM suggestions
       WHERE patient_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC
       LIMIT 10`,
      [patientId, tenantId]
    )

    return NextResponse.json({
      patient: patientResult.rows[0],
      sessions: sessionsResult.rows,
      suggestions: suggestionsResult.rows
    })

  } catch (error) {
    console.error('Erro ao buscar paciente:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const tenantId = await getTenantId(userId)
    if (!tenantId) return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })

    const { id: patientId } = await params
    const body = await request.json()
    const { full_name, birth_date, gender, phone, email, notes, diagnosis, medication } = body

    if (!full_name || full_name.trim() === '') {
      return NextResponse.json({ error: 'Nome obrigatorio' }, { status: 400 })
    }

    const check = await pool.query(
      'SELECT id FROM patients WHERE id = $1 AND tenant_id = $2',
      [patientId, tenantId]
    )
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Paciente nao encontrado' }, { status: 404 })
    }

    const result = await pool.query(
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
      [full_name.trim(), birth_date || null, gender || null, phone || null, email || null, notes || null, diagnosis || null, medication || null, patientId, tenantId]
    )

    return NextResponse.json({ success: true, patient: result.rows[0] })

  } catch (error) {
    console.error('Erro ao atualizar paciente:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const tenantId = await getTenantId(userId)
    if (!tenantId) return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })

    const { id: patientId } = await params

    const check = await pool.query(
      'SELECT id FROM patients WHERE id = $1 AND tenant_id = $2',
      [patientId, tenantId]
    )
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Paciente nao encontrado' }, { status: 404 })
    }

    // Deletar em ordem por causa das foreign keys
    await pool.query('DELETE FROM suggestion_decisions WHERE suggestion_id IN (SELECT id FROM suggestions WHERE patient_id = $1 AND tenant_id = $2)', [patientId, tenantId])
    await pool.query('DELETE FROM suggestions WHERE patient_id = $1 AND tenant_id = $2', [patientId, tenantId])
    await pool.query('DELETE FROM tcc_analyses WHERE patient_id = $1 AND tenant_id = $2', [patientId, tenantId])
    await pool.query('DELETE FROM clinical_states WHERE patient_id = $1 AND tenant_id = $2', [patientId, tenantId])
    await pool.query('DELETE FROM events WHERE patient_id = $1 AND tenant_id = $2', [patientId, tenantId])
    await pool.query('DELETE FROM transcripts WHERE patient_id = $1 AND tenant_id = $2', [patientId, tenantId])
    await pool.query('DELETE FROM sessions WHERE patient_id = $1 AND tenant_id = $2', [patientId, tenantId])
    await pool.query('DELETE FROM patients WHERE id = $1 AND tenant_id = $2', [patientId, tenantId])

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Erro ao deletar paciente:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
