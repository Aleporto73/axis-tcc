import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const body = await request.json()
    const { name, email, phone, birth_date, notes } = body

    const result = await pool.query(
      `INSERT INTO patients (tenant_id, full_name, email, phone, birth_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, name, email || null, phone || null, birth_date || null, notes || null]
    )

    // Audit log - PATIENT_CREATE
    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'human', 'PATIENT_CREATE', 'patient', $3, $4)`,
      [tenantId, userId, result.rows[0].id, JSON.stringify({ has_email: !!email, has_phone: !!phone })]
    )

    return NextResponse.json({ patient: result.rows[0] })
  } catch (error) {
    console.error('Erro ao criar paciente:', error)
    return NextResponse.json({ error: 'Erro ao criar paciente' }, { status: 500 })
  }
}
