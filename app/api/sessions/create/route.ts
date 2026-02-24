import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'
import { scheduleSessionReminders } from '@/src/services/reminder'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

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
  tenantId: string,
  patientName: string,
  patientEmail: string | null,
  scheduledAt: Date,
  durationMinutes: number = 60
): Promise<{ eventId: string; meetLink: string | null } | null> {
  try {
    const connResult = await pool.query(
      'SELECT * FROM calendar_connections WHERE tenant_id = $1 AND provider = $2',
      [tenantId, 'google']
    )
    if (connResult.rows.length === 0) return null

    const conn = connResult.rows[0]
    let accessToken = conn.access_token

    if (new Date(conn.token_expiry) < new Date()) {
      accessToken = await refreshAccessToken(conn.refresh_token)
      if (!accessToken) return null
      await pool.query(
        'UPDATE calendar_connections SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
        [accessToken, new Date(Date.now() + 3600 * 1000), conn.id]
      )
    }

    const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000)

    const event: any = {
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
    console.log('[GOOGLE_CREATE] Evento criado:', createdEvent.id)

    return {
      eventId: createdEvent.id,
      meetLink: createdEvent.hangoutLink || null,
    }
  } catch (error) {
    console.error('[GOOGLE_CREATE] Erro:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const body = await request.json()
    const { patient_id, session_type = 'presencial', scheduled_at, start_now = true } = body

    if (!patient_id) {
      return NextResponse.json({ error: 'Paciente obrigatorio' }, { status: 400 })
    }

    const patientResult = await pool.query(
      'SELECT full_name, email FROM patients WHERE id = $1 AND tenant_id = $2',
      [patient_id, tenantId]
    )
    if (patientResult.rows.length === 0) {
      return NextResponse.json({ error: 'Paciente nao encontrado' }, { status: 404 })
    }
    const patientName = patientResult.rows[0].full_name
    const patientEmail = patientResult.rows[0].email

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM sessions WHERE patient_id = $1',
      [patient_id]
    )
    const sessionNumber = parseInt(countResult.rows[0].total) + 1

    let result
    let googleEventId = null
    let googleMeetLink = null

    if (start_now) {
      result = await pool.query(
        `INSERT INTO sessions (tenant_id, patient_id, session_type, session_number, scheduled_at, started_at, status, time_source)
         VALUES ($1, $2, $3, $4, NOW(), NOW(), 'em_andamento', 'manual')
         RETURNING id, patient_id, session_number, scheduled_at, started_at, status`,
        [tenantId, patient_id, session_type, sessionNumber]
      )
    } else {
      if (!scheduled_at) {
        return NextResponse.json({ error: 'Data de agendamento obrigatoria' }, { status: 400 })
      }

      const googleEvent = await createGoogleCalendarEvent(
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

      result = await pool.query(
        `INSERT INTO sessions (tenant_id, patient_id, session_type, session_number, scheduled_at, started_at, status, time_source, google_event_id, google_calendar_id, calendar_source, google_meet_link)
         VALUES ($1, $2, $3, $4, $5, NULL, 'agendada', 'manual', $6, 'primary', $7, $8)
         RETURNING id, patient_id, session_number, scheduled_at, started_at, status, google_meet_link`,
        [tenantId, patient_id, session_type, sessionNumber, scheduled_at, googleEventId, googleEventId ? 'google' : null, googleMeetLink]
      )

      const remindersScheduled = await scheduleSessionReminders({
        tenant_id: tenantId,
        session_id: result.rows[0].id,
        patient_id,
        scheduled_at: new Date(scheduled_at),
        patient_name: patientName
      })
      if (!remindersScheduled) {
        console.log('[SESSION] Paciente', patient_id, 'nao autorizou push - sem lembretes')
      }
    }

    return NextResponse.json({
      success: true,
      session: result.rows[0],
      google_synced: !!googleEventId
    }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar sessao:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
