import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '../guard'
import pool from '@/src/database/db'

// Impedir cache do Next.js — cada request precisa ir pro banco
export const dynamic = 'force-dynamic'
export const revalidate = 0

// =====================================================
// GET /api/admin/users?search=email&product=tdah&status=pago&page=1
// Retorna 1 linha por licença (flat) — filtros funcionam corretamente
// =====================================================

const PER_PAGE = 20

export async function GET(request: NextRequest) {
  const check = await verifyAdmin()
  if (!check.authorized) return check.response

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.toLowerCase().trim() || ''
    const product = searchParams.get('product') || ''
    const status = searchParams.get('status') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const offset = (page - 1) * PER_PAGE

    // Build dynamic WHERE
    const conditions: string[] = []
    const params: any[] = []
    let idx = 1

    if (search) {
      conditions.push(`(LOWER(COALESCE(p.email, t.email, '')) LIKE $${idx} OR LOWER(COALESCE(p.name, t.name, '')) LIKE $${idx})`)
      params.push(`%${search}%`)
      idx++
    }

    if (product) {
      conditions.push(`ul.product_type = $${idx}`)
      params.push(product)
      idx++
    }

    if (status === 'pago') {
      conditions.push(`ul.is_active = true AND ul.hotmart_plan IS NOT NULL AND ul.hotmart_plan != ''`)
    } else if (status === 'free') {
      conditions.push(`ul.is_active = true AND (ul.hotmart_plan IS NULL OR ul.hotmart_plan = '')`)
    } else if (status === 'inativo') {
      conditions.push(`ul.is_active = false`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Subquery pra profile — evita duplicatas quando tenant tem múltiplos profiles
    const profileSubquery = `(
      SELECT DISTINCT ON (pp.tenant_id) pp.tenant_id, pp.name, pp.email, pp.crp, pp.crp_uf
      FROM profiles pp
      WHERE pp.is_active = true
      ORDER BY pp.tenant_id, pp.created_at DESC
    )`

    // Count
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM user_licenses ul
       JOIN tenants t ON t.id = ul.tenant_id
       LEFT JOIN ${profileSubquery} p ON p.tenant_id = t.id
       ${where}`,
      params
    )
    const total = countRes.rows[0]?.total ?? 0

    // Data — flat: 1 linha por licença, sem duplicatas
    const dataRes = await pool.query(
      `SELECT
        t.id AS tenant_id,
        COALESCE(p.name, t.name) AS name,
        COALESCE(p.email, t.email) AS email,
        t.clerk_user_id,
        t.plan_tier,
        t.max_patients,
        t.created_at AS tenant_created,
        p.crp,
        p.crp_uf,
        ul.id AS license_id,
        ul.product_type,
        ul.is_active,
        ul.hotmart_plan,
        ul.hotmart_transaction,
        ul.hotmart_offer,
        ul.hotmart_event,
        ul.buyer_email,
        ul.valid_from,
        ul.valid_until,
        ul.created_at AS license_created
      FROM user_licenses ul
      JOIN tenants t ON t.id = ul.tenant_id
      LEFT JOIN ${profileSubquery} p ON p.tenant_id = t.id
      ${where}
      ORDER BY ul.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, PER_PAGE, offset]
    )

    return NextResponse.json({
      rows: dataRes.rows,
      total,
      page,
      per_page: PER_PAGE,
      total_pages: Math.ceil(total / PER_PAGE),
      // Debug: retorna filtros recebidos pra confirmar
      _filters: { search, product, status },
    })
  } catch (error) {
    console.error('[ADMIN USERS] Erro:', error)
    return NextResponse.json({ error: 'Erro interno', detail: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
