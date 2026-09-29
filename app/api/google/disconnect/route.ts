import { NextResponse } from 'next/server'
import { withTenant, withTenantClient } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import {
  accessTokenStillValid,
  findOwnGoogleConnections,
  recordGoogleFailure,
  requestGoogleAccessToken,
  revokeGoogleGrant,
  type GoogleHttpStatus,
  type OwnGoogleConnection,
} from '@/src/services/google-connection'
import { stopGoogleChannel } from '@/src/services/google-channel'

// =====================================================
// AXIS TCC — Desconectar o Google Calendar (Entrega 1C-1)
// Só a conexão do profissional logado (colegas e terapeutas ABA do tenant ficam).
// Google primeiro (para o canal, revoga com o refresh token no CORPO), depois apaga + audit
// com o resultado. Falha no Google não impede apagar.
// =====================================================

interface GoogleRelease {
  connection_id: string
  stop: 'stopped' | 'already_gone' | 'failed' | 'no_channel' | 'no_token'
  stop_http_status: GoogleHttpStatus | null
  stop_google_code: string | null
  revoke: 'revoked' | 'failed'
  revoke_http_status: GoogleHttpStatus | null
  revoke_google_code: string | null
}

async function releaseGoogleAccess(tenantId: string, conn: OwnGoogleConnection, clerkUserId: string): Promise<GoogleRelease> {
  const failure = { origin: 'disconnect' as const, tenantId, connectionId: conn.id, actorUserId: clerkUserId, audit: false }
  const release: GoogleRelease = {
    connection_id: conn.id,
    stop: 'no_channel',
    stop_http_status: null,
    stop_google_code: null,
    revoke: 'revoked',
    revoke_http_status: null,
    revoke_google_code: null,
  }

  if (conn.webhook_channel_id && conn.webhook_resource_id) {
    // Renova só em memória: a linha vai ser apagada.
    let accessToken: string | null = accessTokenStillValid(conn) ? conn.access_token : null
    if (!accessToken) {
      const refreshed = await requestGoogleAccessToken(conn.refresh_token)
      if (refreshed.ok) {
        accessToken = refreshed.accessToken
      } else {
        await recordGoogleFailure({ ...failure, step: 'refresh', httpStatus: refreshed.httpStatus, googleCode: refreshed.googleCode })
        Object.assign(release, { stop: 'no_token', stop_http_status: refreshed.httpStatus, stop_google_code: refreshed.googleCode })
      }
    }
    if (accessToken) {
      const stopped = await stopGoogleChannel(accessToken, {
        channelId: conn.webhook_channel_id,
        resourceId: conn.webhook_resource_id,
      })
      Object.assign(release, { stop: stopped.outcome, stop_http_status: stopped.httpStatus, stop_google_code: stopped.googleCode })
      if (stopped.outcome === 'failed') {
        await recordGoogleFailure({ ...failure, step: 'stop', httpStatus: stopped.httpStatus, googleCode: stopped.googleCode })
      }
    }
  }

  const revoked = await revokeGoogleGrant(conn.refresh_token)
  if (revoked.outcome === 'failed') {
    Object.assign(release, { revoke: 'failed', revoke_http_status: revoked.httpStatus, revoke_google_code: revoked.googleCode })
    await recordGoogleFailure({ ...failure, step: 'revoke', httpStatus: revoked.httpStatus, googleCode: revoked.googleCode })
  }
  return release
}

export async function POST() {
  try {
    const found = await withTenant(async (ctx) => ({
      tenantId: ctx.tenantId,
      profileId: ctx.profileId,
      clerkUserId: ctx.userId,
      own: await findOwnGoogleConnections(ctx.client, ctx.tenantId, ctx.profileId, ctx.userId),
    }))

    if (found.own.length === 0) {
      return NextResponse.json({ error: 'Google Calendar nao conectado' }, { status: 400 })
    }

    // Fora de transação, com tempo limite.
    const releases: GoogleRelease[] = []
    for (const conn of found.own) {
      releases.push(await releaseGoogleAccess(found.tenantId, conn, found.clerkUserId))
    }

    await withTenantClient(found.tenantId, async (client) => {
      // A sync manual grava o sync_state com o id do Clerk; o webhook, com o id do perfil.
      await client.query(
        `DELETE FROM calendar_sync_state
         WHERE tenant_id = $1 AND provider = 'google' AND user_id = ANY($2::text[])`,
        [found.tenantId, [found.profileId, found.clerkUserId]]
      )
      await client.query(
        `DELETE FROM calendar_connections
         WHERE tenant_id = $1 AND provider = 'google' AND id = ANY($2::uuid[])`,
        [found.tenantId, found.own.map((conn) => conn.id)]
      )
      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, action, entity_type, metadata)
         VALUES ($1, $2, 'GOOGLE_CALENDAR_DISCONNECTED', 'calendar_connection', $3)`,
        [
          found.tenantId,
          found.clerkUserId,
          JSON.stringify({
            product: 'axis_tcc',
            profile_id: found.profileId,
            disconnected_at: new Date().toISOString(),
            connections: releases,
          }),
        ]
      )
    })

    return NextResponse.json({
      success: true,
      message: 'Google Calendar desconectado',
      google_revoked: releases.every((release) => release.revoke === 'revoked'),
    })
  } catch (error) {
    console.error('[DISCONNECT] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
