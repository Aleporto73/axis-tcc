import type { PoolClient } from 'pg'
import * as Sentry from '@sentry/nextjs'
import { withTenantClient } from '@/src/database/with-tenant'
import { nextSessionNumber } from '@/src/services/session-number'
import { deletePendingSessionReminders } from '@/src/services/reminder'
import { axisSessionIdFromEvent, linkSessionToGoogleEvent } from '@/src/services/google-event-create'

// =====================================================
// AXIS TCC — Regra única "aplicar evento do Google na sessão"
// Usada pelo webhook (/api/google/webhook) e pelo sync manual (/api/google/sync).
// =====================================================

export interface GoogleCalendarEvent {
  id: string
  status?: string
  etag?: string
  updated?: string
  hangoutLink?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: Array<{ email?: string; self?: boolean; responseStatus?: string }>
  extendedProperties?: { private?: Record<string, string> }
}

export type GoogleEventOutcome = 'imported' | 'updated' | 'cancelled' | 'linked' | 'skipped'

export interface GoogleEventsSummary {
  imported: number
  updated: number
  cancelled: number
  linked: number
  skipped: number
  failed: number
}

interface SessionRow {
  id: string
  status: string
  external_etag: string | null
}

// 40P01 = deadlock_detected, 55P03 = lock_not_available
const LOCK_FAILURE_CODES = new Set(['40P01', '55P03'])

function getPatientResponse(
  attendees: GoogleCalendarEvent['attendees'],
  patientEmail: string | null
): string {
  if (!attendees || !patientEmail) return 'needsAction'
  const patient = attendees.find((a) => a.email === patientEmail && !a.self)
  return patient?.responseStatus || 'needsAction'
}

function durationMinutes(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
}

async function findSessionsByEvent(
  client: PoolClient,
  tenantId: string,
  googleEventId: string
): Promise<SessionRow[]> {
  const result = await client.query<SessionRow>(
    'SELECT id, status, external_etag FROM sessions WHERE tenant_id = $1 AND google_event_id = $2',
    [tenantId, googleEventId]
  )
  return result.rows
}

// Só sessão 'agendada' pode mudar pelo Google; etag igual é eco do próprio AXIS.
function changeableSessionIds(rows: SessionRow[], etag: string | undefined): string[] {
  return rows
    .filter((row) => row.status === 'agendada' && (!etag || row.external_etag !== etag))
    .map((row) => row.id)
}

async function findPatientByAttendee(
  client: PoolClient,
  tenantId: string,
  attendees: GoogleCalendarEvent['attendees']
): Promise<{ id: string; email: string } | null> {
  for (const attendee of attendees ?? []) {
    if (!attendee.email || attendee.self) continue
    const result = await client.query(
      'SELECT id FROM patients WHERE tenant_id = $1 AND email = $2',
      [tenantId, attendee.email]
    )
    if (result.rows.length > 0) return { id: result.rows[0].id, email: attendee.email }
  }
  return null
}

type AxisLink = 'not_axis' | 'linked_now' | 'already_linked' | 'missing'

// Evento criado pelo AXIS (marca ou id "tcc…"): vincula a sessão do mesmo tenant que ainda não tem vínculo.
async function linkAxisSession(client: PoolClient, tenantId: string, event: GoogleCalendarEvent): Promise<AxisLink> {
  const sessionId = axisSessionIdFromEvent(event)
  if (!sessionId) return 'not_axis'
  if (await linkSessionToGoogleEvent(client, tenantId, sessionId, event)) return 'linked_now'

  const exists = await client.query('SELECT 1 FROM sessions WHERE tenant_id = $1 AND id = $2', [tenantId, sessionId])
  return exists.rows.length > 0 ? 'already_linked' : 'missing'
}

async function cancelFromGoogle(
  client: PoolClient,
  tenantId: string,
  event: GoogleCalendarEvent,
  echoEtag: string | undefined
): Promise<GoogleEventOutcome> {
  const ids = changeableSessionIds(await findSessionsByEvent(client, tenantId, event.id), echoEtag)
  if (ids.length === 0) return 'skipped'

  const result = await client.query<{ id: string }>(
    `UPDATE sessions SET
       status = 'cancelada',
       external_etag = COALESCE($1, external_etag),
       external_updated_at = COALESCE($2, external_updated_at)
     WHERE tenant_id = $3 AND id = ANY($4::uuid[]) AND status = 'agendada'
     RETURNING id`,
    [event.etag ?? null, event.updated ?? null, tenantId, ids]
  )

  for (const row of result.rows) {
    await deletePendingSessionReminders(client, tenantId, row.id)
  }
  return result.rows.length > 0 ? 'cancelled' : 'skipped'
}

/**
 * Aplica UM evento do Google nas sessões do tenant. Exige transação com app.tenant_id.
 */
