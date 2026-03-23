import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

/**
 * GET /api/sessions/[id]
 * Retrieve a single session by ID
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

      const queryResult = await client.query(
        `SELECT
          s.id, s.patient_id, s.session_number, s.session_type,
          s.scheduled_at, s.started_at, s.ended_at, s.duration_minutes,
          s.status, s.mood_check, s.bridge_from_last, s.agenda_items,
          s.created_at, s.google_meet_link, p.full_name as patient_name
        FROM sessions s
        LEFT JOIN patients p ON s.patient_id = p.id
        WHERE s.id = $1 AND s.tenant_id = $2`,
        [id, tenantId]
      )

      if (queryResult.rows.length === 0) {
        return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
      }

      return NextResponse.json({ session: queryResult.rows[0] })
    })

    return result
  } catch (error) {
    console.error('Erro ao buscar sessao:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * DELETE /api/sessions/[id]
 * Cancel a session (delete)
 * Migration: withTenant (Auditoria TCC P0)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      const sessionResult = await client.query(
        'SELECT id FROM sessions WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )

      if (sessionResult.rows.length === 0) {
        return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
      }

      await client.query(
        'DELETE FROM scheduled_reminders WHERE session_id = $1 AND tenant_id = $2 AND sent = false',
        [id, tenantId]
      )

      await client.query(
        'DELETE FROM sessions WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )

      return NextResponse.json({ success: true, message: 'Sessao cancelada' })
    })

    return result
  } catch (error) {
    console.error('Erro ao deletar sessao:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
