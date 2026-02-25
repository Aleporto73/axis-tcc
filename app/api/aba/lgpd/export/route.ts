import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA — Exportação LGPD (Art. 18, Lei 13.709/2018)
// Conforme AXIS ABA Bible v2.6.1:
//
//   S13.1 LGPD — Portabilidade mediante solicitação
//     "Psiform (Operador) processa dados conforme instruções
//      da Clínica (Controlador)"
//
//   S13.2 Política de Retenção:
//     Dados clínicos     → 7 anos (CFM/CRP)
//     Relatórios gerados → 7 anos (CFM/CRP)
//     Logs de auditoria  → 5 anos (Compliance)
//     Portal família     → Enquanto vínculo ativo (Consentimento)
//     email_logs         → 5 anos (Compliance)
//     notifications      → 1 ano (Operacional)
//
//   S13.3 axis_audit_logs — Toda ação é auditável
//   S7 Snapshot Imutável — Append-only, sem overwrite
//   S12.1 Engine Version Lock — engine_version em cada registro
//   S24 Tabelas Exclusivas ABA — Lista completa de entidades
//   S23 Tabelas Compartilhadas — profiles, notifications, etc.
//
// Acesso: admin ou supervisor (Controladores do lado clínica)
// Retorno: JSON estruturado com TODOS os dados do tenant
// =====================================================

