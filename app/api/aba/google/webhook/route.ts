import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'
import { ensureValidToken, getAttendeeResponse, calcDurationMinutes } from '@/src/google/calendar-helpers'
import { matchSiteByLocation } from '@/src/google/match-site'
import { rateLimit } from '@/src/middleware/rate-limit'
import * as Sentry from '@sentry/nextjs'

// =====================================================
// AXIS ABA — Google Calendar Webhook Receiver
// Conforme Bible S19: Google Calendar Bidirecional
//   "Google → AXIS: Sincronizar via webhook"
//
// Rota PÚBLICA (sem auth Clerk) — chamada pelo Google.
// Validação por x-goog-channel-id que deve existir na
// calendar_connections do ABA.
//
// Multi-terapeuta: webhook por profile.
// Sincroniza apenas sessions_aba do terapeuta dono do webhook.
// =====================================================

async function syncCalendarForProfile(tenantId: string, profileId: string, clerkUserId: string) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId])

    const connResult = await client.query(
      `SELECT * FROM calendar_connections
       WHERE tenant_id = $1 AND user_id = $2 AND provider = 'google'`,
      [tenantId, profileId]
    )
    if (connResult.rows.length === 0) return

    const conn = connResult.rows[0]
    const accessToken = await ensureValidToken(client, conn)
    if (!accessToken) return

    // Buscar syncToken
    const stateResult = await client.query(
      `SELECT sync_token FROM calendar_sync_state
       WHERE tenant_id = $1 AND user_id = $2 AND provider = 'google'`,
      [tenantId, profileId]
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
      // Se syncToken expirou (410), limpar
      if (eventsResponse.status === 410) {
        await client.query(
          `DELETE FROM calendar_sync_state
           WHERE tenant_id = $1 AND user_id = $2 AND provider = 'google'`,
          [tenantId, profileId]
        )
      }
      const eventsErrorBody = await eventsResponse.text()
      Sentry.captureMessage('[ABA_WEBHOOK] Erro ao buscar eventos', { level: 'error', extra: { body: eventsErrorBody?.slice(0, 500) } })
      console.error('[ABA_WEBHOOK] Erro ao buscar eventos:', eventsErrorBody)
      await client.query('ROLLBACK')
      return
    }

    const eventsData = await eventsResponse.json()
    const events = eventsData.items || []
    let imported = 0, updated = 0

    for (const event of events) {
      if (!event.start?.dateTime || !event.end?.dateTime) continue

      // Buscar learner pelo email dos convidados (via guardians ou learners)
      let learnerId = null
      let guardianEmail = null

      if (event.attendees && event.attendees.length > 0) {
        for (const attendee of event.attendees) {
          if (attendee.email && !attendee.self) {
            const guardianResult = await client.query(
              `SELECT g.learner_id, g.email FROM guardians g
               WHERE g.tenant_id = $1 AND g.email = $2 AND g.is_active = true
               LIMIT 1`,
              [tenantId, attendee.email]
            )
            if (guardianResult.rows.length > 0) {
              learnerId = guardianResult.rows[0].learner_id
              guardianEmail = guardianResult.rows[0].email
              break
            }

            const learnerResult = await client.query(
              `SELECT id FROM learners
               WHERE tenant_id = $1 AND email = $2 AND is_active = true
               LIMIT 1`,
              [tenantId, attendee.email]
            )
            if (learnerResult.rows.length > 0) {
              learnerId = learnerResult.rows[0].id
              guardianEmail = attendee.email
              break
            }
          }
        }
      }

      const meetLink = event.hangoutLink || null
      const attendeeResponse = getAttendeeResponse(event.attendees, guardianEmail)
      const duration = calcDurationMinutes(event.start.dateTime, event.end.dateTime)

      const existingSession = await client.query(
        `SELECT id, external_etag FROM sessions_aba
         WHERE tenant_id = $1 AND google_event_id = $2`,
        [tenantId, event.id]
      )

      if (existingSession.rows.length > 0) {
        if (existingSession.rows[0].external_etag !== event.etag) {
          await client.query(
            `UPDATE sessions_aba SET
              scheduled_at = $1, duration_minutes = $2,
              status = $3, external_etag = $4,
              external_updated_at = $5, google_meet_link = $6,
              patient_response = $7
             WHERE id = $8`,
            [
              event.start.dateTime,
              duration,
              event.status === 'cancelled' ? 'cancelada' : 'agendada',
              event.etag,
              event.updated,
              meetLink,
              attendeeResponse,
              existingSession.rows[0].id,
            ]
          )
          updated++
        }
      } else if (learnerId && event.status !== 'cancelled') {
        // Bug 1 fix: match event.location contra service_sites ativos.
        // Se bater, popular declared_site_id + service_mode + location.
        const matchedSite = await matchSiteByLocation(client, tenantId, event.location)

        await client.query(
          `INSERT INTO sessions_aba
            (tenant_id, learner_id, therapist_id, scheduled_at, duration_minutes,
             status, google_event_id, google_calendar_id, calendar_source,
             external_etag, external_updated_at, google_meet_link, patient_response,
             declared_site_id, service_mode, location,
             created_at)
           VALUES ($1, $2, $3, $4, $5, 'agendada', $6, 'primary', 'google',
                   $7, $8, $9, $10, $11, $12, $13, NOW())`,
          [
            tenantId,
            learnerId,
            clerkUserId,
            event.start.dateTime,
            duration,
            event.id,
            event.etag,
            event.updated,
            meetLink,
            attendeeResponse,
            matchedSite?.site_id || null,
            matchedSite?.service_mode || null,
            matchedSite?.site_name || event.location || null,
          ]
        )
        imported++
      } else {
        // Bug 2 fix (webhook async, sem UI): se o evento tinha attendees
        // reais e nenhum bateu com guardian/learner, grava audit log
        // CALENDAR_UNMATCHED_EVENT para rastreabilidade. Logs em prod
        // permitem investigar por que sessões não foram importadas.
        const hasAttendees =
          event.attendees &&
          event.attendees.some((a: { email?: string; self?: boolean }) => a.email && !a.self)
        if (hasAttendees && event.status !== 'cancelled' && !learnerId) {
          await client.query(
            `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
             VALUES ($1, $2, 'CALENDAR_UNMATCHED_EVENT', $3)`,
            [
              tenantId,
              clerkUserId,
              JSON.stringify({
                product: 'axis_aba',
                source: 'webhook',
                event_id: event.id,
                summary: event.summary || '(sem título)',
                scheduled_at: event.start.dateTime,
                attendee_emails: event.attendees
                  .filter((a: { email?: string; self?: boolean }) => a.email && !a.self)
                  .map((a: { email: string }) => a.email),
              }),
            ]
          )
        }
      }
    }

    // Salvar nextSyncToken
    if (eventsData.nextSyncToken) {
      await client.query(
        `INSERT INTO calendar_sync_state
          (tenant_id, user_id, provider, calendar_id, sync_token, last_sync_at)
         VALUES ($1, $2, 'google', 'primary', $3, NOW())
         ON CONFLICT (tenant_id, user_id, provider, calendar_id)
         DO UPDATE SET sync_token = $3, last_sync_at = NOW()`,
        [tenantId, profileId, eventsData.nextSyncToken]
      )
    }

    await client.query('COMMIT')
    console.log('[ABA_WEBHOOK] Sync concluído:', { tenantId, profileId, imported, updated })
  } catch (error) {
    await client.query('ROLLBACK')
    Sentry.captureException(error)
    console.error('[ABA_WEBHOOK] Erro no sync:', error)
  } finally {
    client.release()
  }
}

