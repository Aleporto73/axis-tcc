import { createHmac, randomBytes, randomUUID } from 'crypto'
import { withTenantClient } from '@/src/database/with-tenant'
import { env } from '@/src/lib/env'
import {
  GOOGLE_LONG_TIMEOUT_MS,
  GOOGLE_SHORT_TIMEOUT_MS,
  googleErrorCode,
  googleFetch,
  recordGoogleFailure,
  type GoogleHttpStatus,
  type GoogleOrigin,
} from '@/src/services/google-connection'

// =====================================================
// AXIS — Canal de avisos do Google Agenda (Entrega 1C-1)
//
// Função única para criar/trocar o canal: callback e rota watch agora; cron na 1C-2.
// Ordem: cria o novo → grava canal + segredo num UPDATE só (se o canal no banco ainda
// for o que lemos) → só então para o antigo. Nunca fica sem canal por causa da troca.
// =====================================================

const WATCH_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch'
const STOP_URL = 'https://www.googleapis.com/calendar/v3/channels/stop'
const CHANNEL_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Endereço do webhook do TCC (também recebe as conexões feitas pela tela do TDAH). */
export function tccWebhookAddress(): string {
  return (env.NEXT_PUBLIC_APP_URL || 'https://axisclinico.com') + '/api/google/webhook'
}

export interface ChannelRef {
  channelId: string
  resourceId: string
}

export type StopOutcome = 'stopped' | 'already_gone' | 'failed'

export async function stopGoogleChannel(
  accessToken: string,
  channel: ChannelRef
): Promise<{ outcome: StopOutcome; httpStatus: GoogleHttpStatus; googleCode: string | null }> {
  const reply = await googleFetch(
    STOP_URL,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: channel.channelId, resourceId: channel.resourceId }),
    },
    GOOGLE_SHORT_TIMEOUT_MS
  )
  if (typeof reply.status === 'number' && reply.status >= 200 && reply.status < 300) {
    return { outcome: 'stopped', httpStatus: reply.status, googleCode: null }
  }
  // 404: o canal já não existe (venceu ou foi parado) — é o resultado que queríamos.
  if (reply.status === 404) return { outcome: 'already_gone', httpStatus: 404, googleCode: googleErrorCode(reply.body) }
  return { outcome: 'failed', httpStatus: reply.status, googleCode: googleErrorCode(reply.body) }
}

export interface RenewChannelInput {
  tenantId: string
  connectionId: string
  // Canal gravado no banco agora: o UPDATE só vale se ele ainda for este (null = sem canal).
  currentChannelId: string | null
  // Canal a parar depois de gravar o novo (precisa do resourceId).
  previous: ChannelRef | null
  accessToken: string
  // Tokens para parar o canal antigo, em ordem (reconectar: o antigo, depois o novo).
  stopTokens: string[]
  address: string
  origin: GoogleOrigin
  actorUserId: string | null
}

export type RenewChannelResult =
  | { ok: true; channelId: string; expiration: Date; previousStop: StopOutcome | 'none' }
  | { ok: false; step: 'watch' | 'save'; httpStatus: GoogleHttpStatus | null; googleCode: string | null }

export async function renewGoogleChannel(input: RenewChannelInput): Promise<RenewChannelResult> {
  const failure = {
    origin: input.origin,
    tenantId: input.tenantId,
    connectionId: input.connectionId,
    actorUserId: input.actorUserId,
  }

  // 1. Canal novo, com segredo próprio: o Google devolve HMAC(segredo, id) em cada aviso.
  const channelId = randomUUID()
  const secret = randomBytes(32).toString('hex')
  const channelToken = createHmac('sha256', secret).update(channelId).digest('hex')

  const reply = await googleFetch(
    WATCH_URL,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + input.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: input.address,
        expiration: Date.now() + CHANNEL_TTL_MS,
        token: channelToken,
      }),
    },
    GOOGLE_LONG_TIMEOUT_MS
  )
  const created = reply.body as { resourceId?: unknown; expiration?: unknown } | null
  if (reply.status !== 200 || typeof created?.resourceId !== 'string') {
    const googleCode = googleErrorCode(reply.body)
    await recordGoogleFailure({ ...failure, step: 'watch', httpStatus: reply.status, googleCode })
    return { ok: false, step: 'watch', httpStatus: reply.status, googleCode }
  }
  const newChannel: ChannelRef = { channelId, resourceId: created.resourceId }
  const expiration = new Date(Number(created.expiration) || Date.now() + CHANNEL_TTL_MS)

  // 2. Canal + segredo num UPDATE só, condicionado ao canal que lemos (outro processo pode ter trocado).
  let saved = false
  try {
    saved = await withTenantClient(input.tenantId, async (client) => {
      const result = await client.query(
        `UPDATE calendar_connections
         SET webhook_channel_id = $1, webhook_resource_id = $2, webhook_expiration = $3, webhook_token = $4, updated_at = NOW()
         WHERE id = $5 AND webhook_channel_id IS NOT DISTINCT FROM $6::text
         RETURNING id`,
        [channelId, newChannel.resourceId, expiration, secret, input.connectionId, input.currentChannelId]
      )
      if ((result.rowCount ?? 0) === 0) return false

      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, $3, 'GOOGLE_WEBHOOK_REGISTERED', 'calendar_connection', $4, $5)`,
        [
          input.tenantId,
          input.actorUserId ?? 'system',
          input.actorUserId ? 'human' : 'system',
          input.connectionId,
          JSON.stringify({
            origin: input.origin,
            channel_id: channelId,
            expiration: expiration.toISOString(),
            replaced_previous: input.currentChannelId !== null,
          }),
        ]
      )
      return true
    })
  } catch (error) {
    console.error('[GOOGLE_CHANNEL] Erro ao gravar o canal', { code: (error as { code?: string } | null)?.code })
    saved = false
  }

  if (!saved) {
    // O canal recém-criado não pode ficar solto no Google.
    const stopped = await stopGoogleChannel(input.accessToken, newChannel)
    if (stopped.outcome === 'failed') {
      await recordGoogleFailure({ ...failure, step: 'stop_new', httpStatus: stopped.httpStatus, googleCode: stopped.googleCode })
    }
    await recordGoogleFailure({ ...failure, step: 'save', httpStatus: null, googleCode: null })
    return { ok: false, step: 'save', httpStatus: null, googleCode: null }
  }

  // 3. Só agora para o canal antigo; falha aqui não desfaz o novo (o antigo vence sozinho em até 7 dias).
  let previousStop: StopOutcome | 'none' = 'none'
  if (input.previous) {
    let last: { httpStatus: GoogleHttpStatus | null; googleCode: string | null } = { httpStatus: null, googleCode: null }
    previousStop = 'failed'
    for (const token of input.stopTokens) {
      const stopped = await stopGoogleChannel(token, input.previous)
      if (stopped.outcome !== 'failed') {
        previousStop = stopped.outcome
        break
      }
      last = { httpStatus: stopped.httpStatus, googleCode: stopped.googleCode }
    }
    if (previousStop === 'failed') await recordGoogleFailure({ ...failure, step: 'stop_old', ...last })
  }

  return { ok: true, channelId, expiration, previousStop }
}
