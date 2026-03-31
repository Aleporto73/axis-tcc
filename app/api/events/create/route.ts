import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

/**
 * POST /api/events/create
 *
 * Cria micro-evento clínico (AVOIDANCE, CONFRONTATION, etc.).
 * Conforme pipeline AXIS: Session → Events → CSO → Suggestion
 *
 * Migration: withTenant (resolve tenant corretamente via cookie multi-tenant)
 */
export async function POST(request: NextRequest) {
  try {
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

    const result = await withTenant(async (ctx) => {
      const { client, tenantId, userId } = ctx

      // Verificar se paciente pertence ao tenant
      const patientCheck = await client.query(
        'SELECT id FROM patients WHERE id = $1 AND tenant_id = $2',
        [patient_id, tenantId]
      )
      if (patientCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Paciente nao encontrado' }, { status: 404 })
      }

      // Inserir evento
      const eventResult = await client.query(
        `INSERT INTO events (tenant_id, patient_id, event_type, payload, source, related_entity_id)
         VALUES ($1, $2, $3, $4, 'professional_input', $5)
         RETURNING *`,
        [tenantId, patient_id, event_type, JSON.stringify(payload || {}), related_entity_id || null]
      )

      // Audit log - EVENT_MARK
      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'human', 'EVENT_MARK', 'event', $3, $4)`,
        [tenantId, userId, eventResult.rows[0].id, JSON.stringify({ event_type })]
      )

      return NextResponse.json({ success: true, event: eventResult.rows[0] })
    })

    return result
  } catch (error: any) {
    console.error('[EVENTS] Erro ao criar evento:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