export async function applyGoogleEvent(
  client: PoolClient,
  tenantId: string,
  event: GoogleCalendarEvent
): Promise<GoogleEventOutcome> {
  // 1B: evento do AXIS nunca vira INSERT; sessão marcada inexistente (ou de outro tenant) é pulada.
  const link = await linkAxisSession(client, tenantId, event)
  if (link === 'missing') return 'skipped'
  const outcome = await applyToSessions(client, tenantId, event, link === 'linked_now')
  return link === 'linked_now' && outcome === 'skipped' ? 'linked' : outcome
}

async function applyToSessions(
  client: PoolClient,
  tenantId: string,
  event: GoogleCalendarEvent,
  linkedNow: boolean
): Promise<GoogleEventOutcome> {
  // Recém-vinculada: o etag acabou de ser gravado pelo vínculo, então a regra normal roda sem o filtro de eco.
  const echoEtag = linkedNow ? undefined : event.etag

  // Evento cancelado/apagado costuma chegar sem horário: tratar antes de olhar o horário.
  if (event.status === 'cancelled') return cancelFromGoogle(client, tenantId, event, echoEtag)

  const start = event.start?.dateTime
  const end = event.end?.dateTime
  if (!start || !end) return 'skipped'

  const existing = await findSessionsByEvent(client, tenantId, event.id)

  if (existing.length > 0) {
    const ids = changeableSessionIds(existing, echoEtag)
    if (ids.length === 0) return 'skipped'

    const patient = await findPatientByAttendee(client, tenantId, event.attendees)
    const result = await client.query(
      `UPDATE sessions SET
         scheduled_at = $1,
         duration_minutes = $2,
         external_etag = $3,
         external_updated_at = $4,
         google_meet_link = $5,
         patient_response = $6
       WHERE tenant_id = $7 AND id = ANY($8::uuid[]) AND status = 'agendada'`,
      [
        start,
        durationMinutes(start, end),
        event.etag ?? null,
        event.updated ?? null,
        event.hangoutLink || null,
        getPatientResponse(event.attendees, patient?.email ?? null),
        tenantId,
        ids,
      ]
    )
    return (result.rowCount ?? 0) > 0 ? 'updated' : 'skipped'
  }

  const patient = await findPatientByAttendee(client, tenantId, event.attendees)
  if (!patient) return 'skipped'

  const sessionNumber = await nextSessionNumber(client, tenantId, patient.id)

  // Reconferir depois da trava: outro webhook/sync pode ter importado este evento enquanto esperávamos.
  const alreadyImported = await client.query(
    'SELECT 1 FROM sessions WHERE tenant_id = $1 AND google_event_id = $2 LIMIT 1',
    [tenantId, event.id]
  )
  if (alreadyImported.rows.length > 0) return 'skipped'

  await client.query(
    `INSERT INTO sessions
       (tenant_id, patient_id, session_number, scheduled_at, duration_minutes, status,
        google_event_id, google_calendar_id, calendar_source, external_etag, external_updated_at, google_meet_link, patient_response)
     VALUES ($1, $2, $3, $4, $5, 'agendada', $6, 'primary', 'google', $7, $8, $9, $10)`,
    [
      tenantId,
      patient.id,
      sessionNumber,
      start,
      durationMinutes(start, end),
      event.id,
      event.etag ?? null,
      event.updated ?? null,
      event.hangoutLink || null,
      getPatientResponse(event.attendees, patient.email),
    ]
  )
  return 'imported'
}

/**
 * Aplica uma lista de eventos, uma transação por evento.
 * Falha de trava vai para o Sentry e o laço segue; o chamador não deve avançar o syncToken se failed > 0.
 */
export async function applyGoogleEvents(
  tenantId: string,
  events: GoogleCalendarEvent[],
  origin: 'webhook' | 'sync'
): Promise<GoogleEventsSummary> {
  const summary: GoogleEventsSummary = { imported: 0, updated: 0, cancelled: 0, linked: 0, skipped: 0, failed: 0 }

  for (const event of events) {
    try {
      const outcome = await withTenantClient(tenantId, (client) => applyGoogleEvent(client, tenantId, event))
      summary[outcome]++
    } catch (error) {
      const code = (error as { code?: string } | null)?.code
      if (!code || !LOCK_FAILURE_CODES.has(code)) throw error

      summary.failed++
      console.error('[GOOGLE_EVENT_APPLY] Falha de trava ao aplicar evento', { origin, code, tenantId })
      // Erro novo, sem a mensagem original do Postgres: nenhum dado de paciente vai para o Sentry.
      Sentry.captureException(new Error(`Google Agenda: falha de trava ao aplicar evento (${code})`), {
        tags: { area: 'google_calendar_sync', origin, pg_code: code },
        extra: { tenant_id: tenantId, google_event_id: event.id },
      })
    }
  }

  return summary
}
