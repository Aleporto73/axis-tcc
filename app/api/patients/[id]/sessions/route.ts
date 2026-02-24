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

    const sessionsResult = await pool.query(
      `SELECT id, session_number, status, scheduled_at, started_at, ended_at, duration_minutes, created_at
       FROM sessions 
       WHERE patient_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC`,
      [id, tenantId]
    )

    return NextResponse.json({ sessions: sessionsResult.rows })

  } catch (error) {
    console.error('Erro ao buscar sessoes:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
