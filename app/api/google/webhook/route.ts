import { NextRequest, NextResponse } from 'next/server'
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

async function syncCalendarForTenant(tenantId: string, userId: string) {
  const connResult = await pool.query(
    'SELECT * FROM calendar_connections WHERE tenant_id = $1 AND provider = $2',
    [tenantId, 'google']
  )
  if (connResult.rows.length === 0) return

  const conn = connResult.rows[0]
  let accessToken = conn.access_token

  if (new Date(conn.token_expiry) < new Date()) {
    accessToken = await refreshAccessToken(conn.refresh_token)
    if (!accessToken) return
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
    console.error('[WEBHOOK] Erro ao buscar eventos:', errorText)
    return
  }

  const eventsData = await eventsResponse.json()
  const events = eventsData.items || []
  let imported = 0, updated = 0

  for (const event of events) {
    if (!event.start?.dateTime || !event.end?.dateTime) continue

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

  console.log('[WEBHOOK] Sync concluido:', { tenantId, imported, updated })
}

export async function POST(request: NextRequest) {
  try {
    const channelId = request.headers.get('x-goog-channel-id')
    const resourceState = request.headers.get('x-goog-resource-state')
    
    console.log('[WEBHOOK] Recebido:', { channelId, resourceState })

    if (resourceState === 'sync') {
      return NextResponse.json({ status: 'sync acknowledged' })
    }

    if (!channelId) {
      return NextResponse.json({ error: 'Missing channel ID' }, { status: 400 })
    }

    const connResult = await pool.query(
      'SELECT tenant_id, user_id FROM calendar_connections WHERE webhook_channel_id = $1',
      [channelId]
    )

    if (connResult.rows.length === 0) {
      console.log('[WEBHOOK] Canal nao encontrado:', channelId)
      return NextResponse.json({ status: 'channel not found' })
    }

    const { tenant_id, user_id } = connResult.rows[0]
    await syncCalendarForTenant(tenant_id, user_id)

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[WEBHOOK] Erro:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
