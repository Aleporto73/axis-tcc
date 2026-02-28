import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
})

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const WEBHOOK_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://axisclinico.com') + '/api/google/webhook'

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
    let accessToken = conn.access_token

    if (new Date(conn.token_expiry) < new Date()) {
      accessToken = await refreshAccessToken(conn.refresh_token)
      if (!accessToken) {
        return NextResponse.json({ error: 'Erro ao renovar token' }, { status: 401 })
      }
      await pool.query(
        'UPDATE calendar_connections SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
        [accessToken, new Date(Date.now() + 3600 * 1000), conn.id]
      )
    }

    const channelId = randomUUID()
    const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000

    const watchResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: WEBHOOK_URL,
          expiration: expiration,
        }),
      }
    )

    if (!watchResponse.ok) {
      const errorData = await watchResponse.text()
      console.error('[WATCH] Erro ao registrar:', errorData)
      return NextResponse.json({ error: 'Erro ao registrar webhook', details: errorData }, { status: 500 })
    }

    const watchData = await watchResponse.json()

    await pool.query(
      `UPDATE calendar_connections 
       SET webhook_channel_id = $1, webhook_resource_id = $2, webhook_expiration = $3, updated_at = NOW()
       WHERE id = $4`,
      [watchData.id, watchData.resourceId, new Date(parseInt(watchData.expiration)), conn.id]
    )

    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
       VALUES ($1, $2, 'GOOGLE_WEBHOOK_REGISTERED', $3)`,
      [tenantId, userId, JSON.stringify({ channel_id: watchData.id, expiration: watchData.expiration })]
    )

    return NextResponse.json({
      success: true,
      channel_id: watchData.id,
      expiration: new Date(parseInt(watchData.expiration)).toISOString()
    })
  } catch (error) {
    console.error('[WATCH] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
