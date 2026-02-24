import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
})

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

function getPatientResponse(attendees: any[], patientEmail: string): string {
  if (!attendees || !patientEmail) return 'needsAction'
  const patient = attendees.find((a: any) => a.email === patientEmail && !a.self)
  if (!patient) return 'needsAction'
  return patient.responseStatus || 'needsAction'
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const connResult = await pool.query(
      'SELECT * FROM calendar_connections WHERE tenant_id = $1 AND provider = $2',
      [tenantId, 'google']
    )
    if (connResult.rows.length === 0) {
      return NextResponse.json({ error: 'Google Calendar nao conectado' }, { status: 400 })
    }

    const conn = connResult.rows[0]
    let accessToken = conn.access_token

    if (new Date(conn.token_expiry) < new Date()) {
      accessToken = await refreshAccessToken(conn.refresh_token)
      if (!accessToken) {
        return NextResponse.json({ error: 'Erro ao renovar token' }, { status: 401 })
      }
      await pool.query(
        'UPDATE calendar_connections SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
        [accessToken, new Date(Date.now() + 3600 * 1000), conn.id]
      )
    }

    const stateResult = await pool.query(
      'SELECT sync_token FROM calendar_sync_state WHERE tenant_id = $1 AND provider = $2',
      [tenantId, 'google']
    )
    const syncToken = stateResult.rows[0]?.sync_token

    let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?'
    if (syncToken) {
      url += 'syncToken=' + syncToken
    } else {
      const timeMin = new Date()
      timeMin.setMonth(timeMin.getMonth() - 1)
      url += 'singleEvents=true&maxResults=50&timeMin=' + timeMin.toISOString()
    }

    const eventsResponse = await fetch(url, {
      headers: { Authorization: 'Bearer ' + accessToken },
    })

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text()
      console.error('[GOOGLE_SYNC] Erro ao buscar eventos:', errorText)
      return NextResponse.json({ error: 'Erro ao buscar eventos' }, { status: 500 })
    }

    const eventsData = await eventsResponse.json()
    const events = eventsData.items || []
    let imported = 0
    let updated = 0
    let skipped = 0

    for (const event of events) {
      if (!event.start?.dateTime || !event.end?.dateTime) {
        skipped++
        continue
      }

      let patientId = null
      let patientEmail = null
      if (event.attendees && event.attendees.length > 0) {
        for (const attendee of event.attendees) {
          if (attendee.email && !attendee.self) {
            const patientResult = await pool.query(
              'SELECT id FROM patients WHERE tenant_id = $1 AND email = $2',
              [tenantId, attendee.email]
            )
            if (patientResult.rows.length > 0) {
              patientId = patientResult.rows[0].id
              patientEmail = attendee.email
              break
            }
          }
        }
      }

      const meetLink = event.hangoutLink || null
      const patientResponse = getPatientResponse(event.attendees, patientEmail)

      const existingSession = await pool.query(
        'SELECT id, external_etag FROM sessions WHERE tenant_id = $1 AND google_event_id = $2',
        [tenantId, event.id]
      )

      if (existingSession.rows.length > 0) {
        if (existingSession.rows[0].external_etag !== event.etag) {
          await pool.query(
            `UPDATE sessions SET 
              scheduled_at = $1, 
              duration_minutes = $2,
              status = $3,
              external_etag = $4,
              external_updated_at = $5,
              google_meet_link = $6,
              patient_response = $7
            WHERE id = $8`,
            [
              event.start.dateTime,
              Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 60000),
              event.status === 'cancelled' ? 'cancelada' : 'agendada',
              event.etag,
              event.updated,
              meetLink,
              patientResponse,
              existingSession.rows[0].id
            ]
          )
          updated++
        }
      } else if (patientId && event.status !== 'cancelled') {
        const sessionNumberResult = await pool.query(
          'SELECT COALESCE(MAX(session_number), 0) + 1 as next FROM sessions WHERE patient_id = $1',
          [patientId]
        )
        const nextSessionNumber = sessionNumberResult.rows[0].next

        await pool.query(
          `INSERT INTO sessions 
            (tenant_id, patient_id, session_number, scheduled_at, duration_minutes, status, 
             google_event_id, google_calendar_id, calendar_source, external_etag, external_updated_at, google_meet_link, patient_response)
          VALUES ($1, $2, $3, $4, $5, 'agendada', $6, 'primary', 'google', $7, $8, $9, $10)`,
          [
            tenantId,
            patientId,
            nextSessionNumber,
            event.start.dateTime,
            Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 60000),
            event.id,
            event.etag,
            event.updated,
            meetLink,
            patientResponse
          ]
        )
        imported++
      } else {
        skipped++
      }
    }

    if (eventsData.nextSyncToken) {
      await pool.query(
        `INSERT INTO calendar_sync_state (tenant_id, user_id, provider, calendar_id, sync_token, last_sync_at)
        VALUES ($1, $2, 'google', 'primary', $3, NOW())
        ON CONFLICT (tenant_id, user_id, provider, calendar_id)
        DO UPDATE SET sync_token = $3, last_sync_at = NOW()`,
        [tenantId, userId, eventsData.nextSyncToken]
      )
    }

    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
      VALUES ($1, $2, 'CALENDAR_SYNC_RUN', $3)`,
      [tenantId, userId, JSON.stringify({ imported, updated, skipped, total: events.length })]
    )

    return NextResponse.json({ 
      success: true, 
      imported, 
      updated, 
      skipped,
      total: events.length 
    })
  } catch (error) {
    console.error('[GOOGLE_SYNC] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
