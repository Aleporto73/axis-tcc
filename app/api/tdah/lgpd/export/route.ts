import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'
import { PoolClient } from 'pg'

// =====================================================
// AXIS TDAH — Exportação LGPD (Art. 18, Lei 13.709/2018)
// Conforme AXIS TDAH BIBLE v2.5
//
// Exporta todos os dados TDAH do tenant em JSON.
// Acesso: admin ou supervisor.
// =====================================================

let _spCounter = 0
async function safeQuery(client: PoolClient, query: string, params: any[], label: string) {
  const sp = `sp_tdah_${label.replace(/[^a-z0-9_]/gi, '_')}_${++_spCounter}`
  try {
    await client.query(`SAVEPOINT ${sp}`)
    const res = await client.query(query, params)
    await client.query(`RELEASE SAVEPOINT ${sp}`)
    return res.rows
  } catch (err: any) {
    console.warn(`[LGPD TDAH Export] Falha em ${label}: ${err.message}`)
    try { await client.query(`ROLLBACK TO SAVEPOINT ${sp}`) } catch {}
    return []
  }
}

async function fetchTDAHData(client: PoolClient, tenantId: string) {
  const tenant = await safeQuery(client,
    `SELECT id, name, plan_tier FROM tenants WHERE id = $1`, [tenantId], 'tenants')

  const profiles = await safeQuery(client,
    `SELECT id, role, name, email, crp, crp_uf, is_active, created_at
     FROM profiles WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'profiles')

  const patients = await safeQuery(client,
    `SELECT id, name, birth_date, gender, diagnosis, cid_code, support_level,
            school_name, school_contact, teacher_name, teacher_email,
            clinical_notes, audhd_layer_status, status, created_by, created_at
     FROM tdah_patients WHERE tenant_id = $1 ORDER BY name`, [tenantId], 'tdah_patients')

  const guardians = await safeQuery(client,
    `SELECT id, patient_id, name, email, phone, relationship, is_primary, is_active, created_at
     FROM tdah_guardians WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'tdah_guardians')

  const protocols = await safeQuery(client,
    `SELECT tp.id, tp.patient_id, tp.library_id, tp.status,
            tp.started_at, tp.mastered_at, tp.archived_at,
            tp.audhd_adaptation_notes, tp.created_at,
            pl.code, pl.name AS protocol_name, pl.block
     FROM tdah_protocols tp
     LEFT JOIN tdah_protocol_library pl ON pl.id = tp.library_id
     WHERE tp.tenant_id = $1 ORDER BY tp.created_at`, [tenantId], 'tdah_protocols')

  const sessions = await safeQuery(client,
    `SELECT ts.id, ts.patient_id, ts.session_number, ts.session_context,
            ts.status, ts.scheduled_at, ts.started_at, ts.ended_at,
            ts.duration_minutes, ts.notes, ts.created_by, ts.created_at,
            p.name AS patient_name
     FROM tdah_sessions ts
     LEFT JOIN tdah_patients p ON p.id = ts.patient_id
     WHERE ts.tenant_id = $1 ORDER BY ts.scheduled_at`, [tenantId], 'tdah_sessions')

  const observations = await safeQuery(client,
    `SELECT id, session_id, protocol_id, task_description,
            sas_score, pis_level, bss_level, exr_level,
            sensory_profile, transition_response, rig_state, rig_severity,
            notes, created_at
     FROM tdah_observations WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'tdah_observations')

  const snapshots = await safeQuery(client,
    `SELECT id, session_id, patient_id, engine_version,
            final_score, core_score, audhd_score,
            base_metrics, executive_metrics, audhd_metrics,
            flags, band, source_contexts, weights_used,
            created_at
     FROM tdah_snapshots WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'tdah_snapshots')

  const drcEntries = await safeQuery(client,
    `SELECT id, patient_id, protocol_id, goal_date, goal_description,
            goal_met, score, filled_by, teacher_notes,
            reviewed_by, reviewed_at, review_notes, created_at
     FROM tdah_drc_entries WHERE tenant_id = $1 ORDER BY goal_date`, [tenantId], 'tdah_drc_entries')

  const audhdLog = await safeQuery(client,
    `SELECT id, patient_id, previous_status, new_status,
            changed_by, reason, engine_version, created_at
     FROM tdah_audhd_log WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'tdah_audhd_log')

  const summaries = await safeQuery(client,
    `SELECT id, session_id, content, status,
            approved_by, approved_at, sent_at, created_at
     FROM session_summaries WHERE tenant_id = $1 AND source_module = 'tdah'
     ORDER BY created_at`, [tenantId], 'session_summaries_tdah')

  const auditLogs = await safeQuery(client,
    `SELECT id, user_id, actor, action, entity_type, entity_id, metadata, created_at
     FROM axis_audit_logs WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'axis_audit_logs')

  return {
    tenant: tenant[0] || null,
    profiles, patients, guardians, protocols, sessions,
    observations, snapshots, drcEntries, audhdLog,
    summaries, auditLogs,
  }
}

/**
 * GET /api/tdah/lgpd/export
 * Exporta todos os dados TDAH do tenant em JSON.
 */
export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get('format') || 'json'

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)
      const { client, tenantId, userId, profileId, role } = ctx

      // Audit log
      try {
        await client.query(
          `INSERT INTO axis_audit_logs
            (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, $3, 'LGPD_EXPORT_REQUESTED', 'tenant', $4, NOW())`,
          [tenantId, userId, userId, JSON.stringify({
            requested_by_profile: profileId,
            requested_by_role: role,
            module: 'tdah',
            format,
          })]
        )
      } catch { /* non-critical */ }

      return await fetchTDAHData(client, tenantId)
    })

    const clinicName = result.tenant?.name || 'Clínica'
    const dateStr = new Date().toISOString().split('T')[0]

    const jsonResult = {
      _meta: {
        export_version: '1.0',
        exported_at: new Date().toISOString(),
        engine: 'cso_tdah',
        bible_version: '2.5',
        lgpd: {
          base_legal: 'Art. 18, Lei 13.709/2018 (LGPD)',
          controlador: clinicName,
          operador: 'Psiform Tecnologia (AXIS TDAH)',
          finalidade: 'Portabilidade de dados mediante solicitação do titular',
        },
      },
      counts: {
        profiles: result.profiles.length,
        patients: result.patients.length,
        guardians: result.guardians.length,
        protocols: result.protocols.length,
        sessions: result.sessions.length,
        observations: result.observations.length,
        snapshots: result.snapshots.length,
        drc_entries: result.drcEntries.length,
        audhd_log: result.audhdLog.length,
        summaries: result.summaries.length,
        audit_logs: result.auditLogs.length,
      },
      ...result,
    }

    const filename = `axis_tdah_export_${dateStr}.json`
    return new NextResponse(JSON.stringify(jsonResult, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-AXIS-Export-Version': '1.0',
        'X-AXIS-Module': 'tdah',
      },
    })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
