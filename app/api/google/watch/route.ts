import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { connectionState, findOwnGoogleConnections, freshAccessToken } from '@/src/services/google-connection'
import { renewGoogleChannel, tccWebhookAddress } from '@/src/services/google-channel'

// =====================================================
// AXIS TCC — Ativar/Reativar o canal de avisos do Google (Entrega 1C-1)
// Botão "Reativar" da tela. Conexão do profissional logado; função única de canal.
// Nunca devolve o corpo da resposta do Google ao navegador.
// =====================================================

export async function POST() {
  try {
    const found = await withTenant(async (ctx) => {
      const own = await findOwnGoogleConnections(ctx.client, ctx.tenantId, ctx.profileId, ctx.userId)
      return { tenantId: ctx.tenantId, clerkUserId: ctx.userId, conn: own[0] ?? null }
    })

    const conn = found.conn
    if (!conn) {
      return NextResponse.json({ error: 'Google Calendar nao conectado' }, { status: 400 })
    }

    const health = connectionState(conn)
    if (health.state === 'needs_reconnect') {
      return NextResponse.json({ error: 'Reconecte o Google Calendar', reason: health.reason }, { status: 409 })
    }

    // Fora de transação: token (grava se renovar; invalid_grant marca acesso perdido) e canal.
    const access = await freshAccessToken(found.tenantId, conn, { origin: 'watch', actorUserId: found.clerkUserId })
    if (!access.ok) {
      if (access.definitive) {
        return NextResponse.json({ error: 'Reconecte o Google Calendar', reason: 'access_lost' }, { status: 409 })
      }
      return NextResponse.json({ error: 'O Google não respondeu. Tente de novo em alguns minutos.' }, { status: 502 })
    }

    const channel = await renewGoogleChannel({
      tenantId: found.tenantId,
      connectionId: conn.id,
      currentChannelId: conn.webhook_channel_id,
      previous:
        conn.webhook_channel_id && conn.webhook_resource_id
          ? { channelId: conn.webhook_channel_id, resourceId: conn.webhook_resource_id }
          : null,
      accessToken: access.accessToken,
      stopTokens: [access.accessToken],
      address: tccWebhookAddress(),
      origin: 'watch',
      actorUserId: found.clerkUserId,
    })

    if (!channel.ok) {
      return NextResponse.json(
        { error: 'Não foi possível ativar a atualização automática agora.', step: channel.step },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, expiration: channel.expiration.toISOString() })
  } catch (error) {
    console.error('[WATCH] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
