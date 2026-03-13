import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Relatório de Evolução
// GET — Agrega dados do paciente para relatório
// Inclui: dados pessoais, protocolos, sessões,
//         scores CSO-TDAH, DRCs, layer AuDHD
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')
    const periodStart = searchParams.get('period_start')
    const periodEnd = searchParams.get('period_end')

    if (!patientId) {
      return NextResponse.json({ error: 'patient_id obrigatório' }, { status: 400 })
    }

    const start = periodStart || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const end = periodEnd || new Date().toISOString().split('T')[0]

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      // Role filter
      let roleCheck = ''
      const baseParams: any[] = [patientId, tenantId, start, end]
      if (ctx.role === 'terapeuta') {
        baseParams.push(ctx.profileId)
        roleCheck = `AND p.created_by = $${baseParams.length}`
      }

      // 1) Paciente
      const patient = await client.query(
        `SELECT p.*, prof.first_name || ' ' || prof.last_name as therapist_name
         FROM tdah_patients p
         LEFT JOIN profiles prof ON prof.id = p.created_by
         WHERE p.id = $1 AND p.tenant_id = $2 ${roleCheck}`,
        baseParams
      )
      if (patient.rows.length === 0) {
        const err = new Error('Paciente não encontrado') as any
        err.statusCode = 404
        throw err
      }

      // 2) Protocolos (todos os status, no período)
      const protocols = await client.query(
        `SELECT tp.*, tpl.domain as library_domain, tpl.description as library_description
         FROM tdah_protocols tp
         LEFT JOIN tdah_protocol_library tpl ON tpl.code = tp.code
         WHERE tp.patient_id = $1 AND tp.tenant_id = $2
         ORDER BY tp.status, tp.code`,
        [patientId, tenantId]
      )

      // 3) Sessões no período
      const sessions = await client.query(
        `SELECT s.*
         FROM tdah_sessions s
         WHERE s.patient_id = $1 AND s.tenant_id = $2
           AND s.scheduled_at >= $3::date AND s.scheduled_at <= ($4::date + INTERVAL '1 day')
         ORDER BY s.scheduled_at`,
        [patientId, tenantId, start, end]
      )

      // 4) Scores CSO-TDAH no período
      const scores = await client.query(
        `SELECT sn.*, s.session_number, s.session_context
         FROM tdah_snapshots sn
         JOIN tdah_sessions s ON s.id = sn.session_id
         WHERE sn.patient_id = $1 AND sn.tenant_id = $2
           AND sn.snapshot_at >= $3::date AND sn.snapshot_at <= ($4::date + INTERVAL '1 day')
         ORDER BY sn.snapshot_at`,
        [patientId, tenantId, start, end]
      )

      // 5) DRCs no período
      const drcs = await client.query(
        `SELECT d.*, tp.code as protocol_code
         FROM tdah_drc d
         LEFT JOIN tdah_protocols tp ON tp.id = d.protocol_id
         WHERE d.patient_id = $1 AND d.tenant_id = $2
           AND d.drc_date >= $3::date AND d.drc_date <= $4::date
         ORDER BY d.drc_date`,
        [patientId, tenantId, start, end]
      )

      // 6) Resumo de sessões
      const sessionSummary = {
        total: sessions.rows.length,
        completed: sessions.rows.filter((s: any) => s.status === 'completed').length,
        cancelled: sessions.rows.filter((s: any) => s.status === 'cancelled').length,
        clinical: sessions.rows.filter((s: any) => s.session_context === 'clinical').length,
        home: sessions.rows.filter((s: any) => s.session_context === 'home').length,
        school: sessions.rows.filter((s: any) => s.session_context === 'school').length,
        avg_duration: 0,
      }
      const completedWithDuration = sessions.rows.filter((s: any) => s.status === 'completed' && s.duration_minutes)
      if (completedWithDuration.length > 0) {
        sessionSummary.avg_duration = Math.round(
          completedWithDuration.reduce((sum: number, s: any) => sum + Number(s.duration_minutes), 0) / completedWithDuration.length
        )
      }

      // 7) Resumo de scores (primeiro e último do período)
      const scoreRows = scores.rows
      const scoreSummary = scoreRows.length > 0 ? {
        first_score: Number(scoreRows[0].final_score),
        first_band: scoreRows[0].final_band,
        last_score: Number(scoreRows[scoreRows.length - 1].final_score),
        last_band: scoreRows[scoreRows.length - 1].final_band,
        delta: Number(scoreRows[scoreRows.length - 1].final_score) - Number(scoreRows[0].final_score),
        count: scoreRows.length,
      } : null

      // 8) Resumo DRC
      const drcRows = drcs.rows
      const drcSummary = drcRows.length > 0 ? {
        total: drcRows.length,
        goals_met: drcRows.filter((d: any) => d.goal_met === true).length,
        goals_not_met: drcRows.filter((d: any) => d.goal_met === false).length,
        goals_pending: drcRows.filter((d: any) => d.goal_met === null).length,
        reviewed: drcRows.filter((d: any) => d.reviewed_at !== null).length,
        success_rate: Math.round(
          (drcRows.filter((d: any) => d.goal_met === true).length /
            drcRows.filter((d: any) => d.goal_met !== null).length) * 100
        ) || 0,
      } : null

      return {
        patient: patient.rows[0],
        period: { start, end },
        protocols: protocols.rows,
        sessions: sessions.rows,
        session_summary: sessionSummary,
        scores: scoreRows,
        score_summary: scoreSummary,
        drcs: drcRows,
        drc_summary: drcSummary,
        engine_version: 'CSO-TDAH v1.0.0',
        generated_at: new Date().toISOString(),
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
