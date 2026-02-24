import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'
import { processEvent } from '@/src/engines/cso'
import { generateSuggestions } from '@/src/engines/suggestion'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { id } = await params

    // 1. Buscar tenant
    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    // 2. Buscar sessao
    const sessionResult = await pool.query(
      'SELECT id, patient_id, started_at, status, session_number FROM sessions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    )
    if (sessionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
    }

    const session = sessionResult.rows[0]
    const patientId = session.patient_id
    const startedAt = new Date(session.started_at)
    const endedAt = new Date()
    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)

    // 3. Finalizar sessao
    await pool.query(
      `UPDATE sessions SET status = 'finalizada', ended_at = NOW(), duration_minutes = $1 WHERE id = $2`,
      [durationMinutes, id]
    )

    // 4. Buscar transcricao e analise TCC (se existir)
    const transcriptResult = await pool.query(
      'SELECT text FROM transcripts WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    )

    const analysisResult = await pool.query(
      'SELECT facts, thoughts, emotions FROM tcc_analyses WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    )

    // 5. Buscar micro-eventos da sessao
    const eventsResult = await pool.query(
      `SELECT event_type, payload FROM events 
       WHERE patient_id = $1 AND tenant_id = $2 
       AND created_at >= $3
       AND event_type IN ('AVOIDANCE_OBSERVED','CONFRONTATION_OBSERVED','ADJUSTMENT_OBSERVED','RECOVERY_OBSERVED')
       ORDER BY created_at`,
      [patientId, tenantId, startedAt]
    )

    // 6. Calcular flex_data dos micro-eventos
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

    // 7. Gerar evento SESSION_END
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

    const eventInsert = await pool.query(
      `INSERT INTO events (tenant_id, patient_id, event_type, payload)
       VALUES ($1, $2, 'SESSION_END', $3)
       RETURNING *`,
      [tenantId, patientId, JSON.stringify(sessionPayload)]
    )

    // 8. Chamar CSO Engine
    let csoResult = null
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
      console.log('[PIPELINE] CSO processado:', csoResult ? 'OK' : 'SILENCIO')
    } catch (err) {
      console.error('[PIPELINE] Erro no CSO Engine:', err)
    }

    // 9. Chamar Suggestion Engine (se CSO foi gerado)
    let suggestionResult = null
    if (csoResult) {
      try {
        suggestionResult = await generateSuggestions(csoResult)
        console.log('[PIPELINE] Sugestao gerada:', suggestionResult ? 'OK' : 'NENHUMA')
      } catch (err) {
        console.error('[PIPELINE] Erro no Suggestion Engine:', err)
      }
    }

    // Audit log - SESSION_FINISH
    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'human', 'SESSION_FINISH', 'session', $3, $4)`,
      [tenantId, userId, id, JSON.stringify({ session_number: session.session_number, duration_minutes: durationMinutes, micro_events_count: totalFlex })]
    )

    // 10. Retornar resultado completo
    return NextResponse.json({
      success: true,
      session: { id, status: 'finalizada', duration_minutes: durationMinutes },
      pipeline: {
        event_created: true,
        cso_updated: csoResult !== null,
        suggestion_generated: suggestionResult !== null,
        flex_trend: flexTrend,
        micro_events: { confrontations, avoidances, adjustments, recoveries }
      }
    })

  } catch (error) {
    console.error('[PIPELINE] Erro ao finalizar sessao:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
