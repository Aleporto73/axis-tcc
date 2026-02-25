import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { ensureValidToken, getAttendeeResponse, calcDurationMinutes } from '@/src/google/calendar-helpers'

// =====================================================
// AXIS ABA — Google Calendar Manual Sync (Multi-Terapeuta)
// Conforme Bible S19: Google Calendar Bidirecional
//
// Diferenças do TCC:
//   - Busca calendar_connections por profile_id
//   - Sincroniza com sessions_aba (não sessions)
//   - Busca learners por guardians.email (não patients.email)
//   - Associa therapist_id ao profile que faz o sync
//   - Cria sessões com learner_id + therapist_id
// =====================================================

export async function POST() {
  try {
    const result = await withTenant(async (ctx) => {
      const { client, tenantId, userId, profileId } = ctx

      // Buscar conexão do terapeuta
      const connResult = await client.query(
        `SELECT * FROM calendar_connections
         WHERE tenant_id = $1 AND user_id = $2 AND provider = 'google'`,
        [tenantId, profileId]
      )

      if (connResult.rows.length === 0) {
        return { error: 'Google Calendar não conectado', code: 400 }
      }

      const conn = connResult.rows[0]
      const accessToken = await ensureValidToken(client, conn)
      if (!accessToken) {
        return { error: 'Erro ao renovar token Google', code: 401 }
      }

      // Buscar syncToken (incremental sync)
      const stateResult = await client.query(
        `SELECT sync_token FROM calendar_sync_state
         WHERE tenant_id = $1 AND user_id = $2 AND provider = 'google'`,
        [tenantId, profileId]
      )
      const syncToken = stateResult.rows[0]?.sync_token

      // Montar URL da Google Calendar API
      let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?'
      if (syncToken) {
        url += 'syncToken=' + syncToken
      } else {
        // Primeiro sync: 1 mês atrás
        const timeMin = new Date()
        timeMin.setMonth(timeMin.getMonth() - 1)
        url += 'singleEvents=true&maxResults=50&timeMin=' + timeMin.toISOString()
      }

      const eventsResponse = await fetch(url, {
        headers: { Authorization: 'Bearer ' + accessToken },
      })

      if (!eventsResponse.ok) {
        const errorText = await eventsResponse.text()
        console.error('[ABA_GOOGLE_SYNC] Erro ao buscar eventos:', errorText)

        // Se syncToken expirou (410 Gone), limpar e tentar sem
        if (eventsResponse.status === 410) {
          await client.query(
            `DELETE FROM calendar_sync_state
             WHERE tenant_id = $1 AND user_id = $2 AND provider = 'google'`,
            [tenantId, profileId]
          )
          return { error: 'Sync token expirado. Tente novamente.', code: 409 }
        }

        return { error: 'Erro ao buscar eventos do Google', code: 500 }
      }

      const eventsData = await eventsResponse.json()
      const events = eventsData.items || []
      let imported = 0
      let updated = 0
      let skipped = 0

      for (const event of events) {
        // Ignorar eventos sem horário (all-day)
        if (!event.start?.dateTime || !event.end?.dateTime) {
          skipped++
          continue
        }

        // Buscar learner pelo email dos convidados (via guardians)
        let learnerId = null
        let guardianEmail = null

        if (event.attendees && event.attendees.length > 0) {
          for (const attendee of event.attendees) {
            if (attendee.email && !attendee.self) {
              // Buscar guardians pelo email → learner_id
              const guardianResult = await client.query(
                `SELECT g.learner_id, g.email
                 FROM guardians g
                 WHERE g.tenant_id = $1 AND g.email = $2 AND g.is_active = true
                 LIMIT 1`,
                [tenantId, attendee.email]
              )

              if (guardianResult.rows.length > 0) {
                learnerId = guardianResult.rows[0].learner_id
                guardianEmail = guardianResult.rows[0].email
                break
              }

              // Fallback: buscar learner diretamente (caso tenha email)
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

        // Verificar se sessão já existe por google_event_id
        const existingSession = await client.query(
          `SELECT id, external_etag FROM sessions_aba
           WHERE tenant_id = $1 AND google_event_id = $2`,
          [tenantId, event.id]
        )

        if (existingSession.rows.length > 0) {
          // Atualizar se etag mudou
          if (existingSession.rows[0].external_etag !== event.etag) {
            await client.query(
              `UPDATE sessions_aba SET
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
          // Criar nova sessão ABA
          await client.query(
            `INSERT INTO sessions_aba
              (tenant_id, learner_id, therapist_id, scheduled_at, duration_minutes,
               status, google_event_id, google_calendar_id, calendar_source,
               external_etag, external_updated_at, google_meet_link, patient_response,
               created_at)
             VALUES ($1, $2, $3, $4, $5, 'agendada', $6, 'primary', 'google',
                     $7, $8, $9, $10, NOW())`,
            [
              tenantId,
              learnerId,
              userId, // clerk_user_id do terapeuta
              event.start.dateTime,
              duration,
              event.id,
              event.etag,
              event.updated,
              meetLink,
              attendeeResponse,
            ]
          )
          imported++
        } else {
          skipped++
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

      // Audit log — Bible S13.3
      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
         VALUES ($1, $2, 'CALENDAR_SYNC_RUN', $3)`,
        [
          tenantId,
          userId,
          JSON.stringify({
            product: 'axis_aba',
            profile_id: profileId,
            imported,
            updated,
            skipped,
            total: events.length,
          }),
        ]
      )

      return { success: true, imported, updated, skipped, total: events.length }
    })

    if ('error' in result) {
      return NextResponse.json({ error: (result as any).error }, { status: (result as any).code || 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
