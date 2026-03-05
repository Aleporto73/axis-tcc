import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'
import { PoolClient } from 'pg'

// =====================================================
// AXIS ABA — Exportação LGPD (Art. 18, Lei 13.709/2018)
// Conforme AXIS ABA Bible v2.6.1
// Acesso: admin ou supervisor (Controladores do lado clínica)
// Retorno: JSON estruturado com TODOS os dados do tenant
//
// v2.0: Queries resilientes — cada tabela em try/catch
//       para não quebrar se coluna/tabela não existir
// =====================================================

// Helper: query resiliente com SAVEPOINT — se tabela/coluna não existir, retorna []
// Usa SAVEPOINT para não corromper a transação principal do withTenant
let _spCounter = 0
async function safeQuery(client: PoolClient, query: string, params: any[], label: string) {
  const sp = `sp_${label.replace(/[^a-z0-9_]/gi, '_')}_${++_spCounter}`
  try {
    await client.query(`SAVEPOINT ${sp}`)
    const res = await client.query(query, params)
    await client.query(`RELEASE SAVEPOINT ${sp}`)
    return res.rows
  } catch (err: any) {
    console.warn(`[LGPD Export] Falha em ${label}: ${err.message}`)
    try { await client.query(`ROLLBACK TO SAVEPOINT ${sp}`) } catch {}
    return []
  }
}

