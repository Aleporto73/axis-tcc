import { NextRequest, NextResponse } from 'next/server'
import { PoolClient } from 'pg'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { scheduleSessionReminders } from '@/src/services/reminder'
import { nextSessionNumber } from '@/src/services/session-number'
import { env } from '@/src/lib/env'

// =====================================================
// AXIS TCC — Criar Sessão
// Migration: withTenant (Auditoria TCC P0)
// =====================================================

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || ''

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) return null
  const data = await response.json()
  return data.access_token
}

async function createGoogleCalendarEvent(
  client: PoolClient,
  tenantId: string,
  patientName: string,
  patientEmail: string | null,
  scheduledAt: Date,
  durationMinutes: number = 60
): Promise<{ eventId: string; meetLink: string | null; etag: string | null; updated: string | null } | null> {
  try {
    const connResult = await client.query(
      'SELECT * FROM calendar_connections WHERE tenant_id = $1 AND provider = $2',
      [tenantId, 'google']
    )
    if (connResult.rows.length === 0) return null

    const conn = connResult.rows[0]
    let accessToken = conn.access_token

    if (new Date(conn.token_expiry) < new Date()) {
      accessToken = await refreshAccessToken(conn.refresh_token)
      if (!accessToken) return null
      await client.query(
        'UPDATE calendar_connections SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
        [accessToken, new Date(Date.now() + 3600 * 1000), conn.id]
      )
    }

    const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000)

    const event: Record<string, unknown> = {
      summary: `Sessao - ${patientName}`,
      start: {
        dateTime: scheduledAt.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      conferenceData: {
        createRequest: {
          requestId: `axis-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }

    if (patientEmail) {
      event.attendees = [{ email: patientEmail }]
    }

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GOOGLE_CREATE] Erro ao criar evento:', errorText)
      return null
    }

    const createdEvent = await response.json()

    return {
      eventId: createdEvent.id,
      meetLink: createdEvent.hangoutLink || null,
      etag: createdEvent.etag || null,
      updated: createdEvent.updated || null,
    }
  } catch (error) {
    console.error('[GOOGLE_CREATE] Erro:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_id, session_type = 'presencial', scheduled_at, start_now = true } = body

    if (!patient_id) {
      return NextResponse.json({ error: 'Paciente obrigatorio' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      const patientResult = await client.query(
        'SELECT full_name, email FROM patients WHERE id = $1 AND tenant_id = $2',
        [patient_id, tenantId]
      )
      if (patientResult.rows.length === 0) {
        const err = new Error('Paciente nao encontrado') as any
        err.statusCode = 404
        throw err
      }
      const patientName = patientResult.rows[0].full_name
      const patientEmail = patientResult.rows[0].email

      let sessionResult
      let googleEventId = null
      let googleMeetLink = null

      if (start_now) {
        const sessionNumber = await nextSessionNumber(client, tenantId, patient_id)
        sessionResult = await client.query(
          `INSERT INTO sessions (tenant_id, patient_id, session_type, session_number, scheduled_at, started_at, status, time_source)
           VALUES ($1, $2, $3, $4, NOW(), NOW(), 'em_andamento', 'manual')
           RETURNING id, patient_id, session_number, scheduled_at, started_at, status`,
          [tenantId, patient_id, session_type, sessionNumber]
        )
      } else {
        if (!scheduled_at) {
          const err = new Error('Data de agendamento obrigatoria') as any
          err.statusCode = 400
          throw err
        }

        const googleEvent = await createGoogleCalendarEvent(
          ctx.client,
          tenantId,
          patientName,
          patientEmail,
          new Date(scheduled_at),
          60
        )

        if (googleEvent) {
          googleEventId = googleEvent.eventId
          googleMeetLink = googleEvent.meetLink
        }

        const sessionNumber = await nextSessionNumber(client, tenantId, patient_id)
        sessionResult = await client.query(
          `INSERT INTO sessions (tenant_id, patient_id, session_type, session_number, scheduled_at, started_at, status, time_source, google_event_id, google_calendar_id, calendar_source, google_meet_link, external_etag, external_updated_at)
           VALUES ($1, $2, $3, $4, $5, NULL, 'agendada', 'manual', $6, 'primary', $7, $8, $9, $10)
           RETURNING id, patient_id, session_number, scheduled_at, started_at, status, google_meet_link`,
          [tenantId, patient_id, session_type, sessionNumber, scheduled_at, googleEventId, googleEventId ? 'google' : null, googleMeetLink, googleEvent?.etag ?? null, googleEvent?.updated ?? null]
        )

        await scheduleSessionReminders({
          tenant_id: tenantId,
          session_id: sessionResult.rows[0].id,
          patient_id,
          scheduled_at: new Date(scheduled_at),
          patient_name: patientName
        }, client)
      }

      return { session: sessionResult.rows[0], google_synced: !!googleEventId }
    })

    return NextResponse.json({
      success: true,
      session: result.session,
      google_synced: result.google_synced
    }, { status: 201 })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
