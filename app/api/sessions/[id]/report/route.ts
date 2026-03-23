import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

/**
 * GET /api/sessions/[id]/report
 * Generate a clinical report for a session
 * Migration: withTenant (Auditoria TCC P0)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      const sessionResult = await client.query(
        `SELECT s.*, p.full_name as patient_name
         FROM sessions s
         JOIN patients p ON p.id = s.patient_id
         WHERE s.id = $1 AND s.tenant_id = $2`,
        [id, tenantId]
      )

      if (sessionResult.rows.length === 0) {
        return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
      }

      const session = sessionResult.rows[0]

      const eventsResult = await client.query(
        `SELECT event_type, COUNT(*) as count
         FROM events
         WHERE related_entity_id = $1 AND tenant_id = $2
         AND event_type IN ('AVOIDANCE_OBSERVED', 'CONFRONTATION_OBSERVED', 'ADJUSTMENT_OBSERVED', 'RECOVERY_OBSERVED')
         GROUP BY event_type`,
        [id, tenantId]
      )

      const events = eventsResult.rows.map(r => ({
        type: r.event_type,
        count: parseInt(r.count)
      }))
      const totalEvents = events.reduce((sum, e) => sum + e.count, 0)

      const csoResult = await client.query(
        `SELECT activation_level, cognitive_rigidity, emotional_load, flex_trend
         FROM clinical_states
         WHERE patient_id = $1 AND tenant_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [session.patient_id, tenantId]
      )

      const cso = csoResult.rows.length > 0 ? csoResult.rows[0] : null

      return NextResponse.json({
        session_number: session.session_number,
        date: session.started_at || session.scheduled_at || session.created_at,
        duration: session.duration_minutes,
        status: session.status,
        patient_name: session.patient_name,
        events,
        total_events: totalEvents,
        has_transcription: !!session.transcription,
        cso
      })
    })

    return result
  } catch (error) {
    console.error('Erro ao buscar relatorio da sessao:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
