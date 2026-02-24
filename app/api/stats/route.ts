import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )

    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ stats: { patients: 0, suggestions: 0, sessions_today: 0, sessions_month: 0, completion_rate: 0, total_sessions: 0, in_progress: 0, weekly: [], upcoming: [] } })
    }

    const tenantId = tenantResult.rows[0].id

    const patientsResult = await pool.query(
      'SELECT COUNT(*) FROM patients WHERE tenant_id = $1',
      [tenantId]
    )

    const suggestionsResult = await pool.query(
      `SELECT COUNT(*) FROM suggestions s
       WHERE s.tenant_id = $1
       AND NOT EXISTS (SELECT 1 FROM suggestion_decisions sd WHERE sd.suggestion_id = s.id)`,
      [tenantId]
    )

    const sessionsTodayResult = await pool.query(
      `SELECT COUNT(*) FROM sessions WHERE tenant_id = $1 AND DATE(scheduled_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE`,
      [tenantId]
    )

    const sessionsMonthResult = await pool.query(
      `SELECT COUNT(*) FROM sessions WHERE tenant_id = $1 AND scheduled_at >= date_trunc('month', CURRENT_DATE)`,
      [tenantId]
    )

    const totalSessionsResult = await pool.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'finalizada') as finished FROM sessions WHERE tenant_id = $1`,
      [tenantId]
    )

    const total = parseInt(totalSessionsResult.rows[0].total)
    const finished = parseInt(totalSessionsResult.rows[0].finished)
    const completionRate = total > 0 ? Math.round((finished / total) * 100) : 0

    const weeklyResult = await pool.query(
      `SELECT date_trunc('week', created_at)::date as week_start, COUNT(*) as total
       FROM sessions WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '8 weeks'
       GROUP BY week_start ORDER BY week_start ASC`,
      [tenantId]
    )

    // Buscar próximas sessões - push_auth_token indica se push está ativo
    const upcomingResult = await pool.query(
      `SELECT s.id, s.scheduled_at, s.status, s.patient_response, p.full_name as patient_name, 
       CASE WHEN p.push_auth_token IS NOT NULL THEN true ELSE false END as push_enabled
       FROM sessions s 
       JOIN patients p ON p.id = s.patient_id
       WHERE s.tenant_id = $1 
       AND s.status IN ('agendada', 'em_andamento', 'aguardando')
       AND DATE(s.scheduled_at AT TIME ZONE 'America/Sao_Paulo') >= CURRENT_DATE
       ORDER BY s.scheduled_at ASC 
       LIMIT 10`,
      [tenantId]
    )

    // Contar em andamento
    const inProgressResult = await pool.query(
      `SELECT COUNT(*) FROM sessions WHERE tenant_id = $1 AND status = 'em_andamento'`,
      [tenantId]
    )

    const stats = {
      patients: parseInt(patientsResult.rows[0].count),
      suggestions: parseInt(suggestionsResult.rows[0].count),
      sessions_today: parseInt(sessionsTodayResult.rows[0].count),
      sessions_month: parseInt(sessionsMonthResult.rows[0].count),
      completion_rate: completionRate,
      total_sessions: total,
      in_progress: parseInt(inProgressResult.rows[0].count),
      weekly: weeklyResult.rows.map(r => ({
        week: new Date(r.week_start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        total: parseInt(r.total)
      })),
      upcoming: upcomingResult.rows.map(r => ({
        id: r.id,
        patient_name: r.patient_name,
        scheduled_at: r.scheduled_at,
        status: r.status,
        push_enabled: r.push_enabled,
        patient_response: r.patient_response
      }))
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Erro ao buscar stats:', error)
    return NextResponse.json({ stats: { patients: 0, suggestions: 0, sessions_today: 0, sessions_month: 0, completion_rate: 0, total_sessions: 0, in_progress: 0, weekly: [], upcoming: [] } })
  }
}
