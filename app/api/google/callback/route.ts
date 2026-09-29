import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as Sentry from '@sentry/nextjs'
import { withTenant, withTenantClient, TenantSelectionRequired } from '@/src/database/with-tenant'
import { env } from '@/src/lib/env'
import {
  GOOGLE_LONG_TIMEOUT_MS,
  GOOGLE_SHORT_TIMEOUT_MS,
  accessTokenStillValid,
  auditConnectRefused,
  connectRefusal,
  findOwnGoogleConnections,
  googleErrorCode,
  googleFetch,
  recordGoogleFailure,
  requestGoogleAccessToken,
  type OwnGoogleConnection,
} from '@/src/services/google-connection'
import { renewGoogleChannel, tccWebhookAddress } from '@/src/services/google-channel'

// =====================================================
// AXIS TCC — Google Calendar OAuth Callback (Entrega 1C-1)
// Também atende a tela do TDAH (mesmas rotas /api/google/*).
//
// 1. Troca o código (fora de transação, com tempo limite).
// 2. Sem permissão da agenda ou sem refresh_token → NÃO grava (audit CONNECT_REFUSED).
//    O token parcial não é revogado: revogar derruba a permissão inteira da conta Google no AXIS.
// 3. Grava na clínica ativa do app (withTenant/cookie), nunca "a primeira que aparecer".
// 4. Cria o canal na hora (função única); o antigo é parado com o token antigo, senão com o novo.
// =====================================================

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || ''
const GOOGLE_REDIRECT_URI = env.GOOGLE_REDIRECT_URI || ''
const BASE_URL = env.NEXT_PUBLIC_APP_URL || 'https://axisclinico.com'

function backToSettings(code: string) {
  return NextResponse.redirect(BASE_URL + '/configuracoes?google=' + code)
}

interface CodeExchange {
  access_token?: unknown
  refresh_token?: unknown
  expires_in?: unknown
  scope?: unknown
}

