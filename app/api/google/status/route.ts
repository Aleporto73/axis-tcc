import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
})

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ connected: false })
    }
    const tenantId = tenantResult.rows[0].id

    const connResult = await pool.query(
      'SELECT id, calendar_id, sync_enabled, token_expiry, created_at, webhook_channel_id, webhook_expiration FROM calendar_connections WHERE tenant_id = $1 AND provider = $2',
      [tenantId, 'google']
    )

    if (connResult.rows.length === 0) {
      return NextResponse.json({ connected: false })
    }

    const conn = connResult.rows[0]
    const isExpired = new Date(conn.token_expiry) < new Date()
    const webhookActive = conn.webhook_channel_id && conn.webhook_expiration && new Date(conn.webhook_expiration) > new Date()

    const syncResult = await pool.query(
      'SELECT last_sync_at FROM calendar_sync_state WHERE tenant_id = $1 AND provider = $2',
      [tenantId, 'google']
    )

    return NextResponse.json({
      connected: true,
      calendar_id: conn.calendar_id,
      sync_enabled: conn.sync_enabled,
      token_expired: isExpired,
      connected_at: conn.created_at,
      last_sync_at: syncResult.rows[0]?.last_sync_at || null,
      webhook_active: webhookActive,
      webhook_expiration: conn.webhook_expiration
    })
  } catch (error) {
    console.error('[GOOGLE_STATUS] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
