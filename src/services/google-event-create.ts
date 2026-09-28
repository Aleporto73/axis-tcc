import type { PoolClient } from 'pg'
import { withTenantClient } from '@/src/database/with-tenant'
import { env } from '@/src/lib/env'
import type { GoogleCalendarEvent } from '@/src/services/google-event-apply'

// =====================================================
// AXIS TCC — Evento do Google para uma sessão já gravada (Entrega 1B)
//
// A sessão é gravada ANTES (commit); só depois o evento é criado no Google,
// fora de transação, com id derivado da sessão e a marca axis_session_id.
// Se o aviso do Google chegar antes do vínculo, o webhook reconhece a marca
// e VINCULA em vez de inserir. Falha do Google nunca desfaz a sessão.
// =====================================================

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || ''

const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
export const GOOGLE_INSERT_TIMEOUT_MS = 8000
export const GOOGLE_LOOKUP_TIMEOUT_MS = 4000

const SESSION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Formato do id de evento que o AXIS TCC cria: "tcc" + uuid da sessão sem hífens (base32hex válido).
export const TCC_EVENT_ID_PATTERN = /^tcc([0-9a-f]{32})$/

export interface GoogleConnection {
  id: string
  access_token: string
  refresh_token: string
  token_expiry: string | Date
}

export interface SessionEventInput {
  sessionId: string
  patientName: string
  patientEmail: string | null
  scheduledAt: Date
  durationMinutes: number
}

/** Id do evento no Google para a sessão: só a–v e 0–9 (base32hex), 35 caracteres. */
export function googleEventIdForSession(sessionId: string): string {
  if (!SESSION_UUID.test(sessionId)) throw new Error('id de sessão fora do formato uuid')
  return 'tcc' + sessionId.replace(/-/g, '').toLowerCase()
}

/** Sessão do AXIS a que o evento pertence: pela marca, senão pelo formato do id. */
export function axisSessionIdFromEvent(event: GoogleCalendarEvent): string | null {
  const marked = event.extendedProperties?.private?.axis_session_id
  if (marked && SESSION_UUID.test(marked)) return marked.toLowerCase()

  const hex = TCC_EVENT_ID_PATTERN.exec(event.id)?.[1]
  if (!hex) return null
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Grava o vínculo sessão ↔ evento, em qualquer status, só se a sessão ainda não tem vínculo.
 * Nunca mexe em status nem horário (regra 1.1 fica com applyGoogleEvent).
 */
export async function linkSessionToGoogleEvent(
  client: PoolClient,
  tenantId: string,
  sessionId: string,
  event: GoogleCalendarEvent
): Promise<boolean> {
  // Evento já cancelado: vincula sem etag, para o aviso do cancelamento não ser tomado como eco (1.2).
  const etag = event.status === 'cancelled' ? null : event.etag ?? null
  const result = await client.query(
    `UPDATE sessions SET
       google_event_id = $1,
       google_calendar_id = 'primary',
       calendar_source = 'google',
       google_meet_link = $2,
       external_etag = $3,
       external_updated_at = $4
     WHERE tenant_id = $5 AND id = $6 AND google_event_id IS NULL
     RETURNING id`,
    [event.id, event.hangoutLink || null, etag, event.updated ?? null, tenantId, sessionId]
  )
  return (result.rowCount ?? 0) > 0
}

// ─── Chamadas ao Google (sempre com tempo limite) ───

// status 'uncertain': tempo esgotado ou rede caiu, não dá para saber se o Google gravou.
type GoogleReply = { status: number | 'uncertain'; body: unknown }

async function googleRequest(url: string, init: RequestInit, timeoutMs: number): Promise<GoogleReply> {
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
    return { status: 'uncertain', body: null }
  } finally {
    clearTimeout(timer)
  }
}

function logGoogleFailure(step: string, sessionId: string, status: number | 'uncertain' | 'not_found' | 'refused') {
  // Sem corpo de resposta do Google: ele pode trazer e-mail do paciente.
  console.error('[GOOGLE_CREATE] Falha', { step, status, session_id: sessionId })
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const reply = await googleRequest(
    'https://oauth2.googleapis.com/token',
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
    GOOGLE_LOOKUP_TIMEOUT_MS
  )
  if (reply.status !== 200) return null
  return (reply.body as { access_token?: string } | null)?.access_token ?? null
}

/** Token válido; se precisou renovar, grava em transação própria e curta. */
export async function googleAccessToken(tenantId: string, conn: GoogleConnection): Promise<string | null> {
  if (new Date(conn.token_expiry) >= new Date()) return conn.access_token

  const accessToken = await refreshAccessToken(conn.refresh_token)
  if (!accessToken) return null
  await withTenantClient(tenantId, (client) =>
    client.query(
      'UPDATE calendar_connections SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
      [accessToken, new Date(Date.now() + 3600 * 1000), conn.id]
    )
  )
  return accessToken
}

