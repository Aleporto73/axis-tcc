import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { channelActive, connectionState, findOwnGoogleConnections } from '@/src/services/google-connection'

// =====================================================
// AXIS TCC — Status do Google Calendar (Entrega 1C-1)
// Só a conexão do profissional logado; nunca chama o Google.
// state: ok | channel_inactive | needs_reconnect (reason: missing_calendar_scope | access_lost).
// A tela do TDAH usa esta rota e lê connected/token_expired: token_expired agora quer dizer
// "precisa reconectar" e, nesse caso, connected=false — "Conectado" e "Token expirado" nunca juntos.
// =====================================================

export async function GET() {
  try {
    return await withTenant(async (ctx) => {
      const own = await findOwnGoogleConnections(ctx.client, ctx.tenantId, ctx.profileId, ctx.userId)
      const conn = own[0]
      if (!conn) {
        return NextResponse.json({ connected: false })
      }

      const { state, reason } = connectionState(conn)

      // A sync manual grava com o id do Clerk; o webhook, com o id do perfil.
      const syncResult = await ctx.client.query(
        `SELECT MAX(last_sync_at) AS last_sync_at FROM calendar_sync_state
         WHERE tenant_id = $1 AND provider = 'google' AND user_id = ANY($2::text[])`,
        [ctx.tenantId, [ctx.profileId, ctx.userId]]
      )

      return NextResponse.json({
        connected: state !== 'needs_reconnect',
        state,
        reason,
        calendar_id: conn.calendar_id,
        sync_enabled: conn.sync_enabled,
        token_expired: state === 'needs_reconnect',
        connected_at: conn.created_at,
        last_sync_at: syncResult.rows[0]?.last_sync_at ?? null,
        webhook_active: channelActive(conn),
        webhook_expiration: conn.webhook_expiration,
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
