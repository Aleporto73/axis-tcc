import { NextRequest, NextResponse } from 'next/server'
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
const WEBHOOK_URL = 'https://axistcc.com/api/google/webhook'

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

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const expiringSoon = new Date()
    expiringSoon.setDate(expiringSoon.getDate() + 1)

    const connsResult = await pool.query(
      `SELECT * FROM calendar_connections 
       WHERE provider = 'google' 
       AND sync_enabled = true
       AND (webhook_expiration IS NULL OR webhook_expiration < $1)`,
      [expiringSoon]
    )

    let renewed = 0
    let failed = 0

    for (const conn of connsResult.rows) {
      try {
        let accessToken = conn.access_token

        if (new Date(conn.token_expiry) < new Date()) {
          accessToken = await refreshAccessToken(conn.refresh_token)
          if (!accessToken) {
            failed++
            continue
          }
          await pool.query(
            'UPDATE calendar_connections SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
            [accessToken, new Date(Date.now() + 3600 * 1000), conn.id]
          )
        }

        if (conn.webhook_channel_id && conn.webhook_resource_id) {
          try {
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
          } catch (e) {
            console.log('[RENEW] Erro ao parar canal antigo:', e)
          }
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

        if (watchResponse.ok) {
          const watchData = await watchResponse.json()
          await pool.query(
            `UPDATE calendar_connections 
             SET webhook_channel_id = $1, webhook_resource_id = $2, webhook_expiration = $3, updated_at = NOW()
             WHERE id = $4`,
            [watchData.id, watchData.resourceId, new Date(parseInt(watchData.expiration)), conn.id]
          )
          renewed++
        } else {
          failed++
        }
      } catch (e) {
        console.error('[RENEW] Erro:', e)
        failed++
      }
    }

    console.log('[RENEW-WEBHOOK] Renovados:', renewed, 'Falhas:', failed)

    return NextResponse.json({ success: true, renewed, failed })
  } catch (error) {
    console.error('[RENEW-WEBHOOK] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
