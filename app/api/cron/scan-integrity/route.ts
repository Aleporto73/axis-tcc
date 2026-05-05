// =====================================================
// AXIS ABA v2.7.0 — Cron: scan-integrity
//
// Rota dedicada para execução via cron externo.
// Auth: Bearer CRON_SECRET (mesmo padrão de /api/cron/reminders)
//
// Diferente de POST /api/aba/integrity-flags (que usa Clerk),
// esta rota itera TODOS os tenants automaticamente.
//
// Ref: skill_axis_aba_v270.md — Jobs Operacionais
//   "scan_integrity | Diário | Recalcula flags automáticas"
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { isValidCronAuth } from '@/src/lib/cron-auth'
import { env } from '@/src/lib/env'

const pool = new Pool({
  host: env.DATABASE_HOST,
  port: parseInt(env.DATABASE_PORT || '5432'),
  user: env.DATABASE_USER,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
})

export async function POST(request: NextRequest) {
  try {
    // ── Auth: CRON_SECRET (mesmo padrão dos outros cron endpoints) ──
    const authHeader = request.headers.get('authorization')
    const cronSecret = env.CRON_SECRET

    if (!cronSecret || !isValidCronAuth(authHeader, cronSecret, env.CRON_SECRET_OLD)) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const { runFullScan } = await import('@/src/engines/integrity-scanner')

    // ── Buscar todos os tenants ativos ──
    const client = await pool.connect()
    try {
      const tenantsResult = await client.query(
        `SELECT id FROM tenants WHERE trial_status != 'expired' OR trial_status IS NULL`
      )

      const results: Array<{
        tenant_id: string
        total_flags: number
        inserted: number
        updated: number
        auto_resolved: number
      }> = []

      // ── Executar scan para cada tenant ──
      // Item 11H: BEGIN + set_config('app.tenant_id', ..., true) ANTES de
      // runFullScan e COMMIT depois. Necessario porque integrity_flags tem
      // RLS forced+enabled com policy `tenant_id = app_tenant_id()`
      // (migration 063, Item 11E). Sem GUC, queries em runFullScan lancam
      // [AXIS RLS] app.tenant_id nao definido na sessao.
      // Pattern S3 (mesmo de scheduler.ts pos-Item 11F): set_config local
      // por transacao, COMMIT entre tenants pra zerar GUC, ROLLBACK no
      // catch pra garantir que tenant erro nao trava transacao do proximo.
      for (const tenant of tenantsResult.rows) {
        try {
          await client.query('BEGIN')
          await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenant.id])
          const scanResult = await runFullScan(client, tenant.id)
          await client.query('COMMIT')
          results.push({
            tenant_id: tenant.id,
            total_flags: scanResult.total_flags,
            inserted: scanResult.inserted,
            updated: scanResult.updated,
            auto_resolved: scanResult.auto_resolved,
          })
        } catch (err) {
          try { await client.query('ROLLBACK') } catch { /* tx ja abortada */ }
          console.error(`[scan-integrity] Erro no tenant ${tenant.id}:`, err)
          results.push({
            tenant_id: tenant.id,
            total_flags: -1,
            inserted: 0,
            updated: 0,
            auto_resolved: 0,
          })
        }
      }

      // ── Totais agregados ──
      const totals = results.reduce(
        (acc, r) => ({
          tenants_scanned: acc.tenants_scanned + 1,
          tenants_ok: acc.tenants_ok + (r.total_flags >= 0 ? 1 : 0),
          total_flags: acc.total_flags + Math.max(r.total_flags, 0),
          inserted: acc.inserted + r.inserted,
          updated: acc.updated + r.updated,
          auto_resolved: acc.auto_resolved + r.auto_resolved,
        }),
        { tenants_scanned: 0, tenants_ok: 0, total_flags: 0, inserted: 0, updated: 0, auto_resolved: 0 }
      )

      return NextResponse.json({
        success: true,
        ...totals,
        timestamp: new Date().toISOString(),
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[cron/scan-integrity] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Também aceita GET para flexibilidade (mesmo padrão de /api/cron/reminders)
export async function GET(request: NextRequest) {
  return POST(request)
}
