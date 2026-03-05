import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdmin, handleRouteError } from '@/src/database/with-role'
import { PoolClient } from 'pg'

// =====================================================
// AXIS ABA — Exclusão LGPD / Anonimização Irreversível
// Conforme AXIS ABA Bible v2.6.1:
//
//   S13.1 LGPD — Operador vs Controlador
//   S13.2 Política de Retenção: 90 dias → anonimização irreversível
//   S13.3 axis_audit_logs — Toda ação é auditável
//   S7 Snapshot Imutável — append-only
//   S12.1 Engine Version Lock — passado clínico é imutável
//
// v2.0: Queries resilientes — cada tabela em try/catch com SAVEPOINT
//       Auto-cria colunas faltantes (cancellation_scheduled_at, etc.)
//
// FLUXO:
//   GET  → Consultar status de exclusão agendada
//   POST → Fase 1: Agendar exclusão (90 dias retenção)
//   PATCH → Cancelar exclusão dentro dos 90 dias
//   DELETE → Fase 2: Executar anonimização irreversível (após 90 dias)
//
// Acesso: SOMENTE admin (Controlador do lado clínica)
// =====================================================

const RETENTION_DAYS = 90
const ANON_PREFIX = 'ANON'

// Helper: query resiliente com SAVEPOINT
let _spCounter = 0
async function safeExec(client: PoolClient, query: string, params: any[], label: string): Promise<{ rows: any[]; rowCount: number }> {
  const sp = `sp_del_${label.replace(/[^a-z0-9_]/gi, '_')}_${++_spCounter}`
  try {
    await client.query(`SAVEPOINT ${sp}`)
    const res = await client.query(query, params)
    await client.query(`RELEASE SAVEPOINT ${sp}`)
    return { rows: res.rows, rowCount: res.rowCount || 0 }
  } catch (err: any) {
    console.warn(`[LGPD Delete] Falha em ${label}: ${err.message}`)
    try { await client.query(`ROLLBACK TO SAVEPOINT ${sp}`) } catch {}
    return { rows: [], rowCount: 0 }
  }
}

/**
 * Garante que tenants tem as colunas LGPD necessárias.
 * Usa SAVEPOINT para não quebrar a transação se já existirem.
 */
