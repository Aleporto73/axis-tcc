import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA — Google Calendar Status (Multi-Terapeuta)
// Conforme Bible S19: cada terapeuta conecta seu próprio Gmail
//
// Busca calendar_connections pelo profile_id do contexto.
// Qualquer role pode consultar seu próprio status.
// =====================================================

export async function GET() {
  try {
    const result = await withTenant(async (ctx) => {
      const { client, tenantId, profileId } = ctx

      // Buscar conexão pelo profile_id (multi-terapeuta)
      const connResult = await client.query(
        `SELECT id, calendar_id, sync_enabled, token_expiry, created_at,
                webhook_channel_id, webhook_expiration
         FROM calendar_connections
         WHERE tenant_id = $1 AND user_id = $2 AND provider = 'google'`,
        [tenantId, profileId]
      )

      if (connResult.rows.length === 0) {
        return { connected: false }
      }

      const conn = connResult.rows[0]
      const isExpired = new Date(conn.token_expiry) < new Date()
      const webhookActive = conn.webhook_channel_id
        && conn.webhook_expiration
        && new Date(conn.webhook_expiration) > new Date()

      // Buscar último sync
      const syncResult = await client.query(
        `SELECT last_sync_at FROM calendar_sync_state
         WHERE tenant_id = $1 AND user_id = $2 AND provider = 'google'`,
        [tenantId, profileId]
      )

      return {
        connected: true,
        calendar_id: conn.calendar_id,
        sync_enabled: conn.sync_enabled,
        token_expired: isExpired,
        connected_at: conn.created_at,
        last_sync_at: syncResult.rows[0]?.last_sync_at || null,
        webhook_active: !!webhookActive,
        webhook_expiration: conn.webhook_expiration,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
