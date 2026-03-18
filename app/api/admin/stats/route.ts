import { NextResponse } from 'next/server'
import { verifyAdmin } from '../guard'
import pool from '@/src/database/db'

// =====================================================
// GET /api/admin/stats
// Cards de resumo: totais, licenças por produto, novos hoje
// =====================================================

export async function GET() {
  const check = await verifyAdmin()
  if (!check.authorized) return check.response

  try {
    // Totais de licenças por produto e status
    // hotmart_plan pode ser NULL ou '' (vazio) para free — tratar ambos
    const licensesRes = await pool.query(`
      SELECT
        product_type,
        COUNT(*)::int FILTER (WHERE is_active = true AND hotmart_plan IS NOT NULL AND hotmart_plan != '') AS pagos,
        COUNT(*)::int FILTER (WHERE is_active = true AND (hotmart_plan IS NULL OR hotmart_plan = '')) AS free,
        COUNT(*)::int FILTER (WHERE is_active = false) AS inativos
      FROM user_licenses
      GROUP BY product_type
      ORDER BY product_type
    `)

    // Total de tenants com pelo menos 1 licença ativa
    const tenantsRes = await pool.query(`
      SELECT COUNT(DISTINCT ul.tenant_id)::int AS total
      FROM user_licenses ul
      WHERE ul.is_active = true
    `)

    // Novos nas últimas 24h
    const newTodayRes = await pool.query(`
      SELECT COUNT(*)::int AS total FROM tenants WHERE created_at >= NOW() - INTERVAL '24 hours'
    `)

    // Webhook errors (últimas 24h via audit_logs)
    const webhookErrorsRes = await pool.query(`
      SELECT COUNT(*)::int AS total FROM axis_audit_logs
      WHERE actor = 'hotmart_webhook'
        AND action LIKE '%FAILED%'
        AND created_at >= NOW() - INTERVAL '24 hours'
    `)

    // Alertas rápidos
    const duplicatesRes = await pool.query(`
      SELECT COUNT(*)::int AS total FROM (
        SELECT tenant_id, product_type FROM user_licenses
        WHERE is_active GROUP BY 1,2 HAVING COUNT(*) > 1
      ) d
    `)

    const orphanTenantsRes = await pool.query(`
      SELECT COUNT(*)::int AS total FROM tenants t
      LEFT JOIN profiles p ON p.tenant_id = t.id WHERE p.id IS NULL
    `)

    const orphanLicensesRes = await pool.query(`
      SELECT COUNT(*)::int AS total FROM user_licenses ul
      LEFT JOIN tenants t ON t.id = ul.tenant_id WHERE t.id IS NULL
    `)

    // Signups por dia (últimos 30 dias)
    const signupsByDayRes = await pool.query(`
      SELECT DATE(created_at) AS day, COUNT(*)::int AS count
      FROM tenants
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY day
    `)

    return NextResponse.json({
      tenants_total: tenantsRes.rows[0].total,
      new_today: newTodayRes.rows[0].total,
      webhook_errors_24h: webhookErrorsRes.rows[0].total,
      licenses_by_product: licensesRes.rows,
      alerts: {
        duplicate_licenses: duplicatesRes.rows[0].total,
        orphan_tenants: orphanTenantsRes.rows[0].total,
        orphan_licenses: orphanLicensesRes.rows[0].total,
      },
      signups_by_day: signupsByDayRes.rows,
    })
  } catch (error) {
    console.error('[ADMIN STATS]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
