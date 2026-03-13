import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdmin, handleRouteError } from '@/src/database/with-role'
import { PoolClient } from 'pg'

// =====================================================
// AXIS TDAH — Anonimização LGPD (Tabelas TDAH)
// Conforme AXIS TDAH BIBLE v2.5 + LGPD Art. 18
//
// Complementa o /api/aba/lgpd/delete que cobre tabelas compartilhadas.
// Este endpoint anonimiza APENAS tabelas TDAH-específicas.
//
// FLUXO:
//   GET    → Status da exclusão (reutiliza estado do tenant)
//   POST   → Agendar exclusão (90 dias) + desativar dados TDAH
//   DELETE → Executar anonimização irreversível (tabelas TDAH)
//   PATCH  → Cancelar exclusão
//
// IMUTÁVEL: tdah_snapshots e tdah_audhd_log são preservados (Bible §7, §9.3)
// =====================================================

const RETENTION_DAYS = 90
const ANON_PREFIX = 'ANON'

let _spCounter = 0
async function safeExec(client: PoolClient, query: string, params: any[], label: string) {
  const sp = `sp_tdel_${label.replace(/[^a-z0-9_]/gi, '_')}_${++_spCounter}`
  try {
    await client.query(`SAVEPOINT ${sp}`)
    const res = await client.query(query, params)
    await client.query(`RELEASE SAVEPOINT ${sp}`)
    return { rows: res.rows, rowCount: res.rowCount || 0 }
  } catch (err: any) {
    console.warn(`[LGPD TDAH Delete] Falha em ${label}: ${err.message}`)
    try { await client.query(`ROLLBACK TO SAVEPOINT ${sp}`) } catch {}
    return { rows: [], rowCount: 0 }
  }
}

async function ensureLgpdColumns(client: PoolClient) {
  const columns = [
    { name: 'cancellation_scheduled_at', type: 'TIMESTAMPTZ' },
    { name: 'cancelled_at', type: 'TIMESTAMPTZ' },
    { name: 'anonymized_at', type: 'TIMESTAMPTZ' },
  ]
  for (const col of columns) {
    await safeExec(client, `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`, [], `ensure_${col.name}`)
  }
}

/**
 * GET /api/tdah/lgpd/delete
 * Status da exclusão (reusa colunas do tenant).
 */
export async function GET() {
  try {
    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)
      await ensureLgpdColumns(ctx.client)

      const td = await ctx.client.query(
        `SELECT cancellation_scheduled_at, anonymized_at FROM tenants WHERE id = $1`, [ctx.tenantId])
      const t = td.rows[0]

      if (!t) return { status: 'not_found' }

      if (t.anonymized_at) {
        return { status: 'anonymized', anonymized_at: t.anonymized_at, message: 'Dados TDAH foram anonimizados.' }
      }

      if (t.cancellation_scheduled_at) {
        const sched = new Date(t.cancellation_scheduled_at)
        const anonDate = new Date(sched)
        anonDate.setDate(anonDate.getDate() + RETENTION_DAYS)
        const days = Math.max(0, Math.ceil((anonDate.getTime() - Date.now()) / 86400000))

        return {
          status: 'scheduled',
          cancellation_scheduled_at: t.cancellation_scheduled_at,
          anonymization_date: anonDate.toISOString(),
          days_remaining: days,
          can_anonymize_now: days === 0,
        }
      }

      return { status: 'active', message: 'Conta ativa. Nenhuma exclusão agendada.' }
    })

    return NextResponse.json(result)
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * POST /api/tdah/lgpd/delete
 * Agendar exclusão (90 dias). Desativa pacientes TDAH.
 */
