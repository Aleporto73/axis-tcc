import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdmin, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA — Exclusão LGPD / Anonimização Irreversível
// Conforme AXIS ABA Bible v2.6.1:
//
//   S13.1 LGPD — Operador vs Controlador
//     "Exclusão após prazo legal"
//     Clínica (Controlador) decide; Psiform (Operador) executa
//
//   S13.2 Política de Retenção:
//     Após cancelamento da conta:
//       - Período de retenção: 90 dias
//       - Exportação disponível durante os 90 dias
//       - Após 90 dias: anonimização irreversível
//
//     Retenção por tipo de dado:
//       Dados clínicos     → 7 anos (CFM/CRP)
//       Relatórios gerados → 7 anos (CFM/CRP)
//       Logs de auditoria  → 5 anos (Compliance)
//       Portal família     → Enquanto vínculo ativo (Consentimento)
//       email_logs         → 5 anos (Compliance)
//       notifications      → 1 ano (Operacional)
//
//   S13.3 axis_audit_logs — Toda ação é auditável
//   S7 Snapshot Imutável — "Estado clínico é append-only — sem overwrite"
//   S12.1 Engine Version Lock — "O passado clínico é imutável"
//
// FLUXO:
//   POST /api/aba/lgpd/delete
//     → Fase 1: Agendar exclusão (cancellation_scheduled_at = NOW())
//     → Retém 90 dias. Exportação disponível.
//
//   DELETE /api/aba/lgpd/delete
//     → Fase 2: Executar anonimização irreversível
//     → Só executa se 90 dias passaram desde cancellation_scheduled_at
//     → OU: chamado por cron job automático após 90 dias
//
//   GET /api/aba/lgpd/delete
//     → Consultar status de exclusão agendada
//
// Acesso: SOMENTE admin (Controlador do lado clínica)
//
// IMPORTANTE — Regras de Anonimização:
//   1. Dados clínicos NÃO são deletados — são anonimizados
//      (remove PII, preserva estrutura para integridade científica)
//   2. audit_logs são MANTIDOS (5 anos, compliance)
//   3. session_snapshots preservam engine_version (imutável)
//   4. report_snapshots preservam data_hash (rastreabilidade)
//   5. clinical_states preservam engine_version (append-only)
//   6. Consentimentos são revogados e registros preservados
// =====================================================

const RETENTION_DAYS = 90
const ANON_PREFIX = 'ANON'

/**
 * Gera identificador anônimo determinístico.
 * Ex: ANON_a1b2c3d4 (primeiros 8 chars do UUID original)
 */
function anonymizeId(originalId: string): string {
  const short = originalId.replace(/-/g, '').substring(0, 8)
  return `${ANON_PREFIX}_${short}`
}

