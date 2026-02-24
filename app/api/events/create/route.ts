import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const body = await request.json()
    const { patient_id, event_type, payload, related_entity_id } = body

    if (!patient_id || !event_type) {
      return NextResponse.json({ error: 'patient_id e event_type obrigatorios' }, { status: 400 })
    }

    const allowed = [
      'AVOIDANCE_OBSERVED',
      'CONFRONTATION_OBSERVED',
      'ADJUSTMENT_OBSERVED',
      'RECOVERY_OBSERVED',
      'SESSION_START',
      'SESSION_END',
      'TASK_COMPLETED',
      'TASK_INCOMPLETE',
      'MOOD_CHECK'
    ]

    if (!allowed.includes(event_type)) {
      return NextResponse.json({ error: 'Tipo de evento invalido' }, { status: 400 })
    }

    const patientCheck = await pool.query(
      'SELECT id FROM patients WHERE id = $1 AND tenant_id = $2',
      [patient_id, tenantId]
    )
    if (patientCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Paciente nao encontrado' }, { status: 404 })
    }

    const result = await pool.query(
      `INSERT INTO events (tenant_id, patient_id, event_type, payload, source, related_entity_id)
       VALUES ($1, $2, $3, $4, 'professional_input', $5)
       RETURNING *`,
      [tenantId, patient_id, event_type, JSON.stringify(payload || {}), related_entity_id || null]
    )

    // Audit log - EVENT_MARK
    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'human', 'EVENT_MARK', 'event', $3, $4)`,
      [tenantId, userId, result.rows[0].id, JSON.stringify({ event_type })]
    )
    return NextResponse.json({ success: true, event: result.rows[0] })

  } catch (error) {
    console.error('[EVENTS] Erro ao criar evento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
