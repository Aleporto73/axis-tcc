import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { scheduleSessionReminders } from '@/src/services/reminder'
import { nextSessionNumber } from '@/src/services/session-number'
import { pushNewSessionToGoogle, type GoogleConnection } from '@/src/services/google-event-create'

// =====================================================
// AXIS TCC — Criar Sessão
// Migration: withTenant (Auditoria TCC P0)
// Entrega 1B: "Agendar" grava a sessão (commit) ANTES de criar o evento no Google;
// o evento é criado fora de transação e vinculado numa transação curta depois.
// =====================================================

const SCHEDULED_DURATION_MINUTES = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_id, session_type = 'presencial', scheduled_at, start_now = true } = body

    if (!patient_id) {
      return NextResponse.json({ error: 'Paciente obrigatorio' }, { status: 400 })
    }

    // Transação 1 (curta): trava do paciente + número + INSERT + lembretes + COMMIT.
    const created = await withTenant(async (ctx) => {
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

      if (start_now) {
        const sessionNumber = await nextSessionNumber(client, tenantId, patient_id)
        const sessionResult = await client.query(
          `INSERT INTO sessions (tenant_id, patient_id, session_type, session_number, scheduled_at, started_at, status, time_source)
           VALUES ($1, $2, $3, $4, NOW(), NOW(), 'em_andamento', 'manual')
           RETURNING id, patient_id, session_number, scheduled_at, started_at, status`,
          [tenantId, patient_id, session_type, sessionNumber]
        )
        return { tenantId, session: sessionResult.rows[0], google: null }
      }

      if (!scheduled_at) {
        const err = new Error('Data de agendamento obrigatoria') as any
        err.statusCode = 400
        throw err
      }

      const connResult = await client.query(
        'SELECT id, access_token, refresh_token, token_expiry FROM calendar_connections WHERE tenant_id = $1 AND provider = $2',
        [tenantId, 'google']
      )

      // Sem vínculo com o Google aqui: ele é gravado depois do evento existir (pushNewSessionToGoogle).
      const sessionNumber = await nextSessionNumber(client, tenantId, patient_id)
      const sessionResult = await client.query(
        `INSERT INTO sessions (tenant_id, patient_id, session_type, session_number, scheduled_at, started_at, status, time_source, calendar_source)
         VALUES ($1, $2, $3, $4, $5, NULL, 'agendada', 'manual', NULL)
         RETURNING id, patient_id, session_number, scheduled_at, started_at, status, google_meet_link`,
        [tenantId, patient_id, session_type, sessionNumber, scheduled_at]
      )

      await scheduleSessionReminders({
        tenant_id: tenantId,
        session_id: sessionResult.rows[0].id,
        patient_id,
        scheduled_at: new Date(scheduled_at),
        patient_name: patientName
      }, client)

      const connection: GoogleConnection | null = connResult.rows[0] ?? null
      return { tenantId, session: sessionResult.rows[0], google: { connection, patientName, patientEmail } }
    })

    if (!created.google) {
      return NextResponse.json({ success: true, session: created.session, google_synced: false }, { status: 201 })
    }

    // Fora de transação: Google com tempo limite; falha só deixa a sessão sem vínculo.
    const { connection, patientName, patientEmail } = created.google
    let googleSynced = false
    let meetLink: string | null = created.session.google_meet_link ?? null
    if (connection) {
      const pushed = await pushNewSessionToGoogle(created.tenantId, connection, {
        sessionId: created.session.id,
        patientName,
        patientEmail,
        scheduledAt: new Date(scheduled_at),
        durationMinutes: SCHEDULED_DURATION_MINUTES,
      })
      googleSynced = pushed.synced
      meetLink = pushed.meetLink ?? meetLink
    }

    return NextResponse.json({
      success: true,
      session: { ...created.session, google_meet_link: meetLink },
      google_synced: googleSynced,
      google_connected: !!connection
    }, { status: 201 })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
