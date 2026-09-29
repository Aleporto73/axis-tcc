import type { PoolClient } from 'pg'
import * as Sentry from '@sentry/nextjs'
import { withTenantClient } from '@/src/database/with-tenant'
import { env } from '@/src/lib/env'

// =====================================================
// AXIS — Conexão com o Google Agenda (Entrega 1C-1)
//
// Escopo, estado da conexão, renovação do token, revogação e registro de falha.
// Usado pelas rotas /api/google/* (TCC e tela do TDAH); o callback do ABA usa só o escopo.
// Chamadas ao Google sempre com tempo limite e fora de transação.
// Registro de falha: etapa, status HTTP e código do Google — nunca corpo, mensagem, token ou e-mail.
// =====================================================

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || ''

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
export const GOOGLE_LONG_TIMEOUT_MS = 8000
export const GOOGLE_SHORT_TIMEOUT_MS = 4000
// Access token que vence em menos de 1 min já é renovado antes do uso.
const EXPIRY_MARGIN_MS = 60 * 1000

// calendar.events é o que o AXIS pede; calendar (amplo) também dá acesso aos eventos.
const CALENDAR_SCOPES = new Set([
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar',
])

// ─── Escopo ───

export function hasCalendarScope(scope: string | null | undefined): boolean {
  if (!scope) return false
  return scope.split(/\s+/).some((item) => CALENDAR_SCOPES.has(item))
}

export type ConnectRefusal = 'missing_calendar_scope' | 'missing_refresh_token'

/** Motivo para NÃO gravar a conexão recebida do Google (null = pode gravar). */
export function connectRefusal(tokens: { scope?: unknown; refresh_token?: unknown }): ConnectRefusal | null {
  if (!hasCalendarScope(typeof tokens.scope === 'string' ? tokens.scope : null)) return 'missing_calendar_scope'
  if (typeof tokens.refresh_token !== 'string' || tokens.refresh_token === '') return 'missing_refresh_token'
  return null
}

/** Nomes curtos dos escopos concedidos (ex.: "calendar.events", "openid"), para o audit. */
function scopeNames(scope: string | null | undefined): string[] {
  if (!scope) return []
  return scope
    .split(/\s+/)
    .map((item) => item.replace('https://www.googleapis.com/auth/', ''))
    .filter((item) => /^[A-Za-z0-9._-]{1,64}$/.test(item))
}

export async function auditConnectRefused(
  client: PoolClient,
  input: {
    tenantId: string
    clerkUserId: string
    profileId: string
    product: 'axis_tcc' | 'axis_aba'
    reason: ConnectRefusal
    scope: string | null | undefined
  }
): Promise<void> {
  await client.query(
    `INSERT INTO axis_audit_logs (tenant_id, user_id, action, entity_type, metadata)
     VALUES ($1, $2, 'GOOGLE_CALENDAR_CONNECT_REFUSED', 'calendar_connection', $3)`,
    [
      input.tenantId,
      input.clerkUserId,
      JSON.stringify({
        product: input.product,
        profile_id: input.profileId,
        reason: input.reason,
        granted_scopes: scopeNames(input.scope),
      }),
    ]
  )
}

// ─── Estado da conexão (sem chamar o Google) ───

export type ConnectionState = 'ok' | 'channel_inactive' | 'needs_reconnect'
export type ConnectionReason = 'missing_calendar_scope' | 'access_lost'

export interface ConnectionHealth {
  scope: string | null
  sync_enabled: boolean | null
  webhook_channel_id: string | null
  webhook_expiration: Date | string | null
}

export function channelActive(row: ConnectionHealth, now: Date = new Date()): boolean {
  if (!row.webhook_channel_id || !row.webhook_expiration) return false
  return new Date(row.webhook_expiration).getTime() > now.getTime()
}

/**
 * "Conectado de verdade": escopo da agenda + acesso não perdido (sync_enabled=false só vem de
 * invalid_grant) + canal vivo. O vencimento do access token (1 h) não entra: ele é renovado no uso.
 */
export function connectionState(
  row: ConnectionHealth,
  now: Date = new Date()
): { state: ConnectionState; reason: ConnectionReason | null } {
  if (!hasCalendarScope(row.scope)) return { state: 'needs_reconnect', reason: 'missing_calendar_scope' }
  if (row.sync_enabled === false) return { state: 'needs_reconnect', reason: 'access_lost' }
  if (!channelActive(row, now)) return { state: 'channel_inactive', reason: null }
  return { state: 'ok', reason: null }
}