// POST /api/aba/google/webhook — Recebe notificações do Google
export async function POST(request: NextRequest) {
  // Rate limit: 100 req/min por IP (rota pública — chamada pelo Google)
  const blocked = await rateLimit(request, { limit: 100, windowMs: 60_000, prefix: 'rl:gcal-webhook' })
  if (blocked) return blocked

  try {
    const channelId = request.headers.get('x-goog-channel-id')
    const resourceState = request.headers.get('x-goog-resource-state')

    console.log('[ABA_WEBHOOK] Recebido:', { channelId, resourceState })

    // Acknowledgment do sync inicial
    if (resourceState === 'sync') {
      return NextResponse.json({ status: 'sync acknowledged' })
    }

    if (!channelId) {
      return NextResponse.json({ error: 'Missing channel ID' }, { status: 400 })
    }

    // Buscar conexão pelo webhook_channel_id
    const connResult = await pool.query(
      `SELECT cc.tenant_id, cc.user_id AS profile_id, p.clerk_user_id
       FROM calendar_connections cc
       LEFT JOIN profiles p ON p.id::text = cc.user_id AND p.tenant_id = cc.tenant_id
       WHERE cc.webhook_channel_id = $1`,
      [channelId]
    )

    if (connResult.rows.length === 0) {
      console.log('[ABA_WEBHOOK] Canal não encontrado:', channelId)
      return NextResponse.json({ status: 'channel not found' })
    }

    const { tenant_id, profile_id, clerk_user_id } = connResult.rows[0]

    // Sync assíncrono (não bloquear resposta ao Google)
    syncCalendarForProfile(tenant_id, profile_id, clerk_user_id || profile_id).catch((err) => {
      Sentry.captureException(err)
      console.error('[ABA_WEBHOOK] Erro no sync async:', err)
    })

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    Sentry.captureException(error)
    console.error('[ABA_WEBHOOK] Erro:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