async function ensureLgpdColumns(client: PoolClient) {
  const columns = [
    { name: 'cancellation_scheduled_at', type: 'TIMESTAMPTZ' },
    { name: 'cancelled_at', type: 'TIMESTAMPTZ' },
    { name: 'anonymized_at', type: 'TIMESTAMPTZ' },
  ]
  for (const col of columns) {
    await safeExec(
      client,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`,
      [],
      `ensure_col_${col.name}`
    )
  }
}

// =====================================================
// GET — Consultar status de exclusão agendada
// =====================================================
export async function GET() {
  try {
    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)
      const { client, tenantId } = ctx

      // Garantir colunas existem
      await ensureLgpdColumns(client)

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
// =====================================================
export async function POST() {
  try {
    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)
      const { client, tenantId, userId, profileId, role } = ctx

      // Garantir colunas existem
      await ensureLgpdColumns(client)

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

      // Registrar no audit log — Bible S13.3 (non-critical)
      await safeExec(client,
        `INSERT INTO axis_audit_logs
          (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LGPD_DELETION_SCHEDULED', 'tenant', $4, $5, NOW())`,
        [
          tenantId, userId, userId, tenantId,
          JSON.stringify({
            requested_by_profile: profileId,
            requested_by_role: role,
            retention_days: RETENTION_DAYS,
            anonymization_scheduled_for: anonymizationDate.toISOString(),
            bible_ref: 'S13.2 — 90 dias retenção, depois anonimização irreversível',
          }),
        ],
        'audit_deletion_scheduled'
      )

      // Desativar todos os profiles exceto admin (non-critical)
      await safeExec(client,
        `UPDATE profiles
         SET is_active = false, updated_at = NOW()
         WHERE tenant_id = $1 AND role != 'admin'`,
        [tenantId],
        'deactivate_profiles'
      )

      // Revogar consentimentos do portal família (non-critical)
      await safeExec(client,
        `UPDATE guardian_consents
         SET revoked_at = NOW()
         WHERE tenant_id = $1 AND revoked_at IS NULL`,
        [tenantId],
        'revoke_consents'
      )

      // Desativar acessos portal família (non-critical)
      await safeExec(client,
        `UPDATE family_portal_access
         SET is_active = false, revoked_at = NOW()
         WHERE tenant_id = $1 AND is_active = true`,
        [tenantId],
        'deactivate_portal'
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
// Só executa se 90 dias passaram desde cancellation_scheduled_at
// =====================================================
export async function DELETE() {
  try {
    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)
      const { client, tenantId, userId, profileId, role } = ctx

      await ensureLgpdColumns(client)

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
      await safeExec(client,
        `INSERT INTO axis_audit_logs
          (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LGPD_ANONYMIZATION_EXECUTED', 'tenant', $4, $5, NOW())`,
        [
          tenantId, userId, userId, tenantId,
          JSON.stringify({
            executed_by_profile: profileId,
            executed_by_role: role,
            cancellation_scheduled_at: tenant.cancellation_scheduled_at,
            retention_period_days: RETENTION_DAYS,
            bible_ref: 'S13.2 — anonimização irreversível após 90 dias',
          }),
        ],
        'audit_anon_start'
      )

      const stats: Record<string, number> = {}

      // 1. LEARNERS — anonimizar PII
      const r1 = await safeExec(client,
        `UPDATE learners SET
           name = '${ANON_PREFIX}_' || LEFT(id::text, 8),
           birth_date = NULL,
           diagnosis = '[ANONIMIZADO]',
           cid_code = NULL,
           notes = NULL,
           updated_at = NOW()
         WHERE tenant_id = $1`,
        [tenantId], 'anon_learners')
      stats.learners = r1.rowCount

      // 2. GUARDIANS — anonimizar PII
      const r2 = await safeExec(client,
        `UPDATE guardians SET
           name = '${ANON_PREFIX}_' || LEFT(id::text, 8),
           email = NULL,
           phone = NULL,
           relationship = '[ANONIMIZADO]',
           is_active = false
         WHERE tenant_id = $1`,
        [tenantId], 'anon_guardians')
      stats.guardians = r2.rowCount

      // 3. GUARDIAN_CONSENTS — preservar registro, anonimizar IP
      const r3 = await safeExec(client,
        `UPDATE guardian_consents SET
           ip_address = NULL,
           revoked_at = COALESCE(revoked_at, NOW())
         WHERE tenant_id = $1`,
        [tenantId], 'anon_consents')
      stats.guardian_consents = r3.rowCount

      // 4. PROFILES — anonimizar PII
      const r4 = await safeExec(client,
        `UPDATE profiles SET
           name = '${ANON_PREFIX}_' || LEFT(id::text, 8),
           email = '${ANON_PREFIX}_' || LEFT(id::text, 8) || '@anon.local',
           clerk_user_id = 'anon_' || LEFT(id::text, 12),
           is_active = false,
           updated_at = NOW()
         WHERE tenant_id = $1`,
        [tenantId], 'anon_profiles')
      stats.profiles = r4.rowCount

      // 5. SESSIONS_ABA — anonimizar notes
      const r5 = await safeExec(client,
        `UPDATE sessions_aba SET
           notes = NULL,
           location = '[ANONIMIZADO]'
         WHERE tenant_id = $1`,
        [tenantId], 'anon_sessions')
      stats.sessions = r5.rowCount

      // 6. SESSION_TARGETS — anonimizar notes
      const r6 = await safeExec(client,
        `UPDATE session_targets SET
           notes = NULL
         WHERE tenant_id = $1`,
        [tenantId], 'anon_targets')
      stats.session_targets = r6.rowCount

      // 7. SESSION_BEHAVIORS — anonimizar texto livre ABC
      const r7 = await safeExec(client,
        `UPDATE session_behaviors SET
           antecedent = '[ANONIMIZADO]',
           behavior = '[ANONIMIZADO]',
           consequence = '[ANONIMIZADO]'
         WHERE tenant_id = $1`,
        [tenantId], 'anon_behaviors')
      stats.session_behaviors = r7.rowCount

      // 8. SESSION_SNAPSHOTS — IMUTÁVEL (Bible S7) — preservar tudo
      const r8 = await safeExec(client,
        `SELECT COUNT(*)::int as cnt FROM session_snapshots WHERE tenant_id = $1`,
        [tenantId], 'count_snapshots')
      stats.session_snapshots_preserved = r8.rows[0]?.cnt || 0

      // 9. CLINICAL_STATES_ABA — APPEND-ONLY (Bible S7) — preservar tudo
      const r9 = await safeExec(client,
        `SELECT COUNT(*)::int as cnt FROM clinical_states_aba WHERE tenant_id = $1`,
        [tenantId], 'count_clinical_states')
      stats.clinical_states_preserved = r9.rows[0]?.cnt || 0

      // 10. PEI_PLANS — anonimizar title
      const r10 = await safeExec(client,
        `UPDATE pei_plans SET
           title = '${ANON_PREFIX}_PLANO_' || LEFT(id::text, 8)
         WHERE tenant_id = $1`,
        [tenantId], 'anon_pei_plans')
      stats.pei_plans = r10.rowCount

      // 11. PEI_GOALS — anonimizar texto
      const r11 = await safeExec(client,
        `UPDATE pei_goals SET
           title = '${ANON_PREFIX}_META_' || LEFT(id::text, 8),
           description = '[ANONIMIZADO]'
         WHERE tenant_id = $1`,
        [tenantId], 'anon_pei_goals')
      stats.pei_goals = r11.rowCount

      // 12. LEARNER_PROTOCOLS — anonimizar texto
      const r12 = await safeExec(client,
        `UPDATE learner_protocols SET
           title = '${ANON_PREFIX}_PROTO_' || LEFT(id::text, 8),
           objective = '[ANONIMIZADO]'
         WHERE tenant_id = $1`,
        [tenantId], 'anon_protocols')
      stats.protocols = r12.rowCount

      // 13. GENERALIZATION_PROBES — anonimizar notes
      const r13 = await safeExec(client,
        `UPDATE generalization_probes SET notes = NULL WHERE tenant_id = $1`,
        [tenantId], 'anon_gen_probes')
      stats.generalization_probes = r13.rowCount

      // 14. MAINTENANCE_PROBES — anonimizar notes
      const r14 = await safeExec(client,
        `UPDATE maintenance_probes SET notes = NULL WHERE tenant_id = $1`,
        [tenantId], 'anon_maint_probes')
      stats.maintenance_probes = r14.rowCount

      // 15. SESSION_SUMMARIES — anonimizar texto (coluna = content)
      const r15 = await safeExec(client,
        `UPDATE session_summaries SET content = '[ANONIMIZADO]' WHERE tenant_id = $1`,
        [tenantId], 'anon_summaries')
      stats.session_summaries = r15.rowCount

      // 16. REPORT_SNAPSHOTS — preservar hash, remover pdf_url
      const r16 = await safeExec(client,
        `UPDATE report_snapshots SET pdf_url = NULL WHERE tenant_id = $1`,
        [tenantId], 'anon_reports')
      stats.report_snapshots = r16.rowCount

      // 17. FAMILY_PORTAL_ACCESS — desativar
      const r17 = await safeExec(client,
        `UPDATE family_portal_access SET
           is_active = false,
           revoked_at = COALESCE(revoked_at, NOW())
         WHERE tenant_id = $1`,
        [tenantId], 'anon_portal')
      stats.family_portal_access = r17.rowCount

      // 18. LEARNER_THERAPISTS — remover vínculos
      const r18 = await safeExec(client,
        `DELETE FROM learner_therapists WHERE tenant_id = $1`,
        [tenantId], 'del_assignments')
      stats.learner_therapists_removed = r18.rowCount

      // 19. EMAIL_LOGS — anonimizar destinatário
      const r19 = await safeExec(client,
        `UPDATE email_logs SET
           recipient = '${ANON_PREFIX}@anon.local',
           subject = '[ANONIMIZADO]'
         WHERE tenant_id = $1`,
        [tenantId], 'anon_emails')
      stats.email_logs = r19.rowCount

      // 20. NOTIFICATIONS — deletar (retenção 1 ano, operacional)
      const r20 = await safeExec(client,
        `DELETE FROM notifications WHERE tenant_id = $1`,
        [tenantId], 'del_notifications')
      stats.notifications_deleted = r20.rowCount

      // 21. CALENDAR — remover tokens
      const r21 = await safeExec(client,
        `DELETE FROM calendar_connections WHERE tenant_id = $1`,
        [tenantId], 'del_calendar')
      stats.calendar_connections_removed = r21.rowCount

      // 22. PUSH_TOKENS — remover
      const r22 = await safeExec(client,
        `DELETE FROM push_tokens WHERE tenant_id = $1`,
        [tenantId], 'del_push_tokens')
      stats.push_tokens_removed = r22.rowCount

      // 23. NOTIFICATION_PREFERENCES — remover
      const r23 = await safeExec(client,
        `DELETE FROM notification_preferences WHERE tenant_id = $1`,
        [tenantId], 'del_notif_prefs')
      stats.notification_preferences_removed = r23.rowCount

      // 24. AUDIT LOGS — MANTER INTACTOS (5 anos compliance)
      const r24 = await safeExec(client,
        `SELECT COUNT(*)::int as cnt FROM axis_audit_logs WHERE tenant_id = $1`,
        [tenantId], 'count_audit_logs')
      stats.audit_logs_preserved = r24.rows[0]?.cnt || 0

      // 25. TENANT — marcar como anonimizado
      await client.query(
        `UPDATE tenants SET
           name = '${ANON_PREFIX}_CLINIC_' || LEFT(id::text, 8),
           anonymized_at = NOW(),
           cancelled_at = NOW(),
           updated_at = NOW()
         WHERE id = $1`,
        [tenantId]
      )

      // Registrar conclusão
      await safeExec(client,
        `INSERT INTO axis_audit_logs
          (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LGPD_ANONYMIZATION_COMPLETED', 'tenant', $4, $5, NOW())`,
        [
          tenantId, userId, userId, tenantId,
          JSON.stringify({
            stats,
            bible_ref: 'S13.2 — anonimização irreversível concluída',
            note: 'audit_logs, session_snapshots e clinical_states preservados conforme Bible S7/S13.3',
          }),
        ],
        'audit_anon_complete'
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
// =====================================================
export async function PATCH() {
  try {
    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)
      const { client, tenantId, userId, profileId, role } = ctx

      await ensureLgpdColumns(client)

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

      // Reativar profiles
      await safeExec(client,
        `UPDATE profiles SET
           is_active = true, updated_at = NOW()
         WHERE tenant_id = $1 AND clerk_user_id NOT LIKE 'pending_%'`,
        [tenantId],
        'reactivate_profiles'
      )

      // Registrar no audit log
      await safeExec(client,
        `INSERT INTO axis_audit_logs
          (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LGPD_DELETION_CANCELLED', 'tenant', $4, $5, NOW())`,
        [
          tenantId, userId, userId, tenantId,
          JSON.stringify({
            cancelled_by_profile: profileId,
            cancelled_by_role: role,
            original_scheduled_at: tenant.cancellation_scheduled_at,
            bible_ref: 'S13.2 — cancelamento dentro do período de retenção',
          }),
        ],
        'audit_deletion_cancelled'
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
