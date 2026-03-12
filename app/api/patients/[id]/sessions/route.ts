import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    return await withTenant(async (ctx) => {
      const sessionsResult = await ctx.client.query(
        `SELECT id, session_number, status, scheduled_at, started_at, ended_at, duration_minutes, created_at
         FROM sessions
         WHERE patient_id = $1 AND tenant_id = $2
         ORDER BY created_at DESC`,
        [id, ctx.tenantId]
      )

      return NextResponse.json({ sessions: sessionsResult.rows })
    })

  } catch (error) {
    console.error('Erro ao buscar sessoes:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
