import { NextRequest, NextResponse } from 'next/server'
import { withTenant, withTenantClient } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { env } from '@/src/lib/env'
import { applyGoogleEvents } from '@/src/services/google-event-apply'

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

type SyncAccess =
  | { error: NextResponse }
  | { tenantId: string; userId: string; accessToken: string; syncToken: string | undefined }

export async function POST(request: NextRequest) {
  try {
    const access = await withTenant<SyncAccess>(async (ctx) => {
      const connResult = await ctx.client.query(
        'SELECT * FROM calendar_connections WHERE tenant_id = $1 AND provider = $2',
        [ctx.tenantId, 'google']
      )
      if (connResult.rows.length === 0) {
        return { error: NextResponse.json({ error: 'Google Calendar nao conectado' }, { status: 400 }) }
      }

      const conn = connResult.rows[0]
      let accessToken = conn.access_token

      if (new Date(conn.token_expiry) < new Date()) {
        accessToken = await refreshAccessToken(conn.refresh_token)
        if (!accessToken) {
          return { error: NextResponse.json({ error: 'Erro ao renovar token' }, { status: 401 }) }
        }
        await ctx.client.query(
          'UPDATE calendar_connections SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
          [accessToken, new Date(Date.now() + 3600 * 1000), conn.id]
        )
      }

      const stateResult = await ctx.client.query(
        'SELECT sync_token FROM calendar_sync_state WHERE tenant_id = $1 AND provider = $2',
        [ctx.tenantId, 'google']
      )
      return {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        accessToken: accessToken as string,
        syncToken: stateResult.rows[0]?.sync_token as string | undefined,
      }
    })
    if ('error' in access) return access.error

    let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?'
    if (access.syncToken) {
      url += 'syncToken=' + access.syncToken
    } else {
      const timeMin = new Date()
      timeMin.setMonth(timeMin.getMonth() - 1)
      url += 'singleEvents=true&maxResults=50&timeMin=' + timeMin.toISOString()
    }

    const eventsResponse = await fetch(url, {
      headers: { Authorization: 'Bearer ' + access.accessToken },
    })

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text()
      console.error('[GOOGLE_SYNC] Erro ao buscar eventos:', errorText)
      return NextResponse.json({ error: 'Erro ao buscar eventos' }, { status: 500 })
    }

    const eventsData = await eventsResponse.json()
    const events = eventsData.items || []
    const summary = await applyGoogleEvents(access.tenantId, events, 'sync')

    await withTenantClient(access.tenantId, async (client) => {
      // Com falha de trava o syncToken não avança: a próxima sincronização reprocessa (idempotente).
      if (eventsData.nextSyncToken && summary.failed === 0) {
        await client.query(
          `INSERT INTO calendar_sync_state (tenant_id, user_id, provider, calendar_id, sync_token, last_sync_at)
          VALUES ($1, $2, 'google', 'primary', $3, NOW())
          ON CONFLICT (tenant_id, user_id, provider, calendar_id)
          DO UPDATE SET sync_token = $3, last_sync_at = NOW()`,
          [access.tenantId, access.userId, eventsData.nextSyncToken]
        )
      }

      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
        VALUES ($1, $2, 'CALENDAR_SYNC_RUN', $3)`,
        [access.tenantId, access.userId, JSON.stringify({ ...summary, total: events.length })]
      )
    })

    return NextResponse.json({
      success: true,
      ...summary,
      total: events.length
    })
  } catch (error) {
    console.error('[GOOGLE_SYNC] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