/** Token da conexão antiga só para parar o canal antigo: renova em memória, sem gravar nada. */
async function previousAccessToken(previous: OwnGoogleConnection | null): Promise<string | null> {
  if (!previous) return null
  if (accessTokenStillValid(previous)) return previous.access_token
  const refreshed = await requestGoogleAccessToken(previous.refresh_token)
  return refreshed.ok ? refreshed.accessToken : null
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      Sentry.captureMessage('[GOOGLE_CALLBACK] OAuth error', { level: 'warning', tags: { oauth_error_code: error } })
      console.error('[GOOGLE_CALLBACK] Erro do Google:', error)
      return backToSettings(error === 'access_denied' ? 'access_denied' : 'error')
    }

    if (!code || !state) {
      return backToSettings('missing_params')
    }

    // Cross-check OAuth state contra auth().userId (Sub 2 Onda 8)
    const { userId } = await auth()
    if (!userId || userId !== state) {
      console.warn('[GOOGLE_CALLBACK] state mismatch:', { hasUserId: !!userId, stateLen: state?.length })
      return backToSettings('state_mismatch')
    }

    // Clínica ativa do app (cookie) + conexão que o profissional já tem (se houver).
    const who = await withTenant(async (ctx) => {
      const own = await findOwnGoogleConnections(ctx.client, ctx.tenantId, ctx.profileId, ctx.userId)
      return { tenantId: ctx.tenantId, profileId: ctx.profileId, clerkUserId: ctx.userId, previous: own[0] ?? null }
    })

    const exchange = await googleFetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      },
      GOOGLE_LONG_TIMEOUT_MS
    )
    const tokens = exchange.body as CodeExchange | null
    if (exchange.status !== 200 || typeof tokens?.access_token !== 'string') {
      await recordGoogleFailure({
        origin: 'callback',
        step: 'token_exchange',
        httpStatus: exchange.status,
        googleCode: googleErrorCode(exchange.body),
        tenantId: who.tenantId,
        connectionId: who.previous?.id ?? null,
        actorUserId: who.clerkUserId,
      })
      return backToSettings('token_error')
    }

    const scope = typeof tokens.scope === 'string' ? tokens.scope : null
    const refusal = connectRefusal(tokens)
    if (refusal) {
      // Nada é gravado: se já havia conexão, ela fica como estava.
      await withTenantClient(who.tenantId, (client) =>
        auditConnectRefused(client, {
          tenantId: who.tenantId,
          clerkUserId: who.clerkUserId,
          profileId: who.profileId,
          product: 'axis_tcc',
          reason: refusal,
          scope,
        })
      )
      return backToSettings('missing_calendar_scope')
    }
    const accessToken = tokens.access_token
    const refreshToken = tokens.refresh_token as string
    const expiresIn = typeof tokens.expires_in === 'number' && tokens.expires_in > 0 ? tokens.expires_in : 3600

    // E-mail da conta Google só para o audit; se o Google não responder, conecta mesmo assim.
    const userInfo = await googleFetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: 'Bearer ' + accessToken } },
      GOOGLE_SHORT_TIMEOUT_MS
    )
    const googleEmail = userInfo.status === 200 ? (userInfo.body as { email?: unknown } | null)?.email ?? null : null

    const saved = await withTenantClient(who.tenantId, async (client) => {
      // Conexão gravada com o id do Clerk (antes de 10/04/2026) passa a ser a do perfil, sem criar uma segunda linha.
      await client.query(
        `UPDATE calendar_connections SET user_id = $3::text, updated_at = NOW()
         WHERE tenant_id = $1 AND provider = 'google' AND user_id = $2::text
           AND NOT EXISTS (
             SELECT 1 FROM calendar_connections WHERE tenant_id = $1 AND provider = 'google' AND user_id = $3::text
           )`,
        [who.tenantId, who.clerkUserId, who.profileId]
      )

      // Não mexe no canal: ele é trocado pela função única, condicionada ao canal que está aqui.
      const upsert = await client.query<{ id: string; webhook_channel_id: string | null; webhook_resource_id: string | null }>(
        `INSERT INTO calendar_connections
          (tenant_id, user_id, provider, calendar_id, access_token, refresh_token, token_expiry, scope, sync_enabled)
        VALUES ($1, $2, 'google', 'primary', $3, $4, $5, $6, true)
        ON CONFLICT (tenant_id, user_id, provider)
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_expiry = EXCLUDED.token_expiry,
          scope = EXCLUDED.scope,
          sync_enabled = true,
          updated_at = NOW()
        RETURNING id, webhook_channel_id, webhook_resource_id`,
        [who.tenantId, who.profileId, accessToken, refreshToken, new Date(Date.now() + expiresIn * 1000), scope]
      )

      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
        VALUES ($1, $2, 'GOOGLE_CALENDAR_CONNECTED', $3)`,
        [who.tenantId, who.clerkUserId, JSON.stringify({ google_email: googleEmail, profile_id: who.profileId, product: 'axis_tcc' })]
      )
      return upsert.rows[0]
    })

    // Fora de transação: canal novo; o antigo é parado com o token antigo, senão com o novo.
    const stopTokens: string[] = []
    if (saved.webhook_channel_id && saved.webhook_resource_id) {
      const oldToken = await previousAccessToken(who.previous)
      if (oldToken) stopTokens.push(oldToken)
    }
    stopTokens.push(accessToken)

    const channel = await renewGoogleChannel({
      tenantId: who.tenantId,
      connectionId: saved.id,
      currentChannelId: saved.webhook_channel_id,
      previous:
        saved.webhook_channel_id && saved.webhook_resource_id
          ? { channelId: saved.webhook_channel_id, resourceId: saved.webhook_resource_id }
          : null,
      accessToken,
      stopTokens,
      address: tccWebhookAddress(),
      origin: 'callback',
      actorUserId: who.clerkUserId,
    })

    return backToSettings(channel.ok ? 'success' : 'connected_no_channel')
  } catch (error) {
    if (error instanceof TenantSelectionRequired) return backToSettings('tenant_error')
    if (error instanceof Error && error.message === 'Tenant não encontrado') return backToSettings('tenant_error')
    Sentry.captureException(error)
    console.error('[GOOGLE_CALLBACK] Erro:', (error as { code?: string } | null)?.code ?? (error as Error)?.message)
    return backToSettings('error')
  }
}
