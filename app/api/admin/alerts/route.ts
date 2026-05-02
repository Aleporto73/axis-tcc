import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '../guard'
import pool from '@/src/database/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// =====================================================
// GET /api/admin/alerts?type=duplicates
// Alertas de integridade do sistema
// =====================================================

export async function GET(request: NextRequest) {
  const check = await verifyAdmin()
  if (!check.authorized) return check.response

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || ''

    // Sempre retorna contagens
    const duplicatesRes = await pool.query(`
      SELECT tenant_id, product_type, COUNT(*)::int AS count
      FROM user_licenses WHERE is_active
      GROUP BY 1,2 HAVING COUNT(*) > 1
    `)

    const orphanTenantsRes = await pool.query(`
      SELECT t.id, t.email, t.name, t.created_at
      FROM tenants t LEFT JOIN profiles p ON p.tenant_id = t.id
      WHERE p.id IS NULL ORDER BY t.created_at DESC LIMIT 50
    `)

    const orphanLicensesRes = await pool.query(`
      SELECT ul.id, ul.tenant_id, ul.product_type, ul.buyer_email, ul.created_at
      FROM user_licenses ul LEFT JOIN tenants t ON t.id = ul.tenant_id
      WHERE t.id IS NULL ORDER BY ul.created_at DESC LIMIT 50
    `)

    const phantomLicensesRes = await pool.query(`
      SELECT ul.id, ul.tenant_id, ul.product_type, ul.buyer_email, ul.hotmart_event, ul.created_at
      FROM user_licenses ul
      WHERE ul.hotmart_event = 'CLERK_FREE_TIER' AND ul.is_active = true
      ORDER BY ul.created_at DESC LIMIT 50
    `)

    // Detalhes por tipo
    let details: any[] = []
    if (type === 'duplicates') details = duplicatesRes.rows
    else if (type === 'orphan_tenants') details = orphanTenantsRes.rows
    else if (type === 'orphan_licenses') details = orphanLicensesRes.rows
    else if (type === 'phantom') details = phantomLicensesRes.rows

    return NextResponse.json({
      counts: {
        duplicate_licenses: duplicatesRes.rows.length,
        orphan_tenants: orphanTenantsRes.rows.length,
        orphan_licenses: orphanLicensesRes.rows.length,
        phantom_licenses: phantomLicensesRes.rows.length,
      },
      details,
    })
  } catch (error) {
    console.error('[ADMIN ALERTS]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