export async function GET() {
  try {
    const result = await withTenant(async (ctx) => {
      // Apenas admin/supervisor podem exportar dados (Art. 18 LGPD — Controlador)
      requireAdminOrSupervisor(ctx)

      const { client, tenantId, userId, profileId, role } = ctx

      // Registrar solicitação no audit log ANTES de exportar
      // Conforme Bible S13.3: "Toda ação é auditável"
      await client.query(
        `INSERT INTO axis_audit_logs
          (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
         VALUES ($1, $2, $3, 'LGPD_EXPORT_REQUESTED', 'tenant', $4, NOW())`,
        [
          tenantId,
          userId,
          userId,
          JSON.stringify({
            requested_by_profile: profileId,
            requested_by_role: role,
            export_version: '1.0',
            engine: 'axis_aba',
          })
        ]
      )

      // ==============================================
      // 1. PERFIL DA ORGANIZAÇÃO (S23: companies/tenants)
      // ==============================================
      const tenantData = await client.query(
        `SELECT id, name, email, plan, created_at
         FROM tenants WHERE id = $1`,
        [tenantId]
      )

      // ==============================================
      // 2. MEMBROS DA EQUIPE (S23: profiles)
      // ==============================================
      const profilesData = await client.query(
        `SELECT id, role, name, email, crp, crp_uf, is_active, created_at, updated_at
         FROM profiles WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      // ==============================================
      // 3. APRENDIZES (S24: learners)
      // ==============================================
      const learnersData = await client.query(
        `SELECT id, name, birth_date, diagnosis, cid_code, support_level,
                school, notes, is_active, created_at, updated_at, deleted_at
         FROM learners WHERE tenant_id = $1
         ORDER BY name`,
        [tenantId]
      )

      // ==============================================
      // 4. VÍNCULOS TERAPEUTA-APRENDIZ (learner_therapists)
      // ==============================================
      const assignmentsData = await client.query(
        `SELECT lt.id, lt.learner_id, lt.profile_id, lt.is_primary, lt.assigned_at,
                p.name AS therapist_name, l.name AS learner_name
         FROM learner_therapists lt
         JOIN profiles p ON p.id = lt.profile_id
         JOIN learners l ON l.id = lt.learner_id
         WHERE lt.tenant_id = $1
         ORDER BY lt.assigned_at`,
        [tenantId]
      )

      // ==============================================
      // 5. RESPONSÁVEIS (S24: guardians)
      // ==============================================
      const guardiansData = await client.query(
        `SELECT id, learner_id, name, relationship, email, phone,
                is_active, created_at
         FROM guardians WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      // ==============================================
      // 6. CONSENTIMENTOS (S24.1: guardian_consents)
      // ==============================================
      const consentsData = await client.query(
        `SELECT id, guardian_id, learner_id, consent_type, consent_version,
                ip_address, accepted_at, revoked_at
         FROM guardian_consents WHERE tenant_id = $1
         ORDER BY accepted_at`,
        [tenantId]
      )

      // ==============================================
      // 7. PEI — PLANOS EDUCACIONAIS (S24: pei_plans + pei_goals)
      // ==============================================
      const peiPlansData = await client.query(
        `SELECT id, learner_id, title, period_start, period_end,
                status, created_at
         FROM pei_plans WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      const peiGoalsData = await client.query(
        `SELECT id, pei_plan_id, title, domain, description,
                status, created_at
         FROM pei_goals WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      // ==============================================
      // 8. PROTOCOLOS (S24: learner_protocols)
      // Inclui protocol_engine_version conforme S12.1 Engine Version Lock
      // ==============================================
      const protocolsData = await client.query(
        `SELECT lp.id, lp.learner_id, lp.title, lp.domain, lp.objective,
                lp.status, lp.ebp_practice_id, ep.name AS ebp_name,
                lp.mastery_criteria_pct, lp.mastery_criteria_sessions,
                lp.mastery_criteria_trials, lp.measurement_type,
                lp.generalization_status, lp.regression_count,
                lp.protocol_engine_version, lp.created_by,
                lp.activated_at, lp.mastered_at, lp.created_at
         FROM learner_protocols lp
         LEFT JOIN ebp_practices ep ON ep.id = lp.ebp_practice_id
         WHERE lp.tenant_id = $1
         ORDER BY lp.created_at`,
        [tenantId]
      )

      // ==============================================
      // 9. SESSÕES (S24: sessions_aba)
      // ==============================================
      const sessionsData = await client.query(
        `SELECT id, learner_id, therapist_id, scheduled_at,
                started_at, ended_at, status, location,
                duration_minutes, notes, google_event_id,
                google_meet_link, patient_response, created_at
         FROM sessions_aba WHERE tenant_id = $1
         ORDER BY scheduled_at`,
        [tenantId]
      )

      // ==============================================
      // 10. ALVOS POR SESSÃO (S24: session_targets)
      // ==============================================
      const targetsData = await client.query(
        `SELECT id, session_id, protocol_id, target_name,
                trials_correct, trials_total, prompt_level, score,
                notes, created_at
         FROM session_targets WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      // ==============================================
      // 11. COMPORTAMENTOS ABC (S24: session_behaviors)
      // ==============================================
      const behaviorsData = await client.query(
        `SELECT id, session_id, antecedent, behavior, consequence,
                intensity, function_hypothesis, timestamp, created_at
         FROM session_behaviors WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      // ==============================================
      // 12. SNAPSHOTS IMUTÁVEIS (S7 + S24: session_snapshots)
      // Conforme Bible: "Sessão fechada é IMUTÁVEL"
      // engine_version conforme S12.1
      // ==============================================
      const snapshotsData = await client.query(
        `SELECT id, session_id, learner_id, cso_aba, sas, pis, bss, tcm,
                cso_band, engine_version, created_at
         FROM session_snapshots WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      // ==============================================
      // 13. ESTADOS CLÍNICOS CSO-ABA (S2 + S24: clinical_states_aba)
      // Conforme Bible: "append-only — sem overwrite"
      // engine_version conforme S12.1
      // ==============================================
      const clinicalStatesData = await client.query(
        `SELECT id, learner_id, cso_aba, sas, pis, bss, tcm,
                cso_band, engine_version, created_at
         FROM clinical_states_aba WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      // ==============================================
      // 14. SONDAS DE GENERALIZAÇÃO 3x2 (S4 + S24)
      // ==============================================
      const genProbesData = await client.query(
        `SELECT id, protocol_id, stimulus_variation, context_variation,
                applicator, environment, score, passed, notes, created_at
         FROM generalization_probes WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      // ==============================================
      // 15. SONDAS DE MANUTENÇÃO 2/6/12 (S5 + S24)
      // ==============================================
      const maintProbesData = await client.query(
        `SELECT id, protocol_id, probe_number, weeks_after_mastery,
                scheduled_date, completed_date, score, passed, notes, created_at
         FROM maintenance_probes WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      // ==============================================
      // 16. RESUMOS PARA RESPONSÁVEIS (S21 + S24)
      // Conforme Bible: "Terapeuta SEMPRE revisa antes do envio"
      // ==============================================
      const summariesData = await client.query(
        `SELECT id, session_id, learner_id, summary_text,
                is_approved, approved_by, approved_at, sent_at, created_at
         FROM session_summaries WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      // ==============================================
      // 17. RELATÓRIOS CONVÊNIO (S15 + S24)
      // ==============================================
      const convenioData = await client.query(
        `SELECT id, learner_id, report_type, period_start, period_end,
                data_hash, pdf_url, generated_by, generated_at, engine_version
         FROM report_snapshots WHERE tenant_id = $1
         ORDER BY generated_at`,
        [tenantId]
      )

      // ==============================================
      // 18. ACESSO PORTAL FAMÍLIA (S22 + S24)
      // ==============================================
      const portalAccessData = await client.query(
        `SELECT id, guardian_id, learner_id, is_active, granted_at, revoked_at
         FROM family_portal_access WHERE tenant_id = $1
         ORDER BY granted_at`,
        [tenantId]
      )

      // ==============================================
      // 19. HISTÓRICO DE EMAILS (S23: email_logs)
      // Retenção: 5 anos (Compliance)
      // ==============================================
      const emailLogsData = await client.query(
        `SELECT id, recipient, subject, status, sent_at, created_at
         FROM email_logs WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      // ==============================================
      // 20. NOTIFICAÇÕES (S23: notifications)
      // Retenção: 1 ano (Operacional)
      // ==============================================
      const notificationsData = await client.query(
        `SELECT id, user_id, type, title, message, status, created_at
         FROM notifications WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      // ==============================================
      // 21. AUDIT LOGS (S13.3: axis_audit_logs)
      // Retenção: 5 anos (Compliance)
      // Append-only — registro completo de rastreabilidade
      // ==============================================
      const auditLogsData = await client.query(
        `SELECT id, user_id, actor, action, entity_type, entity_id,
                metadata, created_at
         FROM axis_audit_logs WHERE tenant_id = $1
         ORDER BY created_at`,
        [tenantId]
      )

      // ==============================================
      // Montar pacote de exportação
      // ==============================================
      const exportedAt = new Date().toISOString()

      return {
        _meta: {
          export_version: '1.0',
          exported_at: exportedAt,
          exported_by: {
            profile_id: profileId,
            role,
            clerk_user_id: userId,
          },
          engine: 'axis_aba',
          bible_version: '2.6.1',
          lgpd: {
            base_legal: 'Art. 18, Lei 13.709/2018 (LGPD)',
            controlador: tenantData.rows[0]?.name || 'Clínica',
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
            profiles: profilesData.rowCount,
            learners: learnersData.rowCount,
            learner_therapist_assignments: assignmentsData.rowCount,
            guardians: guardiansData.rowCount,
            guardian_consents: consentsData.rowCount,
            pei_plans: peiPlansData.rowCount,
            pei_goals: peiGoalsData.rowCount,
            protocols: protocolsData.rowCount,
            sessions: sessionsData.rowCount,
            session_targets: targetsData.rowCount,
            session_behaviors: behaviorsData.rowCount,
            session_snapshots: snapshotsData.rowCount,
            clinical_states: clinicalStatesData.rowCount,
            generalization_probes: genProbesData.rowCount,
            maintenance_probes: maintProbesData.rowCount,
            session_summaries: summariesData.rowCount,
            report_snapshots: convenioData.rowCount,
            family_portal_access: portalAccessData.rowCount,
            email_logs: emailLogsData.rowCount,
            notifications: notificationsData.rowCount,
            audit_logs: auditLogsData.rowCount,
          },
        },

        // Organização
        tenant: tenantData.rows[0] || null,
        profiles: profilesData.rows,

        // Clínico — Retenção 7 anos (CFM/CRP)
        learners: learnersData.rows,
        learner_therapist_assignments: assignmentsData.rows,
        guardians: guardiansData.rows,
        guardian_consents: consentsData.rows,
        pei_plans: peiPlansData.rows,
        pei_goals: peiGoalsData.rows,
        protocols: protocolsData.rows,
        sessions: sessionsData.rows,
        session_targets: targetsData.rows,
        session_behaviors: behaviorsData.rows,
        session_snapshots: snapshotsData.rows,
        clinical_states: clinicalStatesData.rows,
        generalization_probes: genProbesData.rows,
        maintenance_probes: maintProbesData.rows,
        session_summaries: summariesData.rows,
        report_snapshots: convenioData.rows,
        family_portal_access: portalAccessData.rows,

        // Operacional — Retenções variadas
        email_logs: emailLogsData.rows,
        notifications: notificationsData.rows,

        // Auditoria — Retenção 5 anos (Compliance)
        audit_logs: auditLogsData.rows,
      }
    })

    // Cabeçalhos de resposta para download
    const filename = `axis_aba_export_${new Date().toISOString().split('T')[0]}.json`

    return new NextResponse(JSON.stringify(result, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-AXIS-Export-Version': '1.0',
        'X-AXIS-Bible-Version': '2.6.1',
      },
    })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
