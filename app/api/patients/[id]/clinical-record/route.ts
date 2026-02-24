import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
})

// GET - Buscar registro clínico do paciente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: patientId } = await params

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const result = await pool.query(
      'SELECT * FROM clinical_records WHERE patient_id = $1 AND tenant_id = $2',
      [patientId, tenantId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ exists: false, record: null })
    }

    return NextResponse.json({ exists: true, record: result.rows[0] })
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
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: patientId } = await params
    const body = await request.json()
    const { complaint, patterns, interventions, current_state, original_transcript } = body

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    // Verificar se já existe
    const existingResult = await pool.query(
      'SELECT id FROM clinical_records WHERE patient_id = $1',
      [patientId]
    )
    if (existingResult.rows.length > 0) {
      return NextResponse.json({ error: 'Registro clínico já existe para este paciente' }, { status: 400 })
    }

    const result = await pool.query(
      `INSERT INTO clinical_records (patient_id, tenant_id, complaint, patterns, interventions, current_state, original_transcript)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [patientId, tenantId, complaint, patterns, interventions, current_state, original_transcript]
    )

    // Audit log
    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'CLINICAL_RECORD_CREATED', 'clinical_record', $3, $4)`,
      [tenantId, userId, result.rows[0].id, JSON.stringify({ patient_id: patientId })]
    )

    return NextResponse.json({ success: true, record: result.rows[0] })
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
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: patientId } = await params
    const body = await request.json()
    const { complaint, patterns, interventions, current_state } = body

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const result = await pool.query(
      `UPDATE clinical_records 
       SET complaint = $1, patterns = $2, interventions = $3, current_state = $4, updated_at = NOW()
       WHERE patient_id = $5 AND tenant_id = $6
       RETURNING *`,
      [complaint, patterns, interventions, current_state, patientId, tenantId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, record: result.rows[0] })
  } catch (error) {
    console.error('Erro ao atualizar registro clínico:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
