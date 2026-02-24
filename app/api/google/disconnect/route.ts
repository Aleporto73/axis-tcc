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

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) return null
  const data = await response.json()
  return data.access_token
}

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const connResult = await pool.query(
      'SELECT * FROM calendar_connections WHERE tenant_id = $1 AND provider = $2',
      [tenantId, 'google']
    )

    if (connResult.rows.length === 0) {
      return NextResponse.json({ error: 'Google Calendar nao conectado' }, { status: 400 })
    }

    const conn = connResult.rows[0]

    // Parar webhook no Google (se existir)
    if (conn.webhook_channel_id && conn.webhook_resource_id) {
      try {
        let accessToken = conn.access_token
        if (new Date(conn.token_expiry) < new Date()) {
          accessToken = await refreshAccessToken(conn.refresh_token)
        }

        if (accessToken) {
          await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + accessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: conn.webhook_channel_id,
              resourceId: conn.webhook_resource_id,
            }),
          })
          console.log('[DISCONNECT] Webhook parado')
        }
      } catch (e) {
        console.log('[DISCONNECT] Erro ao parar webhook (ignorado):', e)
      }
    }

    // Revogar token no Google
    try {
      await fetch('https://oauth2.googleapis.com/revoke?token=' + conn.access_token, {
        method: 'POST',
      })
      console.log('[DISCONNECT] Token revogado')
    } catch (e) {
      console.log('[DISCONNECT] Erro ao revogar token (ignorado):', e)
    }

    // Deletar sync state
    await pool.query(
      'DELETE FROM calendar_sync_state WHERE tenant_id = $1 AND provider = $2',
      [tenantId, 'google']
    )

    // Deletar conexao
    await pool.query(
      'DELETE FROM calendar_connections WHERE tenant_id = $1 AND provider = $2',
      [tenantId, 'google']
    )

    // Log de auditoria
    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
       VALUES ($1, $2, 'GOOGLE_CALENDAR_DISCONNECTED', $3)`,
      [tenantId, userId, JSON.stringify({ disconnected_at: new Date().toISOString() })]
    )

    console.log('[DISCONNECT] Google Calendar desconectado para tenant:', tenantId)

    return NextResponse.json({ success: true, message: 'Google Calendar desconectado' })
  } catch (error) {
    console.error('[DISCONNECT] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
