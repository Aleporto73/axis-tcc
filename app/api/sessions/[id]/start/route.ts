import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

/**
 * POST /api/sessions/[id]/start
 * Start a session (change status from 'agendada' to 'em_andamento')
 * Migration: withTenant (Auditoria TCC P0)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const { client, tenantId, userId } = ctx

      const sessionCheck = await client.query(
        'SELECT id, status FROM sessions WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )

      if (sessionCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
      }

      if (sessionCheck.rows[0].status !== 'agendada') {
        return NextResponse.json({ error: 'Sessao ja foi iniciada ou finalizada' }, { status: 400 })
      }

      const updateResult = await client.query(
        `UPDATE sessions
         SET status = 'em_andamento', started_at = NOW()
         WHERE id = $1 AND tenant_id = $2
         RETURNING id, patient_id, session_number, scheduled_at, started_at, status`,
        [id, tenantId]
      )

      // Audit log - SESSION_START
      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'human', 'SESSION_START', 'session', $3, $4)`,
        [tenantId, userId, updateResult.rows[0].id, JSON.stringify({ session_number: updateResult.rows[0].session_number })]
      )

      return NextResponse.json({
        success: true,
        session: updateResult.rows[0]
      })
    })

    return result
  } catch (error) {
    console.error('Erro ao iniciar sessao:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