export async function POST() {
  try {
    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)
      const { client, tenantId, userId, profileId, role } = ctx
      await ensureLgpdColumns(client)

      const current = await client.query(
        `SELECT cancellation_scheduled_at, anonymized_at FROM tenants WHERE id = $1`, [tenantId])

      if (current.rows[0]?.anonymized_at) return { error: 'Já anonimizado.', code: 409 }
      if (current.rows[0]?.cancellation_scheduled_at) return { status: 'already_scheduled' }

      const now = new Date()
      const anonDate = new Date(now)
      anonDate.setDate(anonDate.getDate() + RETENTION_DAYS)

      await client.query(
        `UPDATE tenants SET cancellation_scheduled_at = NOW(), updated_at = NOW() WHERE id = $1`, [tenantId])

      // Desativar pacientes TDAH
      await safeExec(client,
        `UPDATE tdah_patients SET status = 'inactive' WHERE tenant_id = $1 AND status = 'active'`,
        [tenantId], 'deactivate_patients')

      // Audit
      await safeExec(client,
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LGPD_TDAH_DELETION_SCHEDULED', 'tenant', $4, $5, NOW())`,
        [tenantId, userId, userId, tenantId, JSON.stringify({
          requested_by_profile: profileId, requested_by_role: role,
          retention_days: RETENTION_DAYS, module: 'tdah',
        })], 'audit_sched')

      return {
        status: 'scheduled',
        anonymization_date: anonDate.toISOString(),
        retention_days: RETENTION_DAYS,
        message: `Exclusão TDAH agendada. ${RETENTION_DAYS} dias para exportar dados.`,
      }
    })

    if ('error' in result) return NextResponse.json({ error: (result as any).error }, { status: (result as any).code || 400 })
    return NextResponse.json(result, { status: result.status === 'already_scheduled' ? 200 : 201 })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * DELETE /api/tdah/lgpd/delete
 * Executar anonimização irreversível das tabelas TDAH.
 * Só executa após 90 dias.
 */
export async function DELETE() {
  try {
    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)
      const { client, tenantId, userId, profileId, role } = ctx
      await ensureLgpdColumns(client)

      const tc = await client.query(
        `SELECT cancellation_scheduled_at, anonymized_at FROM tenants WHERE id = $1`, [tenantId])
      const t = tc.rows[0]

      if (!t) return { error: 'Tenant não encontrado', code: 404 }
      if (t.anonymized_at) return { error: 'Já anonimizado.', code: 409 }
      if (!t.cancellation_scheduled_at) return { error: 'Agendar exclusão primeiro (POST).', code: 400 }

      const sched = new Date(t.cancellation_scheduled_at)
      const anonDate = new Date(sched)
      anonDate.setDate(anonDate.getDate() + RETENTION_DAYS)

      if (Date.now() < anonDate.getTime()) {
        const days = Math.ceil((anonDate.getTime() - Date.now()) / 86400000)
        return { error: `Período de retenção ativo. Faltam ${days} dia(s).`, code: 403 }
      }

      // ── ANONIMIZAÇÃO IRREVERSÍVEL ──
      await safeExec(client,
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LGPD_TDAH_ANONYMIZATION_STARTED', 'tenant', $4, $5, NOW())`,
        [tenantId, userId, userId, tenantId, JSON.stringify({ module: 'tdah', role })], 'audit_start')

      const stats: Record<string, number> = {}

      // 1. TDAH_PATIENTS — anonimizar PII
      const r1 = await safeExec(client,
        `UPDATE tdah_patients SET
           name = '${ANON_PREFIX}_' || LEFT(id::text, 8),
           birth_date = NULL, gender = NULL, diagnosis = '[ANONIMIZADO]',
           cid_code = NULL, school_name = NULL, school_contact = NULL,
           teacher_name = NULL, teacher_email = NULL, clinical_notes = NULL
         WHERE tenant_id = $1`, [tenantId], 'anon_patients')
      stats.patients = r1.rowCount

      // 2. TDAH_GUARDIANS — anonimizar PII
      const r2 = await safeExec(client,
        `UPDATE tdah_guardians SET
           name = '${ANON_PREFIX}_' || LEFT(id::text, 8),
           email = NULL, phone = NULL, relationship = '[ANONIMIZADO]', is_active = false
         WHERE tenant_id = $1`, [tenantId], 'anon_guardians')
      stats.guardians = r2.rowCount

      // 3. TDAH_SESSIONS — anonimizar notes
      const r3 = await safeExec(client,
        `UPDATE tdah_sessions SET notes = NULL WHERE tenant_id = $1`, [tenantId], 'anon_sessions')
      stats.sessions = r3.rowCount

      // 4. TDAH_OBSERVATIONS — anonimizar task e notes
      const r4 = await safeExec(client,
        `UPDATE tdah_observations SET
           task_description = '[ANONIMIZADO]', notes = NULL
         WHERE tenant_id = $1`, [tenantId], 'anon_observations')
      stats.observations = r4.rowCount

      // 5. TDAH_PROTOCOLS — anonimizar adaptation notes
      const r5 = await safeExec(client,
        `UPDATE tdah_protocols SET audhd_adaptation_notes = NULL WHERE tenant_id = $1`,
        [tenantId], 'anon_protocols')
      stats.protocols = r5.rowCount

      // 6. TDAH_DRC_ENTRIES — anonimizar texto
      const r6 = await safeExec(client,
        `UPDATE tdah_drc_entries SET
           goal_description = '[ANONIMIZADO]', teacher_notes = NULL, review_notes = NULL
         WHERE tenant_id = $1`, [tenantId], 'anon_drc')
      stats.drc_entries = r6.rowCount

      // 7. TDAH_SNAPSHOTS — IMUTÁVEL (Bible §7) — preservar
      const r7 = await safeExec(client,
        `SELECT COUNT(*)::int as cnt FROM tdah_snapshots WHERE tenant_id = $1`,
        [tenantId], 'count_snapshots')
      stats.snapshots_preserved = r7.rows[0]?.cnt || 0

      // 8. TDAH_AUDHD_LOG — APPEND-ONLY (Bible §9.3) — preservar, anonimizar reason
      const r8 = await safeExec(client,
        `UPDATE tdah_audhd_log SET reason = '[ANONIMIZADO]' WHERE tenant_id = $1`,
        [tenantId], 'anon_audhd_log')
      stats.audhd_log = r8.rowCount

      // 9. SESSION_SUMMARIES (TDAH) — anonimizar
      const r9 = await safeExec(client,
        `UPDATE session_summaries SET content = '[ANONIMIZADO]'
         WHERE tenant_id = $1 AND source_module = 'tdah'`, [tenantId], 'anon_summaries')
      stats.summaries = r9.rowCount

      // Audit conclusão
      await safeExec(client,
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LGPD_TDAH_ANONYMIZATION_COMPLETED', 'tenant', $4, $5, NOW())`,
        [tenantId, userId, userId, tenantId, JSON.stringify({
          stats, module: 'tdah',
          preserved: ['tdah_snapshots (Bible §7)', 'audit_logs (5 anos compliance)'],
        })], 'audit_complete')

      return {
        status: 'anonymized',
        anonymized_at: new Date().toISOString(),
        stats,
        preserved: {
          tdah_snapshots: 'Preservados com engine_version (Bible §7 — imutável)',
          tdah_audhd_log: 'Transições preservadas, motivo anonimizado (Bible §9.3)',
          audit_logs: 'Mantidos intactos (5 anos compliance)',
        },
        message: 'Anonimização TDAH concluída.',
      }
    })

    if ('error' in result) {
      return NextResponse.json({ error: (result as any).error }, { status: (result as any).code || 400 })
    }
    return NextResponse.json(result)
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * PATCH /api/tdah/lgpd/delete
 * Cancelar exclusão agendada. Reativar pacientes TDAH.
 */
