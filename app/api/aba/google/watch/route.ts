import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { ensureValidToken } from '@/src/google/calendar-helpers'
import { randomUUID } from 'crypto'

// =====================================================
// AXIS ABA — Google Calendar Webhook Registration
// Conforme Bible S19: Google Calendar Bidirecional
//   "Google → AXIS: Sincronizar via webhook"
//
// Multi-terapeuta: cada profile tem seu próprio webhook.
// Webhook expira em 7 dias → renovado pelo cron job.
// =====================================================

const WEBHOOK_URL = process.env.GOOGLE_WEBHOOK_URL_ABA
  || (process.env.NEXT_PUBLIC_APP_URL || 'https://axistcc.com') + '/api/aba/google/webhook'

export async function POST() {
  try {
    const result = await withTenant(async (ctx) => {
      const { client, tenantId, userId, profileId } = ctx

      const connResult = await client.query(
        `SELECT * FROM calendar_connections
         WHERE tenant_id = $1 AND user_id = $2 AND provider = 'google'`,
        [tenantId, profileId]
      )

      if (connResult.rows.length === 0) {
        return { error: 'Google Calendar não conectado', code: 400 }
      }

      const conn = connResult.rows[0]
      const accessToken = await ensureValidToken(client, conn)
      if (!accessToken) {
        return { error: 'Erro ao renovar token Google', code: 401 }
      }

      // Registrar webhook no Google Calendar
      const channelId = randomUUID()
      const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 dias

      const watchResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + accessToken,
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
        console.error('[ABA_WATCH] Erro ao registrar:', errorData)
        return { error: 'Erro ao registrar webhook', details: errorData, code: 500 }
      }

      const watchData = await watchResponse.json()
      console.log('[ABA_WATCH] Registrado:', watchData)

      // Salvar dados do webhook
      await client.query(
        `UPDATE calendar_connections
         SET webhook_channel_id = $1, webhook_resource_id = $2,
             webhook_expiration = $3, updated_at = NOW()
         WHERE id = $4`,
        [watchData.id, watchData.resourceId, new Date(parseInt(watchData.expiration)), conn.id]
      )

      // Audit log — Bible S13.3
      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
         VALUES ($1, $2, 'GOOGLE_WEBHOOK_REGISTERED', $3)`,
        [
          tenantId,
          userId,
          JSON.stringify({
            product: 'axis_aba',
            profile_id: profileId,
            channel_id: watchData.id,
            expiration: watchData.expiration,
          }),
        ]
      )

      return {
        success: true,
        channel_id: watchData.id,
        expiration: new Date(parseInt(watchData.expiration)).toISOString(),
      }
    })

    if ('error' in result) {
      return NextResponse.json(
        { error: (result as any).error },
        { status: (result as any).code || 500 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
