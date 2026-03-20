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

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
})

export async function POST(request: NextRequest) {
  try {
    // ── Auth: CRON_SECRET (mesmo padrão dos outros cron endpoints) ──
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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
      for (const tenant of tenantsResult.rows) {
        try {
          const scanResult = await runFullScan(client, tenant.id)
          results.push({
            tenant_id: tenant.id,
            total_flags: scanResult.total_flags,
            inserted: scanResult.inserted,
            updated: scanResult.updated,
            auto_resolved: scanResult.auto_resolved,
          })
        } catch (err) {
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
