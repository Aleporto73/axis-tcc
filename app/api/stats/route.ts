import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

export async function GET(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      const patientsResult = await ctx.client.query(
        'SELECT COUNT(*) FROM patients WHERE tenant_id = $1',
        [ctx.tenantId]
      )

      const suggestionsResult = await ctx.client.query(
        `SELECT COUNT(*) FROM suggestions s
         WHERE s.tenant_id = $1
         AND NOT EXISTS (SELECT 1 FROM suggestion_decisions sd WHERE sd.suggestion_id = s.id)`,
        [ctx.tenantId]
      )

      const sessionsTodayResult = await ctx.client.query(
        `SELECT COUNT(*) FROM sessions WHERE tenant_id = $1 AND DATE(scheduled_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE`,
        [ctx.tenantId]
      )

      const sessionsMonthResult = await ctx.client.query(
        `SELECT COUNT(*) FROM sessions WHERE tenant_id = $1 AND scheduled_at >= date_trunc('month', CURRENT_DATE)`,
        [ctx.tenantId]
      )

      const totalSessionsResult = await ctx.client.query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'finalizada') as finished FROM sessions WHERE tenant_id = $1`,
        [ctx.tenantId]
      )

      const total = parseInt(totalSessionsResult.rows[0].total)
      const finished = parseInt(totalSessionsResult.rows[0].finished)
      const completionRate = total > 0 ? Math.round((finished / total) * 100) : 0

      const weeklyResult = await ctx.client.query(
        `SELECT date_trunc('week', created_at)::date as week_start, COUNT(*) as total
         FROM sessions WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '8 weeks'
         GROUP BY week_start ORDER BY week_start ASC`,
        [ctx.tenantId]
      )

      // Buscar próximas sessões - push_auth_token indica se push está ativo
      const upcomingResult = await ctx.client.query(
        `SELECT s.id, s.scheduled_at, s.status, s.patient_response, p.full_name as patient_name,
         CASE WHEN p.push_auth_token IS NOT NULL THEN true ELSE false END as push_enabled
         FROM sessions s
         JOIN patients p ON p.id = s.patient_id
         WHERE s.tenant_id = $1
         AND s.status IN ('agendada', 'em_andamento', 'aguardando')
         AND DATE(s.scheduled_at AT TIME ZONE 'America/Sao_Paulo') >= CURRENT_DATE
         ORDER BY s.scheduled_at ASC
         LIMIT 10`,
        [ctx.tenantId]
      )

      // Contar em andamento
      const inProgressResult = await ctx.client.query(
        `SELECT COUNT(*) FROM sessions WHERE tenant_id = $1 AND status = 'em_andamento'`,
        [ctx.tenantId]
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
    })
  } catch (error) {
    console.error('Erro ao buscar stats:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
