import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

/**
 * GET /api/sessions
 * List all sessions for the authenticated tenant
 * Migration: withTenant (Auditoria TCC P0)
 */
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      const queryResult = await client.query(
        `SELECT
          s.id,
          s.patient_id,
          s.session_number,
          s.session_type,
          s.scheduled_at,
          s.started_at,
          s.ended_at,
          s.duration_minutes,
          s.status,
          s.created_at,
          s.patient_response,
          p.full_name as patient_name,
          (SELECT COUNT(*) FROM patient_push_tokens ppt WHERE ppt.patient_id = s.patient_id) > 0 as push_enabled
        FROM sessions s
        LEFT JOIN patients p ON s.patient_id = p.id
        WHERE s.tenant_id = $1
        ORDER BY s.scheduled_at DESC NULLS LAST, s.created_at DESC
        LIMIT 50`,
        [tenantId]
      )

      return { sessions: queryResult.rows }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao buscar sessoes:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