// =====================================================
// GET — Consultar status de exclusão agendada
// =====================================================
export async function GET() {
  try {
    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)

      const { client, tenantId } = ctx

      const tenantData = await client.query(
        `SELECT id, name, cancellation_scheduled_at, cancelled_at, anonymized_at
         FROM tenants WHERE id = $1`,
        [tenantId]
      )

      if (!tenantData.rows[0]) {
        return { status: 'not_found' }
      }

      const tenant = tenantData.rows[0]

      if (tenant.anonymized_at) {
        return {
          status: 'anonymized',
          anonymized_at: tenant.anonymized_at,
          message: 'Dados foram anonimizados irreversivelmente.',
        }
      }

      if (tenant.cancellation_scheduled_at) {
        const scheduledDate = new Date(tenant.cancellation_scheduled_at)
        const anonymizationDate = new Date(scheduledDate)
        anonymizationDate.setDate(anonymizationDate.getDate() + RETENTION_DAYS)

        const now = new Date()
        const daysRemaining = Math.max(
          0,
          Math.ceil((anonymizationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        )

        return {
          status: 'scheduled',
          cancellation_scheduled_at: tenant.cancellation_scheduled_at,
          anonymization_date: anonymizationDate.toISOString(),
          days_remaining: daysRemaining,
          can_anonymize_now: daysRemaining === 0,
          export_available: true,
          message: `Exclusão agendada. Anonimização em ${daysRemaining} dia(s). Exportação ainda disponível.`,
        }
      }

      return {
        status: 'active',
        message: 'Conta ativa. Nenhuma exclusão agendada.',
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// =====================================================
// POST — Fase 1: Agendar exclusão (inicia período 90 dias)
// Conforme Bible S13.2:
//   "Após cancelamento da conta:
//    Período de retenção: 90 dias
//    Exportação disponível"
// =====================================================
export async function POST() {
  try {
    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)

      const { client, tenantId, userId, profileId, role } = ctx

      // Verificar se já está agendado
      const current = await client.query(
        `SELECT cancellation_scheduled_at, anonymized_at
         FROM tenants WHERE id = $1`,
        [tenantId]
      )

      if (current.rows[0]?.anonymized_at) {
        return {
          error: 'Conta já foi anonimizada irreversivelmente.',
          status: 'anonymized',
        }
      }

      if (current.rows[0]?.cancellation_scheduled_at) {
        const scheduledDate = new Date(current.rows[0].cancellation_scheduled_at)
        const anonymizationDate = new Date(scheduledDate)
        anonymizationDate.setDate(anonymizationDate.getDate() + RETENTION_DAYS)

        return {
          status: 'already_scheduled',
          cancellation_scheduled_at: current.rows[0].cancellation_scheduled_at,
          anonymization_date: anonymizationDate.toISOString(),
          message: 'Exclusão já foi agendada anteriormente.',
        }
      }

      // Agendar exclusão
      const now = new Date()
      const anonymizationDate = new Date(now)
      anonymizationDate.setDate(anonymizationDate.getDate() + RETENTION_DAYS)

      await client.query(
        `UPDATE tenants
         SET cancellation_scheduled_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [tenantId]
      )

      // Registrar no audit log — Bible S13.3
      await client.query(
        `INSERT INTO axis_audit_logs
          (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LGPD_DELETION_SCHEDULED', 'tenant', $4, $5, NOW())`,
        [
          tenantId,
          userId,
          userId,
          tenantId,
          JSON.stringify({
            requested_by_profile: profileId,
            requested_by_role: role,
            retention_days: RETENTION_DAYS,
            anonymization_scheduled_for: anonymizationDate.toISOString(),
            bible_ref: 'S13.2 — 90 dias retenção, depois anonimização irreversível',
          }),
        ]
      )

      // Desativar todos os profiles (impede login futuro exceto admin)
      await client.query(
        `UPDATE profiles
         SET is_active = false, updated_at = NOW()
         WHERE tenant_id = $1 AND role != 'admin'`,
        [tenantId]
      )

      // Revogar todos os consentimentos do portal família
      // Bible: "Sem consentimento ativo → portal bloqueado, email não enviado"
      await client.query(
        `UPDATE guardian_consents
         SET revoked_at = NOW()
         WHERE tenant_id = $1 AND revoked_at IS NULL`,
        [tenantId]
      )

      // Desativar acessos portal família
      await client.query(
        `UPDATE family_portal_access
         SET is_active = false, revoked_at = NOW()
         WHERE tenant_id = $1 AND is_active = true`,
        [tenantId]
      )

      return {
        status: 'scheduled',
        cancellation_scheduled_at: now.toISOString(),
        anonymization_date: anonymizationDate.toISOString(),
        retention_days: RETENTION_DAYS,
        export_available: true,
        message: `Exclusão agendada com sucesso. Você tem ${RETENTION_DAYS} dias para exportar seus dados. Após esse período, a anonimização será irreversível.`,
        actions_taken: [
          'Cancelamento agendado no tenant',
          'Perfis de terapeutas desativados',
          'Consentimentos do portal família revogados',
          'Acessos do portal família desativados',
          'Registro no audit log (LGPD_DELETION_SCHEDULED)',
        ],
      }
    })

    // Se retornou com erro (já agendado/anonimizado)
    if ('error' in result) {
      return NextResponse.json(result, { status: 409 })
    }
    if (result.status === 'already_scheduled') {
      return NextResponse.json(result, { status: 200 })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// =====================================================
// DELETE — Fase 2: Executar anonimização irreversível
// Conforme Bible S13.2:
//   "Após 90 dias: anonimização irreversível"
//
// Regras de anonimização:
//   - Dados clínicos: anonimizar PII, preservar estrutura
//   - session_snapshots: manter engine_version, anonimizar learner_id
//   - clinical_states: manter engine_version, anonimizar
//   - report_snapshots: manter data_hash, remover pdf_url
//   - audit_logs: MANTER INTACTOS (5 anos compliance)
//   - Consentimentos: já revogados, preservar registro
//   - Calendar: remover tokens OAuth, desconectar
//
// ATENÇÃO: Esta operação é IRREVERSÍVEL.
// =====================================================
export async function DELETE() {
  try {
    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)

      const { client, tenantId, userId, profileId, role } = ctx

      // Verificar se exclusão foi agendada e 90 dias passaram
      const tenantCheck = await client.query(
        `SELECT cancellation_scheduled_at, anonymized_at, name
         FROM tenants WHERE id = $1`,
        [tenantId]
      )

      const tenant = tenantCheck.rows[0]

      if (!tenant) {
        return { error: 'Tenant não encontrado', code: 404 }
      }

      if (tenant.anonymized_at) {
        return { error: 'Conta já foi anonimizada irreversivelmente.', code: 409 }
      }

      if (!tenant.cancellation_scheduled_at) {
        return {
          error: 'Exclusão não foi agendada. Use POST primeiro para agendar.',
          code: 400,
        }
      }

      // Verificar se 90 dias passaram
      const scheduledDate = new Date(tenant.cancellation_scheduled_at)
      const anonymizationDate = new Date(scheduledDate)
      anonymizationDate.setDate(anonymizationDate.getDate() + RETENTION_DAYS)
      const now = new Date()

      if (now < anonymizationDate) {
        const daysRemaining = Math.ceil(
          (anonymizationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
        return {
          error: `Período de retenção ainda ativo. Faltam ${daysRemaining} dia(s). Anonimização disponível após ${anonymizationDate.toISOString().split('T')[0]}.`,
          code: 403,
        }
      }

      // ============================================
      // INÍCIO DA ANONIMIZAÇÃO IRREVERSÍVEL
      // ============================================

      // Registrar ANTES de anonimizar — Bible S13.3
      await client.query(
        `INSERT INTO axis_audit_logs
          (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LGPD_ANONYMIZATION_EXECUTED', 'tenant', $4, $5, NOW())`,
        [
          tenantId,
          userId,
          userId,
          tenantId,
          JSON.stringify({
            executed_by_profile: profileId,
            executed_by_role: role,
            cancellation_scheduled_at: tenant.cancellation_scheduled_at,
            retention_period_days: RETENTION_DAYS,
            bible_ref: 'S13.2 — anonimização irreversível após 90 dias',
          }),
        ]
      )

      const stats: Record<string, number> = {}

      // ──────────────────────────────────────────
      // 1. LEARNERS — anonimizar PII
      // Preservar: id, tenant_id, support_level, is_active, created_at
      // Anonimizar: name, birth_date, diagnosis, cid_code, school, notes
      // ──────────────────────────────────────────
      const learnersResult = await client.query(
        `UPDATE learners SET
           name = '${ANON_PREFIX}_' || LEFT(id::text, 8),
           birth_date = NULL,
           diagnosis = '[ANONIMIZADO]',
           cid_code = NULL,
           school = NULL,
           notes = NULL,
           updated_at = NOW(),
           deleted_at = COALESCE(deleted_at, NOW())
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.learners = learnersResult.rowCount || 0

      // ──────────────────────────────────────────
      // 2. GUARDIANS — anonimizar PII
      // ──────────────────────────────────────────
      const guardiansResult = await client.query(
        `UPDATE guardians SET
           name = '${ANON_PREFIX}_' || LEFT(id::text, 8),
           email = NULL,
           phone = NULL,
           relationship = '[ANONIMIZADO]',
           is_active = false
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.guardians = guardiansResult.rowCount || 0

      // ──────────────────────────────────────────
      // 3. GUARDIAN_CONSENTS — preservar registro, anonimizar IP
      // ──────────────────────────────────────────
      const consentsResult = await client.query(
        `UPDATE guardian_consents SET
           ip_address = NULL,
           revoked_at = COALESCE(revoked_at, NOW())
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.guardian_consents = consentsResult.rowCount || 0

      // ──────────────────────────────────────────
      // 4. PROFILES — anonimizar PII dos membros
      // Preservar: id, tenant_id, role, is_active, created_at
      // ──────────────────────────────────────────
      const profilesResult = await client.query(
        `UPDATE profiles SET
           name = '${ANON_PREFIX}_' || LEFT(id::text, 8),
           email = '${ANON_PREFIX}_' || LEFT(id::text, 8) || '@anon.local',
           crp = NULL,
           crp_uf = NULL,
           clerk_user_id = 'anon_' || LEFT(id::text, 12),
           is_active = false,
           updated_at = NOW()
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.profiles = profilesResult.rowCount || 0

      // ──────────────────────────────────────────
      // 5. SESSIONS_ABA — anonimizar notes e links
      // Preservar: id, scheduled_at, started_at, ended_at, status,
      //            duration_minutes (estrutura clínica)
      // ──────────────────────────────────────────
      const sessionsResult = await client.query(
        `UPDATE sessions_aba SET
           notes = NULL,
           google_event_id = NULL,
           google_meet_link = NULL,
           patient_response = NULL,
           location = '[ANONIMIZADO]'
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.sessions = sessionsResult.rowCount || 0

      // ──────────────────────────────────────────
      // 6. SESSION_TARGETS — anonimizar notes
      // Preservar: score, trials_correct, trials_total (dados quantitativos)
      // ──────────────────────────────────────────
      const targetsResult = await client.query(
        `UPDATE session_targets SET
           notes = NULL
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.session_targets = targetsResult.rowCount || 0

      // ──────────────────────────────────────────
      // 7. SESSION_BEHAVIORS — anonimizar texto livre ABC
      // Preservar: intensity, function_hypothesis (estrutura)
      // ──────────────────────────────────────────
      const behaviorsResult = await client.query(
        `UPDATE session_behaviors SET
           antecedent = '[ANONIMIZADO]',
           behavior = '[ANONIMIZADO]',
           consequence = '[ANONIMIZADO]'
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.session_behaviors = behaviorsResult.rowCount || 0

      // ──────────────────────────────────────────
      // 8. SESSION_SNAPSHOTS — IMUTÁVEL (Bible S7)
      // Preservar TUDO: cso_aba, sas, pis, bss, tcm, engine_version
      // Apenas referência de learner_id fica, mas learner já anonimizado
      // ──────────────────────────────────────────
      stats.session_snapshots_preserved = (await client.query(
        `SELECT COUNT(*) FROM session_snapshots WHERE tenant_id = $1`,
        [tenantId]
      )).rows[0]?.count || 0

      // ──────────────────────────────────────────
      // 9. CLINICAL_STATES_ABA — APPEND-ONLY (Bible S7)
      // Preservar TUDO: cso_aba, sas, pis, bss, tcm, engine_version
      // "Estado clínico é append-only — sem overwrite"
      // ──────────────────────────────────────────
      stats.clinical_states_preserved = (await client.query(
        `SELECT COUNT(*) FROM clinical_states_aba WHERE tenant_id = $1`,
        [tenantId]
      )).rows[0]?.count || 0

      // ──────────────────────────────────────────
      // 10. PEI_PLANS — anonimizar title/descrição
      // Preservar: period_start, period_end, status
      // ──────────────────────────────────────────
      const peiPlansResult = await client.query(
        `UPDATE pei_plans SET
           title = '${ANON_PREFIX}_PLANO_' || LEFT(id::text, 8)
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.pei_plans = peiPlansResult.rowCount || 0

      // ──────────────────────────────────────────
      // 11. PEI_GOALS — anonimizar texto
      // ──────────────────────────────────────────
      const peiGoalsResult = await client.query(
        `UPDATE pei_goals SET
           title = '${ANON_PREFIX}_META_' || LEFT(id::text, 8),
           description = '[ANONIMIZADO]'
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.pei_goals = peiGoalsResult.rowCount || 0

      // ──────────────────────────────────────────
      // 12. LEARNER_PROTOCOLS — anonimizar texto
      // Preservar: status, mastery_criteria_*, measurement_type,
      //            protocol_engine_version (Bible S12.1)
      // ──────────────────────────────────────────
      const protocolsResult = await client.query(
        `UPDATE learner_protocols SET
           title = '${ANON_PREFIX}_PROTO_' || LEFT(id::text, 8),
           objective = '[ANONIMIZADO]'
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.protocols = protocolsResult.rowCount || 0

      // ──────────────────────────────────────────
      // 13. GENERALIZATION_PROBES — anonimizar notes
      // Preservar: score, passed, stimulus_variation, context_variation
      // ──────────────────────────────────────────
      const genProbesResult = await client.query(
        `UPDATE generalization_probes SET
           notes = NULL
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.generalization_probes = genProbesResult.rowCount || 0

      // ──────────────────────────────────────────
      // 14. MAINTENANCE_PROBES — anonimizar notes
      // Preservar: score, passed, weeks_after_mastery (estrutura)
      // ──────────────────────────────────────────
      const maintProbesResult = await client.query(
        `UPDATE maintenance_probes SET
           notes = NULL
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.maintenance_probes = maintProbesResult.rowCount || 0

      // ──────────────────────────────────────────
      // 15. SESSION_SUMMARIES — anonimizar texto
      // ──────────────────────────────────────────
      const summariesResult = await client.query(
        `UPDATE session_summaries SET
           summary_text = '[ANONIMIZADO]'
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.session_summaries = summariesResult.rowCount || 0

      // ──────────────────────────────────────────
      // 16. REPORT_SNAPSHOTS — preservar hash, remover pdf_url
      // Bible Blindagem Jurídica: "data_hash SHA256 do JSON base"
      // Preservar: data_hash, engine_version, report_type, period
      // ──────────────────────────────────────────
      const reportsResult = await client.query(
        `UPDATE report_snapshots SET
           pdf_url = NULL
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.report_snapshots = reportsResult.rowCount || 0

      // ──────────────────────────────────────────
      // 17. FAMILY_PORTAL_ACCESS — já desativado, confirmar
      // ──────────────────────────────────────────
      const portalResult = await client.query(
        `UPDATE family_portal_access SET
           is_active = false,
           revoked_at = COALESCE(revoked_at, NOW())
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.family_portal_access = portalResult.rowCount || 0

      // ──────────────────────────────────────────
      // 18. LEARNER_THERAPISTS — remover vínculos
      // ──────────────────────────────────────────
      const ltResult = await client.query(
        `DELETE FROM learner_therapists WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.learner_therapists_removed = ltResult.rowCount || 0

      // ──────────────────────────────────────────
      // 19. EMAIL_LOGS — anonimizar destinatário
      // Retenção: 5 anos (compliance)
      // ──────────────────────────────────────────
      const emailResult = await client.query(
        `UPDATE email_logs SET
           recipient = '${ANON_PREFIX}@anon.local',
           subject = '[ANONIMIZADO]'
         WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.email_logs = emailResult.rowCount || 0

      // ──────────────────────────────────────────
      // 20. NOTIFICATIONS — deletar (retenção 1 ano, operacional)
      // ──────────────────────────────────────────
      const notifResult = await client.query(
        `DELETE FROM notifications WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.notifications_deleted = notifResult.rowCount || 0

      // ──────────────────────────────────────────
      // 21. CALENDAR — remover tokens e desconectar
      // ──────────────────────────────────────────
      const calResult = await client.query(
        `DELETE FROM calendar_connections WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.calendar_connections_removed = calResult.rowCount || 0

      // ──────────────────────────────────────────
      // 22. PUSH_TOKENS — remover tokens FCM
      // ──────────────────────────────────────────
      const pushResult = await client.query(
        `DELETE FROM push_tokens WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.push_tokens_removed = pushResult.rowCount || 0

      // ──────────────────────────────────────────
      // 23. NOTIFICATION_PREFERENCES — remover
      // ──────────────────────────────────────────
      const prefResult = await client.query(
        `DELETE FROM notification_preferences WHERE tenant_id = $1
         RETURNING id`,
        [tenantId]
      )
      stats.notification_preferences_removed = prefResult.rowCount || 0

      // ──────────────────────────────────────────
      // 24. AUDIT LOGS — MANTER INTACTOS
      // Bible S13.2: "Logs de auditoria → 5 anos (Compliance)"
      // Bible S13.3: "Toda ação é auditável — rastreabilidade completa"
      // NÃO anonimizar. NÃO deletar.
      // ──────────────────────────────────────────
      stats.audit_logs_preserved = (await client.query(
        `SELECT COUNT(*) FROM axis_audit_logs WHERE tenant_id = $1`,
        [tenantId]
      )).rows[0]?.count || 0

      // ──────────────────────────────────────────
      // 25. TENANT — marcar como anonimizado
      // ──────────────────────────────────────────
      await client.query(
        `UPDATE tenants SET
           name = '${ANON_PREFIX}_CLINIC_' || LEFT(id::text, 8),
           email = '${ANON_PREFIX}_' || LEFT(id::text, 8) || '@anon.local',
           anonymized_at = NOW(),
           cancelled_at = NOW(),
           updated_at = NOW()
         WHERE id = $1`,
        [tenantId]
      )

      // Registrar conclusão no audit log
      await client.query(
        `INSERT INTO axis_audit_logs
          (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LGPD_ANONYMIZATION_COMPLETED', 'tenant', $4, $5, NOW())`,
        [
          tenantId,
          userId,
          userId,
          tenantId,
          JSON.stringify({
            stats,
            bible_ref: 'S13.2 — anonimização irreversível concluída',
            note: 'audit_logs, session_snapshots e clinical_states preservados conforme Bible S7/S13.3',
          }),
        ]
      )

      return {
        status: 'anonymized',
        anonymized_at: new Date().toISOString(),
        stats,
        preserved: {
          audit_logs: 'Mantidos intactos (5 anos compliance — Bible S13.3)',
          session_snapshots: 'Preservados com engine_version (Bible S7 — imutável)',
          clinical_states: 'Preservados com engine_version (Bible S7 — append-only)',
          report_snapshots: 'Hash SHA256 preservado, pdf_url removido (Blindagem Jurídica)',
        },
        message: 'Anonimização irreversível concluída com sucesso.',
      }
    })

    if ('error' in result) {
      const code = (result as any).code || 400
      return NextResponse.json({ error: (result as any).error }, { status: code })
    }

    return NextResponse.json(result)
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// =====================================================
// PATCH — Cancelar exclusão agendada (reverter dentro dos 90 dias)
// Permite que o admin desista antes da anonimização
// =====================================================
export async function PATCH() {
  try {
    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)

      const { client, tenantId, userId, profileId, role } = ctx

      const tenantCheck = await client.query(
        `SELECT cancellation_scheduled_at, anonymized_at
         FROM tenants WHERE id = $1`,
        [tenantId]
      )

      const tenant = tenantCheck.rows[0]

      if (tenant?.anonymized_at) {
        return {
          error: 'Conta já foi anonimizada. Operação irreversível.',
          code: 409,
        }
      }

      if (!tenant?.cancellation_scheduled_at) {
        return {
          error: 'Nenhuma exclusão agendada para cancelar.',
          code: 400,
        }
      }

      // Reverter agendamento
      await client.query(
        `UPDATE tenants SET
           cancellation_scheduled_at = NULL,
           updated_at = NOW()
         WHERE id = $1`,
        [tenantId]
      )

      // Reativar profiles (exceto os que estavam inativos antes)
      await client.query(
        `UPDATE profiles SET
           is_active = true, updated_at = NOW()
         WHERE tenant_id = $1 AND clerk_user_id NOT LIKE 'pending_%'`,
        [tenantId]
      )

      // Registrar no audit log
      await client.query(
        `INSERT INTO axis_audit_logs
          (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LGPD_DELETION_CANCELLED', 'tenant', $4, $5, NOW())`,
        [
          tenantId,
          userId,
          userId,
          tenantId,
          JSON.stringify({
            cancelled_by_profile: profileId,
            cancelled_by_role: role,
            original_scheduled_at: tenant.cancellation_scheduled_at,
            bible_ref: 'S13.2 — cancelamento dentro do período de retenção',
          }),
        ]
      )

      return {
        status: 'active',
        message: 'Exclusão cancelada com sucesso. Conta reativada.',
        previous_scheduled_at: tenant.cancellation_scheduled_at,
      }
    })

    if ('error' in result) {
      const code = (result as any).code || 400
      return NextResponse.json({ error: (result as any).error }, { status: code })
    }

    return NextResponse.json(result)
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