export async function PATCH() {
  try {
    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)
      const { client, tenantId, userId, profileId } = ctx
      await ensureLgpdColumns(client)

      const tc = await client.query(
        `SELECT cancellation_scheduled_at, anonymized_at FROM tenants WHERE id = $1`, [tenantId])
      const t = tc.rows[0]

      if (t?.anonymized_at) return { error: 'Já anonimizado. Irreversível.', code: 409 }
      if (!t?.cancellation_scheduled_at) return { error: 'Nenhuma exclusão agendada.', code: 400 }

      await client.query(
        `UPDATE tenants SET cancellation_scheduled_at = NULL, updated_at = NOW() WHERE id = $1`, [tenantId])

      // Reativar pacientes TDAH
      await safeExec(client,
        `UPDATE tdah_patients SET status = 'active' WHERE tenant_id = $1 AND status = 'inactive'`,
        [tenantId], 'reactivate_patients')

      await safeExec(client,
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LGPD_TDAH_DELETION_CANCELLED', 'tenant', $4, $5, NOW())`,
        [tenantId, userId, userId, tenantId, JSON.stringify({
          cancelled_by_profile: profileId, module: 'tdah',
          original_scheduled_at: t.cancellation_scheduled_at,
        })], 'audit_cancel')

      return { status: 'active', message: 'Exclusão TDAH cancelada. Pacientes reativados.' }
    })

    if ('error' in result) return NextResponse.json({ error: (result as any).error }, { status: (result as any).code || 400 })
    return NextResponse.json(result)
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
