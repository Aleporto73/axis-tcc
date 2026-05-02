import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { refreshAccessToken } from '@/src/google/calendar-helpers'

// =====================================================
// AXIS ABA — Google Calendar Disconnect (Multi-Terapeuta)
// Conforme Bible S19: Google Calendar Bidirecional
//
// Cada terapeuta desconecta apenas sua própria conta Google.
// Processo: parar webhook → revogar token → limpar BD → audit log.
// =====================================================

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

      // 1. Parar webhook no Google (se existir)
      if (conn.webhook_channel_id && conn.webhook_resource_id) {
        try {
          let accessToken = conn.access_token
          if (new Date(conn.token_expiry) < new Date()) {
            accessToken = await refreshAccessToken(conn.refresh_token) || conn.access_token
          }

          await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + accessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: conn.webhook_channel_id,
              resourceId: conn.webhook_resource_id,
            }),
          })
          console.log('[ABA_DISCONNECT] Webhook parado')
        } catch (e) {
          console.log('[ABA_DISCONNECT] Erro ao parar webhook (ignorado):', e)
        }
      }

      // 2. Revogar token no Google
      try {
        await fetch('https://oauth2.googleapis.com/revoke?token=' + conn.access_token, {
          method: 'POST',
        })
        console.log('[ABA_DISCONNECT] Token revogado')
      } catch (e) {
        console.log('[ABA_DISCONNECT] Erro ao revogar token (ignorado):', e)
      }

      // 3. Deletar sync state
      await client.query(
        `DELETE FROM calendar_sync_state
         WHERE tenant_id = $1 AND user_id = $2 AND provider = 'google'`,
        [tenantId, profileId]
      )

      // 4. Deletar conexão
      await client.query(
        `DELETE FROM calendar_connections
         WHERE tenant_id = $1 AND user_id = $2 AND provider = 'google'`,
        [tenantId, profileId]
      )

      // 5. Audit log — Bible S13.3
      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
         VALUES ($1, $2, 'GOOGLE_CALENDAR_DISCONNECTED', $3)`,
        [
          tenantId,
          userId,
          JSON.stringify({
            product: 'axis_aba',
            profile_id: profileId,
            disconnected_at: new Date().toISOString(),
          }),
        ]
      )

      console.log('[ABA_DISCONNECT] Google Calendar desconectado — profile:', profileId, 'tenant:', tenantId)

      return { success: true, message: 'Google Calendar desconectado' }
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
