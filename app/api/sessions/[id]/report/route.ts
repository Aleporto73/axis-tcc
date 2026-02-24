import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { id } = await params

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const sessionResult = await pool.query(
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

    const eventsResult = await pool.query(
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

    const csoResult = await pool.query(
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

  } catch (error) {
    console.error('Erro ao buscar relatorio da sessao:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
