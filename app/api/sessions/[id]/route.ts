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
    const result = await pool.query(
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
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
    }
    return NextResponse.json({ session: result.rows[0] })
  } catch (error) {
    console.error('Erro ao buscar sessao:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
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
      'SELECT id FROM sessions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    )
    if (sessionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
    }
    await pool.query(
      'DELETE FROM scheduled_reminders WHERE session_id = $1 AND sent = false',
      [id]
    )
    await pool.query(
      'DELETE FROM sessions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    )
    console.log('[SESSION] Sessao', id, 'deletada com lembretes cancelados')
    return NextResponse.json({ success: true, message: 'Sessao cancelada' })
  } catch (error) {
    console.error('Erro ao deletar sessao:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
