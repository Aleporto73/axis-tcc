import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { createSystemAlert } from '@/src/utils/system-alert'
import { readTranscriptSmart } from '@/src/services/transcript-storage'
import { processEvent } from '@/src/engines/cso'
import { generateSuggestions, CsoDelta } from '@/src/engines/suggestion'
import { getSessionDuration } from '@/src/services/session-duration'

// =====================================================
// AXIS TCC — Finalizar Sessão + Pipeline CSO
// Migration: withTenant (Auditoria TCC P0)
//
// Nota: rota marcada como pública no middleware para
// permitir finish de sessão mesmo com token expirado.
// withTenant faz auth check internamente — se falhar,
// retorna 401 corretamente.
//
// Pipeline: Session -> Event -> CSO -> Suggestion -> Audit
// =====================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const { client, tenantId, userId } = ctx

      // 1. Buscar sessão
      const sessionResult = await client.query(
        'SELECT id, patient_id, started_at, status, session_number FROM sessions WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )
      if (sessionResult.rows.length === 0) {
        const err = new Error('Sessao nao encontrada') as any
        err.statusCode = 404
        throw err
      }

      const session = sessionResult.rows[0]
      const patientId = session.patient_id
      const startedAt = new Date(session.started_at)

      // 2. Finalizar sessao (ended_at primeiro, depois duracao canonica via helper)
      await client.query(
        `UPDATE sessions SET status = 'finalizada', ended_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      )

      // 2b. Buscar duracao canonica: audio real (transcripts.audio_duration_seconds) ou started_at/ended_at
      const durationMinutes = await getSessionDuration(client, id, tenantId)

      await client.query(
        `UPDATE sessions SET duration_minutes = $1 WHERE id = $2 AND tenant_id = $3`,
        [durationMinutes, id, tenantId]
      )

      // 3. Buscar transcrição e análise TCC
      const [transcriptResult, analysisResult] = await Promise.all([
        client.query(
          'SELECT text, text_preview, transcript_path, final_path, raw_path FROM transcripts WHERE session_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1',
          [id, tenantId]
        ),
        client.query(
          'SELECT facts, thoughts, emotions FROM tcc_analyses WHERE session_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1',
          [id, tenantId]
        ),
      ])

      // 4. Buscar micro-eventos da sessão
      const eventsResult = await client.query(
        `SELECT event_type, payload FROM events
         WHERE patient_id = $1 AND tenant_id = $2
         AND created_at >= $3
         AND event_type IN ('AVOIDANCE_OBSERVED','CONFRONTATION_OBSERVED','ADJUSTMENT_OBSERVED','RECOVERY_OBSERVED')
         ORDER BY created_at`,
        [patientId, tenantId, startedAt]
      )

      // 5. Calcular flex_data dos micro-eventos
      const microEvents = eventsResult.rows
      let confrontations = 0
      let avoidances = 0
      let adjustments = 0
      let recoveries = 0

      for (const ev of microEvents) {
        switch (ev.event_type) {
          case 'CONFRONTATION_OBSERVED': confrontations++; break
          case 'AVOIDANCE_OBSERVED': avoidances++; break
          case 'ADJUSTMENT_OBSERVED': adjustments++; break
          case 'RECOVERY_OBSERVED': recoveries++; break
        }
      }

      const totalFlex = confrontations + avoidances + adjustments + recoveries
      let flexTrend = 'flat'
      if (totalFlex > 0) {
        const positiveRatio = (confrontations + adjustments + recoveries) / totalFlex
        if (positiveRatio >= 0.6) flexTrend = 'up'
        else if (positiveRatio <= 0.3) flexTrend = 'down'
      }

      // 6. Gerar evento SESSION_END
      const sessionPayload: any = {
        duration_minutes: durationMinutes,
        has_transcription: transcriptResult.rows.length > 0,
        has_tcc_analysis: analysisResult.rows.length > 0,
        micro_events: { confrontations, avoidances, adjustments, recoveries },
        flex_trend: flexTrend
      }

      if (analysisResult.rows.length > 0) {
        const analysis = analysisResult.rows[0]
        sessionPayload.facts_count = analysis.facts?.length || 0
        sessionPayload.thoughts_count = analysis.thoughts?.length || 0
        sessionPayload.emotions_count = analysis.emotions?.length || 0
      }

      const eventInsert = await client.query(
        `INSERT INTO events (tenant_id, patient_id, event_type, payload)
         VALUES ($1, $2, 'SESSION_END', $3)
         RETURNING *`,
        [tenantId, patientId, JSON.stringify(sessionPayload)]
      )

      // 7. Pipeline CSO Engine
      let csoResult = null
      const pipelineWarnings: string[] = []
      try {
        csoResult = await processEvent({
          id: eventInsert.rows[0].id,
          tenant_id: tenantId,
          patient_id: patientId,
          event_type: 'SESSION_END',
          payload: sessionPayload,
          source: 'session_finish',
          related_entity_id: id,
          created_at: new Date()
        })
      } catch (err) {
        console.error('[PIPELINE] Erro no CSO Engine:', err)
        pipelineWarnings.push('Motor CSO não processou o evento. Os indicadores podem estar desatualizados.')
      }

      // 8. Suggestion Engine (se CSO gerado)
      let suggestionResult = null
      if (csoResult) {
        // 8.1. Buscar CSO anterior pra calcular delta (input auxiliar — Fase 11)
        let delta: CsoDelta | null = null
        try {
          const prevCsoQuery = await client.query(
            `SELECT activation_level, cognitive_rigidity, emotional_load, task_adherence
             FROM clinical_states
             WHERE patient_id = $1 AND tenant_id = $2 AND id <> $3
             ORDER BY created_at DESC
             LIMIT 1`,
            [patientId, tenantId, csoResult.id]
          )

          if (prevCsoQuery.rows.length > 0) {
            const prev = prevCsoQuery.rows[0]
            const diff = (curr: number | null, old: number | null): number | null =>
              curr !== null && old !== null ? Number(curr) - Number(old) : null

            delta = {
              activation_level:    diff(csoResult.activation_level,    prev.activation_level),
              cognitive_rigidity:  diff(csoResult.cognitive_rigidity,  prev.cognitive_rigidity),
              emotional_load:      diff(csoResult.emotional_load,      prev.emotional_load),
              task_adherence:      diff(csoResult.task_adherence,      prev.task_adherence),
            }
          }
        } catch (err) {
          console.error('[PIPELINE] Falha ao calcular delta CSO (segue sem delta):', err)
          delta = null
        }

        try {
          suggestionResult = await generateSuggestions(csoResult, delta)
        } catch (err) {
          console.error('[PIPELINE] Erro no Suggestion Engine:', err)
          pipelineWarnings.push('Motor de sugestões falhou. Nenhuma sugestão foi gerada neste ciclo.')
        }
      }

      // 9. Audit log
      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'human', 'SESSION_FINISH', 'session', $3, $4)`,
        [tenantId, userId, id, JSON.stringify({ session_number: session.session_number, duration_minutes: durationMinutes, micro_events_count: totalFlex })]
      )

      return {
        session: { id, status: 'finalizada', duration_minutes: durationMinutes },
        pipeline: {
          event_created: true,
          cso_updated: csoResult !== null,
          suggestion_generated: suggestionResult !== null,
          flex_trend: flexTrend,
          micro_events: { confrontations, avoidances, adjustments, recoveries },
          warnings: pipelineWarnings.length > 0 ? pipelineWarnings : undefined
        }
      }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)

    // Alerta de sistema: erro 500 em rota crítica (pipeline CSO)
    createSystemAlert({
      module: 'axis-tcc',
      severity: 'critical',
      source: 'api/sessions/finish',
      code: 'SESSION_FINISH_ERROR',
      message: 'Erro 500 ao finalizar sessao TCC',
      context: { error: error instanceof Error ? error.message : 'unknown' },
    }).catch(() => {})

    return NextResponse.json({ error: message }, { status })
  }
}
