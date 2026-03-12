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

    // Verificar limite de pacientes do plano TCC
    // Regra v1.x: FREE (sem hotmart_plan) = 1 paciente, PRO (com hotmart_plan) = ilimitado
    const licenseResult = await pool.query(
      `SELECT hotmart_plan FROM user_licenses
       WHERE tenant_id = $1 AND product_type = 'tcc' AND is_active = true
       LIMIT 1`,
      [tenantId]
    )
    const isPro = licenseResult.rows[0]?.hotmart_plan != null
    const maxPatients = isPro ? 999999 : 1

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM patients WHERE tenant_id = $1',
      [tenantId]
    )
    const currentCount = countResult.rows[0]?.total ?? 0

    if (currentCount >= maxPatients) {
      return NextResponse.json(
        { error: 'Limite de pacientes atingido. Faça upgrade para o plano Profissional.' },
        { status: 403 }
      )
    }

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
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Erro ao criar paciente:', msg, error)
    return NextResponse.json({ error: `Erro ao criar paciente: ${msg}` }, { status: 500 })
  }
}