// ─── Conexões do profissional logado ───

export interface OwnGoogleConnection extends ConnectionHealth {
  id: string
  user_id: string
  calendar_id: string
  access_token: string
  refresh_token: string
  token_expiry: Date | string | null
  created_at: Date | string | null
  webhook_resource_id: string | null
}

/**
 * Conexões Google do profissional logado. user_id é o id do perfil; conexões gravadas antes de
 * 10/04/2026 podem ter o id do Clerk. A primeira da lista (perfil antes, mais recente antes) é a principal.
 */
export async function findOwnGoogleConnections(
  client: PoolClient,
  tenantId: string,
  profileId: string,
  clerkUserId: string
): Promise<OwnGoogleConnection[]> {
  const result = await client.query<OwnGoogleConnection>(
    `SELECT id, user_id, calendar_id, access_token, refresh_token, token_expiry, scope, sync_enabled,
            created_at, webhook_channel_id, webhook_resource_id, webhook_expiration
     FROM calendar_connections
     WHERE tenant_id = $1 AND provider = 'google' AND user_id = ANY($2::text[])
     ORDER BY (user_id = $3::text) DESC, updated_at DESC`,
    [tenantId, [profileId, clerkUserId], profileId]
  )
  return result.rows
}

// ─── Chamada ao Google com tempo limite ───

// 'timeout' = tempo esgotado; 'network' = rede caiu antes da resposta.
export type GoogleHttpStatus = number | 'timeout' | 'network'

export interface GoogleReply {
  status: GoogleHttpStatus
  body: unknown
}

export async function googleFetch(url: string, init: RequestInit, timeoutMs: number): Promise<GoogleReply> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const text = await response.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = null
    }
    return { status: response.status, body }
  } catch {
    return { status: controller.signal.aborted ? 'timeout' : 'network', body: null }
  } finally {
    clearTimeout(timer)
  }
}

const SAFE_CODE = /^[A-Za-z_]{1,64}$/

/** Código de erro do Google: `error` (OAuth) ou `error.errors[0].reason` / `error.status` (Agenda). Nunca a mensagem. */
export function googleErrorCode(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const error = (body as { error?: unknown }).error
  if (typeof error === 'string') return SAFE_CODE.test(error) ? error : null
  if (!error || typeof error !== 'object') return null

  const reason = (error as { errors?: Array<{ reason?: unknown }> }).errors?.[0]?.reason
  if (typeof reason === 'string' && SAFE_CODE.test(reason)) return reason
  const status = (error as { status?: unknown }).status
  if (typeof status === 'string' && SAFE_CODE.test(status)) return status
  return null
}

// ─── Registro único de falha ───

export type GoogleOrigin = 'callback' | 'watch' | 'disconnect' | 'cron'
export type GoogleStep = 'token_exchange' | 'refresh' | 'watch' | 'save' | 'stop_new' | 'stop_old' | 'stop' | 'revoke'

export interface GoogleFailure {
  origin: GoogleOrigin
  step: GoogleStep
  httpStatus: GoogleHttpStatus | null
  googleCode: string | null
  tenantId: string | null
  connectionId: string | null
  actorUserId?: string | null
  // false quando o chamador já grava o resultado no próprio audit (desconectar).
  audit?: boolean
}

