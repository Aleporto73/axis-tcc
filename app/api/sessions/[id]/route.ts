import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { deletePendingSessionReminders } from '@/src/services/reminder'

/**
 * GET /api/sessions/[id]
 * Retrieve a single session by ID
 * Migration: withTenant (Auditoria TCC P0)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      const queryResult = await client.query(
        `SELECT
          s.id, s.patient_id, s.session_number, s.session_type,
          s.scheduled_at, s.started_at, s.ended_at, s.duration_minutes,
          s.status, s.mood_check, s.bridge_from_last, s.agenda_items,
          s.created_at, s.google_meet_link, p.full_name as patient_name
        FROM sessions s
        LEFT JOIN patients p ON s.patient_id = p.id
        WHERE s.id = $1 AND s.tenant_id = $2`,
        [id, tenantId]
      )

      if (queryResult.rows.length === 0) {
        return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
      }

      // Buscar transcript existente (preview/metadados)
      const transcriptResult = await client.query(
        `SELECT id, text_preview, transcript_path, text, char_count, created_at, processed
         FROM transcripts
         WHERE session_id = $1 AND tenant_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [id, tenantId]
      )

      // Buscar job de transcrição mais recente
      const jobResult = await client.query(
        `SELECT id as job_id, status, progress, error_message, created_at
         FROM transcription_jobs
         WHERE session_id = $1 AND tenant_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [id, tenantId]
      )

      const transcript = transcriptResult.rows[0]
        ? {
            id: transcriptResult.rows[0].id,
            // Compatibilidade legado: se não tem text_preview, usar text
            text_preview: transcriptResult.rows[0].text_preview || transcriptResult.rows[0].text?.slice(0, 500) || '',
            created_at: transcriptResult.rows[0].created_at,
            processed: transcriptResult.rows[0].processed,
          }
        : null

      const transcription_job = jobResult.rows[0] || null

      return NextResponse.json({
        session: queryResult.rows[0],
        transcript,
        transcription_job,
      })
    })

    return result
  } catch (error) {
    console.error('Erro ao buscar sessao:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * DELETE /api/sessions/[id]
 * Cancel a session (delete)
 * Migration: withTenant (Auditoria TCC P0)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      const sessionResult = await client.query(
        'SELECT id FROM sessions WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )

      if (sessionResult.rows.length === 0) {
        return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
      }

      await deletePendingSessionReminders(client, tenantId, id)

      await client.query(
        'DELETE FROM sessions WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )

      return NextResponse.json({ success: true, message: 'Sessao cancelada' })
    })

    return result
  } catch (error) {
    console.error('Erro ao deletar sessao:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
