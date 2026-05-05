import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { env } from '@/src/lib/env'

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || ''

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
          }
        } catch (e) {
        }
      }

      // Revogar token no Google
      try {
        await fetch('https://oauth2.googleapis.com/revoke?token=' + conn.access_token, {
          method: 'POST',
        })
      } catch (e) {
      }

      // Deletar sync state
      await ctx.client.query(
        'DELETE FROM calendar_sync_state WHERE tenant_id = $1 AND provider = $2',
        [ctx.tenantId, 'google']
      )

      // Deletar conexao
      await ctx.client.query(
        'DELETE FROM calendar_connections WHERE tenant_id = $1 AND provider = $2',
        [ctx.tenantId, 'google']
      )

      // Log de auditoria
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
         VALUES ($1, $2, 'GOOGLE_CALENDAR_DISCONNECTED', $3)`,
        [ctx.tenantId, ctx.userId, JSON.stringify({ disconnected_at: new Date().toISOString() })]
      )

      return NextResponse.json({ success: true, message: 'Google Calendar desconectado' })
    })
  } catch (error) {
    console.error('[DISCONNECT] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
