import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '../guard'
import pool from '@/src/database/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// =====================================================
// GET /api/admin/webhooks?status=error&days=7
// Últimos webhooks recebidos (via audit_logs)
// =====================================================

export async function GET(request: NextRequest) {
  const check = await verifyAdmin()
  if (!check.authorized) return check.response

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const days = parseInt(searchParams.get('days') || '7')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    const conditions = [`a.created_at >= NOW() - INTERVAL '${Math.min(days, 90)} days'`]
    conditions.push(`a.actor IN ('hotmart_webhook', 'clerk_webhook')`)

    if (status === 'error') {
      conditions.push(`a.action LIKE '%FAILED%'`)
    } else if (status === 'success') {
      conditions.push(`a.action NOT LIKE '%FAILED%'`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const res = await pool.query(
      `SELECT
        a.id, a.tenant_id, a.user_id, a.actor, a.action,
        a.entity_type, a.metadata, a.created_at
      FROM axis_audit_logs a
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $1`,
      [limit]
    )

    return NextResponse.json({ webhooks: res.rows, total: res.rows.length })
  } catch (error) {
    console.error('[ADMIN WEBHOOKS]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
