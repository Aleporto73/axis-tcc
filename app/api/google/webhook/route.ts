import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import pool from '@/src/database/db'
import { withTenantClient } from '@/src/database/with-tenant'
import { env } from '@/src/lib/env'
import { applyGoogleEvents } from '@/src/services/google-event-apply'

// Pool: shared (Auditoria TCC P0 — unified pool)
// Segurança (Auditoria ABA P0): webhook_token + resource_id verification

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

async function syncCalendarForTenant(tenantId: string, userId: string) {
  const access = await withTenantClient(tenantId, async (client) => {
    const connResult = await client.query(
      'SELECT * FROM calendar_connections WHERE tenant_id = $1 AND provider = $2',
      [tenantId, 'google']
    )
    if (connResult.rows.length === 0) return null

    const conn = connResult.rows[0]
    let accessToken = conn.access_token

    if (new Date(conn.token_expiry) < new Date()) {
      accessToken = await refreshAccessToken(conn.refresh_token)
      if (!accessToken) return null
      await client.query(
        'UPDATE calendar_connections SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
        [accessToken, new Date(Date.now() + 3600 * 1000), conn.id]
      )
    }

    const stateResult = await client.query(
      'SELECT sync_token FROM calendar_sync_state WHERE tenant_id = $1 AND provider = $2',
      [tenantId, 'google']
    )
    return { accessToken: accessToken as string, syncToken: stateResult.rows[0]?.sync_token as string | undefined }
  })
  if (!access) return

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
    console.error('[WEBHOOK] Erro ao buscar eventos:', errorText)
    return
  }

  const eventsData = await eventsResponse.json()
  const summary = await applyGoogleEvents(tenantId, eventsData.items || [], 'webhook')

  // Com falha de trava o syncToken não avança: o próximo aviso reprocessa os mesmos eventos (idempotente).
  if (eventsData.nextSyncToken && summary.failed === 0) {
    await withTenantClient(tenantId, async (client) => {
      await client.query(
        `INSERT INTO calendar_sync_state (tenant_id, user_id, provider, calendar_id, sync_token, last_sync_at)
        VALUES ($1, $2, 'google', 'primary', $3, NOW())
        ON CONFLICT (tenant_id, user_id, provider, calendar_id)
        DO UPDATE SET sync_token = $3, last_sync_at = NOW()`,
        [tenantId, userId, eventsData.nextSyncToken]
      )
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const channelId = request.headers.get('x-goog-channel-id')
    const resourceId = request.headers.get('x-goog-resource-id')
    const resourceState = request.headers.get('x-goog-resource-state')
    const channelToken = request.headers.get('x-goog-channel-token')

    if (resourceState === 'sync') {
      return NextResponse.json({ status: 'sync acknowledged' })
    }

    if (!channelId || !resourceId) {
      return NextResponse.json({ error: 'Missing required headers' }, { status: 400 })
    }

    // Auditoria ABA P0: validar channel_id + resource_id + token.
    // Lookup via SECURITY DEFINER (migration 072) — rota publica, sem
    // tenant previo; funciona sem GUC mesmo com RLS forced em
    // calendar_connections (F7 passo 5). Mismatch = 0 rows = 404.
    const connResult = await pool.query(
      'SELECT tenant_id, user_id, webhook_token FROM calendar_webhook_lookup($1, $2)',
      [channelId, resourceId]
    )

    if (connResult.rows.length === 0) {
      console.warn('[WEBHOOK] Channel/resource mismatch:', { channelId, resourceId: resourceId?.slice(0, 8) })
      return NextResponse.json({ status: 'channel not found' }, { status: 404 })
    }

    const conn = connResult.rows[0]

    // Verificar token HMAC se disponível (novo setup)
    if (conn.webhook_token && channelToken) {
      const expectedToken = crypto
        .createHmac('sha256', conn.webhook_token)
        .update(channelId)
        .digest('hex')
      if (!crypto.timingSafeEqual(Buffer.from(channelToken), Buffer.from(expectedToken))) {
        console.warn('[WEBHOOK] Token mismatch para channel:', channelId)
        return NextResponse.json({ status: 'invalid token' }, { status: 403 })
      }
    }

    await syncCalendarForTenant(conn.tenant_id, conn.user_id)

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[WEBHOOK] Erro:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
