import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { id } = await params

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const patientResult = await pool.query(
      'SELECT id, full_name FROM patients WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    )
    if (patientResult.rows.length === 0) {
      return NextResponse.json({ error: 'Paciente nao encontrado' }, { status: 404 })
    }

    const sessionsResult = await pool.query(
      `SELECT id, session_number, started_at, ended_at, duration_minutes, created_at
       FROM sessions 
       WHERE patient_id = $1 AND tenant_id = $2 AND status = 'finalizada'
       ORDER BY created_at ASC`,
      [id, tenantId]
    )
    const sessions = sessionsResult.rows

    const eventsResult = await pool.query(
      `SELECT event_type, COUNT(*) as count
       FROM events
       WHERE patient_id = $1 AND tenant_id = $2
       AND event_type IN ('AVOIDANCE_OBSERVED', 'CONFRONTATION_OBSERVED', 'ADJUSTMENT_OBSERVED', 'RECOVERY_OBSERVED')
       GROUP BY event_type`,
      [id, tenantId]
    )
    
    const eventCounts: Record<string, number> = { EVITOU: 0, ENFRENTOU: 0, AJUSTOU: 0, RECUPEROU: 0 }
    let totalEvents = 0
    
    for (const row of eventsResult.rows) {
      const count = parseInt(row.count)
      totalEvents += count
      if (row.event_type === 'AVOIDANCE_OBSERVED') eventCounts.EVITOU = count
      if (row.event_type === 'CONFRONTATION_OBSERVED') eventCounts.ENFRENTOU = count
      if (row.event_type === 'ADJUSTMENT_OBSERVED') eventCounts.AJUSTOU = count
      if (row.event_type === 'RECOVERY_OBSERVED') eventCounts.RECUPEROU = count
    }

    const eventPercentages: Record<string, number> = {
      EVITOU: totalEvents > 0 ? Math.round((eventCounts.EVITOU / totalEvents) * 100) : 0,
      ENFRENTOU: totalEvents > 0 ? Math.round((eventCounts.ENFRENTOU / totalEvents) * 100) : 0,
      AJUSTOU: totalEvents > 0 ? Math.round((eventCounts.AJUSTOU / totalEvents) * 100) : 0,
      RECUPEROU: totalEvents > 0 ? Math.round((eventCounts.RECUPEROU / totalEvents) * 100) : 0
    }

    const csoResult = await pool.query(
      `SELECT created_at, flex_trend, recovery_time, activation_level, system_confidence
       FROM clinical_states
       WHERE patient_id = $1 AND tenant_id = $2
       ORDER BY created_at ASC`,
      [id, tenantId]
    )
    const csoHistory = csoResult.rows

    let avgRecoveryTime = 0
    let validCount = 0
    for (const cso of csoHistory) {
      if (cso.recovery_time && cso.recovery_time > 0) {
        avgRecoveryTime += cso.recovery_time
        validCount++
      }
    }
    if (validCount > 0) avgRecoveryTime = Math.round(avgRecoveryTime / validCount)

    let trend: string = 'stable'
    if (csoHistory.length >= 2) {
      const recent = csoHistory.slice(-3)
      const up = recent.filter((c: any) => c.flex_trend === 'improving').length
      const down = recent.filter((c: any) => c.flex_trend === 'declining').length
      if (up > down) trend = 'up'
      else if (down > up) trend = 'down'
    }

    const timeline = sessions.map((s: any, idx: number) => ({
      session_number: s.session_number || idx + 1,
      date: s.started_at || s.created_at,
      duration: s.duration_minutes
    }))

    const frcData = csoHistory
      .filter((c: any) => c.recovery_time && c.recovery_time > 0)
      .map((c: any, idx: number) => ({
        index: idx + 1,
        recovery_time: c.recovery_time,
        date: c.created_at
      }))

    // Comparativo temporal (se >= 4 sessoes)
    let sessions_early = null
    let sessions_recent = null
    if (sessions.length >= 4) {
      const half = Math.floor(sessions.length / 2)
      const early = sessions.slice(0, half)
      const recent = sessions.slice(half)
      
      const earlyIds = early.map((s: any) => s.id)
      const recentIds = recent.map((s: any) => s.id)
      
      // Eventos por periodo
      const earlyEventsResult = await pool.query(
        `SELECT COUNT(*) as count FROM events 
         WHERE related_entity_id = ANY($1) AND tenant_id = $2
         AND event_type IN ('AVOIDANCE_OBSERVED', 'CONFRONTATION_OBSERVED', 'ADJUSTMENT_OBSERVED', 'RECOVERY_OBSERVED')`,
        [earlyIds, tenantId]
      )
      const recentEventsResult = await pool.query(
        `SELECT COUNT(*) as count FROM events 
         WHERE related_entity_id = ANY($1) AND tenant_id = $2
         AND event_type IN ('AVOIDANCE_OBSERVED', 'CONFRONTATION_OBSERVED', 'ADJUSTMENT_OBSERVED', 'RECOVERY_OBSERVED')`,
        [recentIds, tenantId]
      )
      
      const earlyAvgDuration = early.reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0) / early.length
      const recentAvgDuration = recent.reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0) / recent.length
      
      sessions_early = {
        count: early.length,
        events: parseInt(earlyEventsResult.rows[0]?.count || '0'),
        avg_recovery: Math.round(earlyAvgDuration) || 0
      }
      sessions_recent = {
        count: recent.length,
        events: parseInt(recentEventsResult.rows[0]?.count || '0'),
        avg_recovery: Math.round(recentAvgDuration) || 0
      }
    }

    // Sessoes atipicas (duração > 2x média)
    let outlier_sessions: { session_number: number; reason: string }[] = []
    if (sessions.length >= 3) {
      const durations = sessions.map((s: any) => s.duration_minutes || 0).filter((d: number) => d > 0)
      if (durations.length > 0) {
        const avgDuration = durations.reduce((a: number, b: number) => a + b, 0) / durations.length
        const stdDev = Math.sqrt(durations.reduce((sum: number, d: number) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length)
        
        for (const s of sessions) {
          if (s.duration_minutes && s.duration_minutes > avgDuration + 2 * stdDev) {
            outlier_sessions.push({
              session_number: s.session_number,
              reason: 'duração superior à média'
            })
          }
        }
      }
    }

    return NextResponse.json({
      patient_name: patientResult.rows[0].full_name,
      total_sessions: sessions.length,
      total_events: totalEvents,
      event_counts: eventCounts,
      event_percentages: eventPercentages,
      avg_recovery_time: avgRecoveryTime,
      trend,
      timeline,
      frc_data: frcData,
      sessions_early,
      sessions_recent,
      outlier_sessions: outlier_sessions.length > 0 ? outlier_sessions : null
    })

  } catch (error) {
    console.error('Erro ao buscar evolucao:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
