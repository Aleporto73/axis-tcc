import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Alertas Clínicos
// Detecta situações que requerem atenção do terapeuta:
// 1. Pacientes em faixa CRÍTICA (último CSO)
// 2. Protocolos em regressão
// 3. Pacientes sem sessão há > 14 dias
// 4. DRCs pendentes de revisão clínica
// 5. Queda acentuada no score (delta < -10 últimas 2)
// =====================================================

interface Alert {
  type: 'critical_score' | 'regression' | 'no_session' | 'drc_pending' | 'score_drop'
  severity: 'high' | 'medium' | 'low'
  patient_id: string
  patient_name: string
  message: string
  detail?: string
  created_at: string
}

export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      let roleClause = ''
      const params: any[] = [tenantId]
      if (ctx.role === 'terapeuta') {
        params.push(ctx.profileId)
        roleClause = `AND p.created_by = $${params.length}`
      }

      const alerts: Alert[] = []
      const now = new Date().toISOString()

      // 1) Pacientes com último score em faixa CRÍTICA
      const critical = await client.query(
        `SELECT DISTINCT ON (sn.patient_id)
           sn.patient_id, p.name as patient_name, sn.final_score, sn.final_band, sn.snapshot_at
         FROM tdah_snapshots sn
         JOIN tdah_patients p ON p.id = sn.patient_id AND p.tenant_id = sn.tenant_id
         WHERE sn.tenant_id = $1 AND p.status = 'active' AND p.deleted_at IS NULL
           ${roleClause}
         ORDER BY sn.patient_id, sn.snapshot_at DESC`,
        params
      )

      for (const row of critical.rows) {
        if (row.final_band === 'critico') {
          alerts.push({
            type: 'critical_score',
            severity: 'high',
            patient_id: row.patient_id,
            patient_name: row.patient_name,
            message: `Score CSO em faixa CRÍTICA: ${Number(row.final_score).toFixed(0)}`,
            detail: `Último snapshot em ${new Date(row.snapshot_at).toLocaleDateString('pt-BR')}`,
            created_at: now,
          })
        }
      }

      // 2) Protocolos em regressão
      const regressions = await client.query(
        `SELECT tp.code, tp.title, tp.patient_id, p.name as patient_name
         FROM tdah_protocols tp
         JOIN tdah_patients p ON p.id = tp.patient_id AND p.tenant_id = tp.tenant_id
         WHERE tp.tenant_id = $1 AND tp.status = 'regression'
           AND p.status = 'active' AND p.deleted_at IS NULL
           ${roleClause}`,
        params
      )

      for (const row of regressions.rows) {
        alerts.push({
          type: 'regression',
          severity: 'high',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          message: `Protocolo ${row.code} em regressão`,
          detail: row.title,
          created_at: now,
        })
      }

      // 3) Pacientes sem sessão há > 14 dias
      const noSession = await client.query(
        `SELECT p.id as patient_id, p.name as patient_name,
           MAX(s.scheduled_at) as last_session
         FROM tdah_patients p
         LEFT JOIN tdah_sessions s ON s.patient_id = p.id AND s.tenant_id = p.tenant_id AND s.status = 'completed'
         WHERE p.tenant_id = $1 AND p.status = 'active' AND p.deleted_at IS NULL
           ${roleClause}
         GROUP BY p.id, p.name
         HAVING MAX(s.scheduled_at) < NOW() - INTERVAL '14 days' OR MAX(s.scheduled_at) IS NULL`,
        params
      )

      for (const row of noSession.rows) {
        const lastDate = row.last_session
          ? new Date(row.last_session).toLocaleDateString('pt-BR')
          : null
        alerts.push({
          type: 'no_session',
          severity: 'medium',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          message: lastDate ? `Sem sessão há mais de 14 dias` : 'Nenhuma sessão registrada',
          detail: lastDate ? `Última sessão: ${lastDate}` : undefined,
          created_at: now,
        })
      }

      // 4) DRCs pendentes de revisão clínica (> 3 dias sem review)
      const drcPending = await client.query(
        `SELECT d.id, d.patient_id, p.name as patient_name, d.goal_description, d.drc_date
         FROM tdah_drc d
         JOIN tdah_patients p ON p.id = d.patient_id AND p.tenant_id = d.tenant_id
         WHERE d.tenant_id = $1 AND d.reviewed_at IS NULL
           AND d.drc_date < CURRENT_DATE - INTERVAL '3 days'
           AND p.status = 'active' AND p.deleted_at IS NULL
           ${roleClause}
         ORDER BY d.drc_date
         LIMIT 20`,
        params
      )

      for (const row of drcPending.rows) {
        alerts.push({
          type: 'drc_pending',
          severity: 'low',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          message: `DRC pendente de revisão`,
          detail: `${row.goal_description?.substring(0, 60) || 'Meta'} — ${new Date(row.drc_date).toLocaleDateString('pt-BR')}`,
          created_at: now,
        })
      }

      // 5) Queda acentuada de score (delta < -10 entre últimas 2 snapshots)
      const drops = await client.query(
        `WITH ranked AS (
           SELECT sn.patient_id, p.name as patient_name, sn.final_score, sn.snapshot_at,
             ROW_NUMBER() OVER (PARTITION BY sn.patient_id ORDER BY sn.snapshot_at DESC) as rn
           FROM tdah_snapshots sn
           JOIN tdah_patients p ON p.id = sn.patient_id AND p.tenant_id = sn.tenant_id
           WHERE sn.tenant_id = $1 AND p.status = 'active' AND p.deleted_at IS NULL
             ${roleClause}
         )
         SELECT a.patient_id, a.patient_name,
           a.final_score as current_score, b.final_score as previous_score,
           (a.final_score - b.final_score) as delta
         FROM ranked a
         JOIN ranked b ON b.patient_id = a.patient_id AND b.rn = 2
         WHERE a.rn = 1 AND (a.final_score - b.final_score) < -10`,
        params
      )

      for (const row of drops.rows) {
        // Não duplicar se já tem alerta de score crítico para o mesmo paciente
        if (alerts.some(a => a.type === 'critical_score' && a.patient_id === row.patient_id)) continue
        alerts.push({
          type: 'score_drop',
          severity: 'medium',
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          message: `Queda de ${Math.abs(Number(row.delta)).toFixed(0)} pontos no CSO`,
          detail: `${Number(row.previous_score).toFixed(0)} → ${Number(row.current_score).toFixed(0)}`,
          created_at: now,
        })
      }

      // Ordenar por severidade
      const severityOrder = { high: 0, medium: 1, low: 2 }
      alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

      return { alerts, total: alerts.length }
    })

    return NextResponse.json(result)
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