type LookupResult = { found: GoogleCalendarEvent } | 'not_found' | 'unknown'

async function getSessionEvent(accessToken: string, eventId: string): Promise<LookupResult> {
  const reply = await googleRequest(
    `${EVENTS_URL}/${eventId}`,
    { headers: { Authorization: 'Bearer ' + accessToken } },
    GOOGLE_LOOKUP_TIMEOUT_MS
  )
  // Evento apagado continua existindo (status cancelled) e também vale para vincular.
  if (reply.status === 200) return { found: reply.body as GoogleCalendarEvent }
  if (reply.status === 404 || reply.status === 410) return 'not_found'
  return 'unknown'
}

/**
 * Cria o evento da sessão. Em tempo esgotado, 409 (id já existe) ou 5xx, confere com events.get:
 * o Google não garante recusar id repetido, então só o get diz se o evento existe.
 */
export async function createSessionGoogleEvent(
  accessToken: string,
  input: SessionEventInput
): Promise<GoogleCalendarEvent | null> {
  const eventId = googleEventIdForSession(input.sessionId)
  const endTime = new Date(input.scheduledAt.getTime() + input.durationMinutes * 60 * 1000)

  const event: Record<string, unknown> = {
    id: eventId,
    summary: `Sessao - ${input.patientName}`,
    start: { dateTime: input.scheduledAt.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: endTime.toISOString(), timeZone: 'America/Sao_Paulo' },
    extendedProperties: { private: { axis_session_id: input.sessionId } },
    conferenceData: {
      createRequest: {
        requestId: eventId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  }
  if (input.patientEmail) {
    event.attendees = [{ email: input.patientEmail }]
  }

  const reply = await googleRequest(
    `${EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    },
    GOOGLE_INSERT_TIMEOUT_MS
  )
  if (reply.status === 200) return reply.body as GoogleCalendarEvent

  const uncertain = reply.status === 'uncertain' || reply.status === 409 || reply.status >= 500
  if (!uncertain) {
    logGoogleFailure('insert', input.sessionId, reply.status)
    return null
  }

  const lookup = await getSessionEvent(accessToken, eventId)
  if (typeof lookup === 'object') return lookup.found
  logGoogleFailure(`insert(${reply.status})+get`, input.sessionId, lookup === 'not_found' ? 'not_found' : 'uncertain')
  return null
}

/**
 * Garante o evento da sessão: procura primeiro (events.get), só cria se não existir.
 * Reutilizável (ex.: futuro botão "Enviar ao Google").
 */
export async function ensureSessionGoogleEvent(
  accessToken: string,
  input: SessionEventInput
): Promise<GoogleCalendarEvent | null> {
  const lookup = await getSessionEvent(accessToken, googleEventIdForSession(input.sessionId))
  if (typeof lookup === 'object') return lookup.found
  if (lookup === 'unknown') {
    logGoogleFailure('get', input.sessionId, 'uncertain')
    return null
  }
  return createSessionGoogleEvent(accessToken, input)
}

/**
 * Pós-commit da sessão agendada: token → evento → transação curta de vínculo.
 * Nunca lança: qualquer falha deixa a sessão sem vínculo e devolve synced=false.
 */
export async function pushNewSessionToGoogle(
  tenantId: string,
  conn: GoogleConnection,
  input: SessionEventInput
): Promise<{ synced: boolean; meetLink: string | null }> {
  try {
    const accessToken = await googleAccessToken(tenantId, conn)
    if (!accessToken) {
      logGoogleFailure('token', input.sessionId, 'refused')
      return { synced: false, meetLink: null }
    }

    const event = await createSessionGoogleEvent(accessToken, input)
    if (!event) return { synced: false, meetLink: null }

    return await withTenantClient(tenantId, async (client) => {
      if (await linkSessionToGoogleEvent(client, tenantId, input.sessionId, event)) {
        return { synced: true, meetLink: event.hangoutLink || null }
      }
      // O aviso do Google chegou antes e o webhook já vinculou.
      const current = await client.query(
        'SELECT google_event_id, google_meet_link FROM sessions WHERE tenant_id = $1 AND id = $2',
        [tenantId, input.sessionId]
      )
      const row = current.rows[0]
      return { synced: row?.google_event_id === event.id, meetLink: row?.google_meet_link ?? null }
    })
  } catch (error) {
    console.error('[GOOGLE_CREATE] Erro inesperado', {
      session_id: input.sessionId,
      code: (error as { code?: string } | null)?.code,
    })
    return { synced: false, meetLink: null }
  }
}
