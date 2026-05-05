import { NextRequest, NextResponse } from 'next/server'
import { randomUUID, randomBytes, createHmac } from 'crypto'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { env } from '@/src/lib/env'

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || ''
const WEBHOOK_URL = (env.NEXT_PUBLIC_APP_URL || 'https://axisclinico.com') + '/api/google/webhook'

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
    return await withTenant(async (ctx) => {
      const connResult = await ctx.client.query(
        'SELECT * FROM calendar_connections WHERE tenant_id = $1 AND provider = $2',
        [ctx.tenantId, 'google']
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
        await ctx.client.query(
          'UPDATE calendar_connections SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
          [accessToken, new Date(Date.now() + 3600 * 1000), conn.id]
        )
      }

      const channelId = randomUUID()
      const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000

      // Auditoria ABA P0: gerar token secreto para validação HMAC no webhook
      const webhookSecret = randomBytes(32).toString('hex')
      const channelToken = createHmac('sha256', webhookSecret).update(channelId).digest('hex')

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
            token: channelToken,
          }),
        }
      )

      if (!watchResponse.ok) {
        const errorData = await watchResponse.text()
        console.error('[WATCH] Erro ao registrar:', errorData)
        return NextResponse.json({ error: 'Erro ao registrar webhook', details: errorData }, { status: 500 })
      }

      const watchData = await watchResponse.json()

      await ctx.client.query(
        `UPDATE calendar_connections
         SET webhook_channel_id = $1, webhook_resource_id = $2, webhook_expiration = $3, webhook_token = $4, updated_at = NOW()
         WHERE id = $5`,
        [watchData.id, watchData.resourceId, new Date(parseInt(watchData.expiration)), webhookSecret, conn.id]
      )

      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
         VALUES ($1, $2, 'GOOGLE_WEBHOOK_REGISTERED', $3)`,
        [ctx.tenantId, ctx.userId, JSON.stringify({ channel_id: watchData.id, expiration: watchData.expiration })]
      )

      return NextResponse.json({
        success: true,
        channel_id: watchData.id,
        expiration: new Date(parseInt(watchData.expiration)).toISOString()
      })
    })
  } catch (error) {
    console.error('[WATCH] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
