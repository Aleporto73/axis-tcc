import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

export async function GET(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      const connResult = await ctx.client.query(
        'SELECT id, calendar_id, sync_enabled, token_expiry, created_at, webhook_channel_id, webhook_expiration FROM calendar_connections WHERE tenant_id = $1 AND provider = $2',
        [ctx.tenantId, 'google']
      )

      if (connResult.rows.length === 0) {
        return NextResponse.json({ connected: false })
      }

      const conn = connResult.rows[0]
      const isExpired = new Date(conn.token_expiry) < new Date()
      const webhookActive = conn.webhook_channel_id && conn.webhook_expiration && new Date(conn.webhook_expiration) > new Date()

      const syncResult = await ctx.client.query(
        'SELECT last_sync_at FROM calendar_sync_state WHERE tenant_id = $1 AND provider = $2',
        [ctx.tenantId, 'google']
      )

      return NextResponse.json({
        connected: true,
        calendar_id: conn.calendar_id,
        sync_enabled: conn.sync_enabled,
        token_expired: isExpired,
        connected_at: conn.created_at,
        last_sync_at: syncResult.rows[0]?.last_sync_at || null,
        webhook_active: webhookActive,
        webhook_expiration: conn.webhook_expiration
      })
    })
  } catch (error) {
    console.error('[GOOGLE_STATUS] Erro:', error)
    const { message, status } = handleRouteError(error)
    if (status === 401 || status === 409) {
      return NextResponse.json({ error: message }, { status })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
