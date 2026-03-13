import { NextResponse } from 'next/server'
import { withTenant, TenantContext } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - Dashboard API
// KPIs agregados: pacientes, sessões, protocolos, CSO-TDAH
// admin/supervisor: visão clínica. terapeuta: filtrado.
// Sem Redis por enquanto (simplicidade v1)
// =====================================================

async function fetchKPIs(ctx: TenantContext) {
  const { client, tenantId } = ctx

  // Subquery para filtrar pacientes por role
  const patientFilter = ctx.role === 'terapeuta'
    ? `AND p.created_by = $2`
    : ''

  const baseParams: any[] = ctx.role === 'terapeuta'
    ? [tenantId, ctx.profileId]
    : [tenantId]

  // Sessões usam patient_id filtrado (não têm therapist_id direto como ABA)
  const sessionPatientFilter = ctx.role === 'terapeuta'
    ? `AND s.patient_id IN (SELECT id FROM tdah_patients WHERE tenant_id = $1 AND created_by = $2)`
    : ''

  // ── KPIs básicos ──
  const metrics = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM tdah_patients p WHERE p.tenant_id = $1 AND p.status = 'active' ${patientFilter})::int
        AS total_patients,
      (SELECT COUNT(*) FROM tdah_patients p WHERE p.tenant_id = $1 AND p.audhd_layer_status != 'off' ${patientFilter})::int
        AS audhd_active,
      (SELECT COUNT(*) FROM tdah_sessions s WHERE s.tenant_id = $1 AND s.status = 'completed'
        AND s.ended_at >= CURRENT_DATE - INTERVAL '30 days' ${sessionPatientFilter})::int
        AS sessions_month,
      (SELECT COUNT(*) FROM tdah_sessions s WHERE s.tenant_id = $1 AND s.status = 'scheduled'
        AND DATE(s.scheduled_at) = CURRENT_DATE ${sessionPatientFilter})::int
        AS sessions_today,
      (SELECT COUNT(*) FROM tdah_protocols tp WHERE tp.tenant_id = $1 AND tp.status = 'active'
        AND tp.patient_id IN (SELECT id FROM tdah_patients p WHERE p.tenant_id = $1 ${patientFilter}))::int
        AS active_protocols,
      (SELECT COUNT(*) FROM tdah_protocols tp WHERE tp.tenant_id = $1 AND tp.status = 'mastered'
        AND tp.patient_id IN (SELECT id FROM tdah_patients p WHERE p.tenant_id = $1 ${patientFilter}))::int
        AS mastered_protocols
  `, baseParams)

  // ── KPIs CSO-TDAH ──
  const csoMetrics = await client.query(`
    SELECT
      (SELECT ROUND(AVG(sn.final_score))
       FROM tdah_snapshots sn
       INNER JOIN (
         SELECT patient_id, MAX(snapshot_at) AS last_at
         FROM tdah_snapshots
         WHERE tenant_id = $1
           AND patient_id IN (SELECT id FROM tdah_patients p WHERE p.tenant_id = $1 ${patientFilter})
         GROUP BY patient_id
       ) latest ON sn.patient_id = latest.patient_id AND sn.snapshot_at = latest.last_at
       WHERE sn.tenant_id = $1)::int
        AS avg_cso,

      (SELECT COUNT(DISTINCT sn.patient_id)
       FROM tdah_snapshots sn
       INNER JOIN (
         SELECT patient_id, MAX(snapshot_at) AS last_at
         FROM tdah_snapshots
         WHERE tenant_id = $1
           AND patient_id IN (SELECT id FROM tdah_patients p WHERE p.tenant_id = $1 ${patientFilter})
         GROUP BY patient_id
       ) latest ON sn.patient_id = latest.patient_id AND sn.snapshot_at = latest.last_at
       WHERE sn.tenant_id = $1 AND sn.final_band = 'critico')::int
        AS patients_critical
  `, baseParams)

  // ── KPIs contextuais (tricontextual) ──
  const contextMetrics = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM tdah_sessions s WHERE s.tenant_id = $1 AND s.session_context = 'clinical'
        AND s.status = 'completed' AND s.ended_at >= CURRENT_DATE - INTERVAL '30 days' ${sessionPatientFilter})::int
        AS sessions_clinical,
      (SELECT COUNT(*) FROM tdah_sessions s WHERE s.tenant_id = $1 AND s.session_context = 'home'
        AND s.status = 'completed' AND s.ended_at >= CURRENT_DATE - INTERVAL '30 days' ${sessionPatientFilter})::int
        AS sessions_home,
      (SELECT COUNT(*) FROM tdah_sessions s WHERE s.tenant_id = $1 AND s.session_context = 'school'
        AND s.status = 'completed' AND s.ended_at >= CURRENT_DATE - INTERVAL '30 days' ${sessionPatientFilter})::int
        AS sessions_school
  `, baseParams)

  // ── KPIs avançados ──
  const advanced = await client.query(`
    SELECT
      (SELECT COALESCE(ROUND(AVG(s.duration_minutes)), 0)
       FROM tdah_sessions s WHERE s.tenant_id = $1 AND s.status = 'completed'
        AND s.duration_minutes IS NOT NULL ${sessionPatientFilter})::int
        AS avg_session_duration,
      (SELECT COUNT(*) FROM tdah_protocols tp WHERE tp.tenant_id = $1 AND tp.status = 'regression'
        AND tp.patient_id IN (SELECT id FROM tdah_patients p WHERE p.tenant_id = $1 ${patientFilter}))::int
        AS protocols_regression,
      (SELECT COUNT(*) FROM tdah_sessions s WHERE s.tenant_id = $1 AND s.status = 'completed' ${sessionPatientFilter})::int
        AS total_sessions_completed
  `, baseParams)

  const m = metrics.rows[0]
  const c = csoMetrics.rows[0]
  const cx = contextMetrics.rows[0]
  const a = advanced.rows[0]

  return {
    total_patients: m.total_patients,
    audhd_active: m.audhd_active,
    sessions_month: m.sessions_month,
    sessions_today: m.sessions_today,
    active_protocols: m.active_protocols,
    mastered_protocols: m.mastered_protocols,
    avg_cso: c.avg_cso || null,
    patients_critical: c.patients_critical || 0,
    sessions_clinical: cx.sessions_clinical,
    sessions_home: cx.sessions_home,
    sessions_school: cx.sessions_school,
    avg_session_duration: a.avg_session_duration || 0,
    protocols_regression: a.protocols_regression || 0,
    total_sessions_completed: a.total_sessions_completed || 0,
    engine_version: 'CSO-TDAH v1.0.0',
    _scope: ctx.role === 'terapeuta' ? 'personal' as const : 'clinic' as const,
    _role: ctx.role,
  }
}

export async function GET() {
  try {
    return await withTenant(async (ctx) => {
      const data = await fetchKPIs(ctx)
      return NextResponse.json(data)
    })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
