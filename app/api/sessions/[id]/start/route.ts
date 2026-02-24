import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const sessionCheck = await pool.query(
      'SELECT id, status FROM sessions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    )
    if (sessionCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
    }
    if (sessionCheck.rows[0].status !== 'agendada') {
      return NextResponse.json({ error: 'Sessao ja foi iniciada ou finalizada' }, { status: 400 })
    }

    const result = await pool.query(
      `UPDATE sessions 
       SET status = 'em_andamento', started_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, patient_id, session_number, scheduled_at, started_at, status`,
      [id, tenantId]
    )

    // Audit log - SESSION_START
    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'human', 'SESSION_START', 'session', $3, $4)`,
      [tenantId, userId, result.rows[0].id, JSON.stringify({ session_number: result.rows[0].session_number })]
    )

    return NextResponse.json({
      success: true,
      session: result.rows[0]
    })
  } catch (error) {
    console.error('Erro ao iniciar sessao:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