export async function GET() {
  try {
    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      const { client, tenantId, userId, profileId, role } = ctx

      // Audit log ANTES de exportar (non-critical)
      try {
        await client.query(
          `INSERT INTO axis_audit_logs
            (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, $3, 'LGPD_EXPORT_REQUESTED', 'tenant', $4, NOW())`,
          [tenantId, userId, userId, JSON.stringify({ requested_by_profile: profileId, requested_by_role: role, export_version: '2.0' })]
        )
      } catch { /* non-critical */ }

      // === Queries resilientes — cada uma independente ===

      const tenant = await safeQuery(client,
        `SELECT * FROM tenants WHERE id = $1`, [tenantId], 'tenants')

      const profiles = await safeQuery(client,
        `SELECT id, role, name, email, specialty, is_active, created_at, updated_at
         FROM profiles WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'profiles')

      const learners = await safeQuery(client,
        `SELECT id, name, birth_date, diagnosis, cid_code, support_level,
                notes, is_active, created_at, updated_at
         FROM learners WHERE tenant_id = $1 ORDER BY name`, [tenantId], 'learners')

      const assignments = await safeQuery(client,
        `SELECT lt.id, lt.learner_id, lt.profile_id, lt.is_primary, lt.assigned_at,
                p.name AS therapist_name, l.name AS learner_name
         FROM learner_therapists lt
         JOIN profiles p ON p.id = lt.profile_id
         JOIN learners l ON l.id = lt.learner_id
         WHERE lt.tenant_id = $1 ORDER BY lt.assigned_at`, [tenantId], 'learner_therapists')

      const guardians = await safeQuery(client,
        `SELECT id, learner_id, name, relationship, email, phone, is_active, created_at
         FROM guardians WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'guardians')

      const consents = await safeQuery(client,
        `SELECT id, guardian_id, learner_id, consent_type, consent_version,
                ip_address, accepted_at, revoked_at
         FROM guardian_consents WHERE tenant_id = $1 ORDER BY accepted_at`, [tenantId], 'guardian_consents')

      const peiPlans = await safeQuery(client,
        `SELECT id, learner_id, title, period_start, period_end, status, created_at
         FROM pei_plans WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'pei_plans')

      const peiGoals = await safeQuery(client,
        `SELECT id, pei_plan_id, title, domain, description, status, created_at
         FROM pei_goals WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'pei_goals')

      const protocols = await safeQuery(client,
        `SELECT lp.id, lp.learner_id, lp.title, lp.domain, lp.objective,
                lp.status, lp.ebp_practice_id, ep.name AS ebp_name,
                lp.mastery_criteria_pct, lp.generalization_status, lp.regression_count,
                lp.activated_at, lp.mastered_at, lp.created_at
         FROM learner_protocols lp
         LEFT JOIN ebp_practices ep ON ep.id = lp.ebp_practice_id
         WHERE lp.tenant_id = $1 ORDER BY lp.created_at`, [tenantId], 'learner_protocols')

      const sessions = await safeQuery(client,
        `SELECT id, learner_id, therapist_id, scheduled_at,
                started_at, ended_at, status, location,
                duration_minutes, notes, created_at
         FROM sessions_aba WHERE tenant_id = $1 ORDER BY scheduled_at`, [tenantId], 'sessions_aba')

      const targets = await safeQuery(client,
        `SELECT id, session_id, protocol_id, target_name,
                trials_correct, trials_total, prompt_level, score_pct,
                notes, created_at
         FROM session_targets WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'session_targets')

      const behaviors = await safeQuery(client,
        `SELECT id, session_id, behavior_type, antecedent, behavior, consequence,
                intensity, duration_seconds, recorded_at, created_at
         FROM session_behaviors WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'session_behaviors')

      const snapshots = await safeQuery(client,
        `SELECT id, session_id, learner_id, cso_aba, sas, pis, bss, tcm,
                cso_band, engine_version, created_at
         FROM session_snapshots WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'session_snapshots')

      const clinicalStates = await safeQuery(client,
        `SELECT id, learner_id, cso_aba, sas, pis, bss, tcm,
                cso_band, engine_version, created_at
         FROM clinical_states_aba WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'clinical_states_aba')

      const genProbes = await safeQuery(client,
        `SELECT * FROM generalization_probes WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'generalization_probes')

      const maintProbes = await safeQuery(client,
        `SELECT * FROM maintenance_probes WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'maintenance_probes')

      const summaries = await safeQuery(client,
        `SELECT id, session_id, learner_id, content, status,
                approved_by, approved_at, sent_at, created_at
         FROM session_summaries WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'session_summaries')

      const reports = await safeQuery(client,
        `SELECT * FROM report_snapshots WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'report_snapshots')

      const portalAccess = await safeQuery(client,
        `SELECT * FROM family_portal_access WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'family_portal_access')

      const emailLogs = await safeQuery(client,
        `SELECT * FROM email_logs WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'email_logs')

      const notifications = await safeQuery(client,
        `SELECT * FROM notifications WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'notifications')

      const auditLogs = await safeQuery(client,
        `SELECT id, user_id, actor, action, entity_type, entity_id, metadata, created_at
         FROM axis_audit_logs WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'axis_audit_logs')

      return {
        _meta: {
          export_version: '2.0',
          exported_at: new Date().toISOString(),
          exported_by: { profile_id: profileId, role, clerk_user_id: userId },
          engine: 'axis_aba',
          bible_version: '2.6.1',
          lgpd: {
            base_legal: 'Art. 18, Lei 13.709/2018 (LGPD)',
            controlador: tenant[0]?.name || 'Clínica',
            operador: 'Psiform Tecnologia (AXIS ABA)',
            finalidade: 'Portabilidade de dados mediante solicitação do titular',
          },
          retention_policy: {
            dados_clinicos: { periodo: '7 anos', base: 'CFM/CRP' },
            relatorios_gerados: { periodo: '7 anos', base: 'CFM/CRP' },
            logs_auditoria: { periodo: '5 anos', base: 'Compliance' },
            portal_familia: { periodo: 'Enquanto vínculo ativo', base: 'Consentimento' },
            email_logs: { periodo: '5 anos', base: 'Compliance' },
            notifications: { periodo: '1 ano', base: 'Operacional' },
          },
          record_counts: {
            profiles: profiles.length, learners: learners.length,
            guardians: guardians.length, protocols: protocols.length,
            sessions: sessions.length, targets: targets.length,
            behaviors: behaviors.length, snapshots: snapshots.length,
            clinical_states: clinicalStates.length, summaries: summaries.length,
            audit_logs: auditLogs.length,
          },
        },
        tenant: tenant[0] || null,
        profiles, learners, learner_therapist_assignments: assignments,
        guardians, guardian_consents: consents,
        pei_plans: peiPlans, pei_goals: peiGoals,
        protocols, sessions, session_targets: targets,
        session_behaviors: behaviors, session_snapshots: snapshots,
        clinical_states: clinicalStates,
        generalization_probes: genProbes, maintenance_probes: maintProbes,
        session_summaries: summaries, report_snapshots: reports,
        family_portal_access: portalAccess,
        email_logs: emailLogs, notifications,
        audit_logs: auditLogs,
      }
    })

    const filename = `axis_aba_export_${new Date().toISOString().split('T')[0]}.json`

    return new NextResponse(JSON.stringify(result, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-AXIS-Export-Version': '2.0',
      },
    })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