/** Log + Sentry + audit (transação própria). Nunca lança. */
export async function recordGoogleFailure(failure: GoogleFailure): Promise<void> {
  const fields = {
    origin: failure.origin,
    step: failure.step,
    http_status: failure.httpStatus,
    google_code: failure.googleCode,
  }
  console.error('[GOOGLE_CONNECTION] Falha', {
    ...fields,
    tenant_id: failure.tenantId,
    connection_id: failure.connectionId,
  })

  try {
    // Nomes de tag fora do filtro de PII (src/lib/sentry-pii.ts): nada com "token" no nome.
    Sentry.captureMessage('Google Agenda: falha na conexão', {
      level: 'warning',
      tags: {
        area: 'google_calendar_connection',
        origin: failure.origin,
        step: failure.step,
        http_status: String(failure.httpStatus ?? 'none'),
        google_code: failure.googleCode ?? 'none',
      },
      extra: { tenant_id: failure.tenantId, connection_id: failure.connectionId },
    })
  } catch {
    // Sentry fora do ar não pode derrubar o fluxo.
  }

  if (failure.audit === false || !failure.tenantId) return
  const tenantId = failure.tenantId
  try {
    await withTenantClient(tenantId, (client) =>
      client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'system', 'GOOGLE_CALENDAR_FAILURE', 'calendar_connection', $3, $4)`,
        [tenantId, failure.actorUserId ?? 'system', failure.connectionId, JSON.stringify(fields)]
      )
    )
  } catch (error) {
    console.error('[GOOGLE_CONNECTION] Audit da falha não gravado', {
      code: (error as { code?: string } | null)?.code,
    })
  }
}

// ─── Token ───

export type TokenRefresh =
  | { ok: true; accessToken: string; expiresAt: Date }
  | { ok: false; httpStatus: GoogleHttpStatus; googleCode: string | null; definitive: boolean }

/** Pede um access token novo ao Google. Só invalid_grant (400) é perda definitiva do acesso. Não grava nada. */
export async function requestGoogleAccessToken(refreshToken: string): Promise<TokenRefresh> {
  const reply = await googleFetch(
    TOKEN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    },
    GOOGLE_SHORT_TIMEOUT_MS
  )

  const body = reply.body as { access_token?: unknown; expires_in?: unknown } | null
  if (reply.status === 200 && typeof body?.access_token === 'string') {
    const seconds = typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : 3600
    return { ok: true, accessToken: body.access_token, expiresAt: new Date(Date.now() + seconds * 1000) }
  }

  const googleCode = googleErrorCode(reply.body)
  return {
    ok: false,
    httpStatus: reply.status,
    googleCode,
    definitive: reply.status === 400 && googleCode === 'invalid_grant',
  }
}

export function accessTokenStillValid(conn: { token_expiry: Date | string | null }): boolean {
  if (!conn.token_expiry) return false
  return new Date(conn.token_expiry).getTime() - EXPIRY_MARGIN_MS > Date.now()
}

export type AccessResult =
  | { ok: true; accessToken: string }
  | { ok: false; httpStatus: GoogleHttpStatus; googleCode: string | null; definitive: boolean }

/**
 * Access token válido da conexão. Renovou → grava (transação curta).
 * invalid_grant → sync_enabled=false (a tela pede reconexão e o cron para de tentar) + registro de falha.
 */
export async function freshAccessToken(
  tenantId: string,
  conn: Pick<OwnGoogleConnection, 'id' | 'access_token' | 'refresh_token' | 'token_expiry'>,
  context: { origin: GoogleOrigin; actorUserId: string | null }
): Promise<AccessResult> {
  if (accessTokenStillValid(conn)) return { ok: true, accessToken: conn.access_token }

  const refreshed = await requestGoogleAccessToken(conn.refresh_token)
  if (refreshed.ok) {
    await withTenantClient(tenantId, (client) =>
      client.query(
        'UPDATE calendar_connections SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
        [refreshed.accessToken, refreshed.expiresAt, conn.id]
      )
    )
    return { ok: true, accessToken: refreshed.accessToken }
  }

  if (refreshed.definitive) {
    await withTenantClient(tenantId, (client) =>
      client.query('UPDATE calendar_connections SET sync_enabled = false, updated_at = NOW() WHERE id = $1', [conn.id])
    )
  }
  await recordGoogleFailure({
    origin: context.origin,
    step: 'refresh',
    httpStatus: refreshed.httpStatus,
    googleCode: refreshed.googleCode,
    tenantId,
    connectionId: conn.id,
    actorUserId: context.actorUserId,
  })
  return refreshed
}

// ─── Revogação ───

export type RevokeResult =
  | { outcome: 'revoked' }
  | { outcome: 'failed'; httpStatus: GoogleHttpStatus; googleCode: string | null }

/** Tira o acesso do AXIS no Google. O token vai no CORPO (nunca na URL). */
export async function revokeGoogleGrant(refreshToken: string): Promise<RevokeResult> {
  const reply = await googleFetch(
    REVOKE_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
    },
    GOOGLE_SHORT_TIMEOUT_MS
  )
  if (reply.status === 200) return { outcome: 'revoked' }
  return { outcome: 'failed', httpStatus: reply.status, googleCode: googleErrorCode(reply.body) }
}
