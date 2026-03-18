import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '../guard'
import pool from '@/src/database/db'

// =====================================================
// GET /api/admin/users?search=email&product=tdah&status=pago&page=1
// Lista usuários com licenças, filtros e paginação
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

    // Build dynamic WHERE clauses
    const conditions: string[] = []
    const params: any[] = []
    let paramIdx = 1

    if (search) {
      conditions.push(`(LOWER(t.email) LIKE $${paramIdx} OR LOWER(t.name) LIKE $${paramIdx} OR LOWER(p.email) LIKE $${paramIdx})`)
      params.push(`%${search}%`)
      paramIdx++
    }

    if (product) {
      conditions.push(`ul.product_type = $${paramIdx}`)
      params.push(product)
      paramIdx++
    }

    if (status === 'pago') {
      conditions.push(`ul.is_active = true AND ul.hotmart_plan IS NOT NULL`)
    } else if (status === 'free') {
      conditions.push(`ul.is_active = true AND ul.hotmart_plan IS NULL`)
    } else if (status === 'inativo') {
      conditions.push(`ul.is_active = false`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count
    const countQuery = `
      SELECT COUNT(DISTINCT t.id)::int AS total
      FROM tenants t
      LEFT JOIN profiles p ON p.tenant_id = t.id AND p.is_active = true
      LEFT JOIN user_licenses ul ON ul.tenant_id = t.id
      ${whereClause}
    `
    const countRes = await pool.query(countQuery, params)
    const total = countRes.rows[0].total

    // Data — join tudo, agregar licenças
    const dataQuery = `
      SELECT
        t.id AS tenant_id,
        t.name AS tenant_name,
        t.email AS tenant_email,
        t.clerk_user_id,
        t.plan_tier,
        t.max_patients,
        t.created_at AS tenant_created,
        p.name AS profile_name,
        p.email AS profile_email,
        p.crp,
        p.crp_uf,
        json_agg(
          json_build_object(
            'id', ul.id,
            'product_type', ul.product_type,
            'is_active', ul.is_active,
            'hotmart_plan', ul.hotmart_plan,
            'hotmart_transaction', ul.hotmart_transaction,
            'hotmart_offer', ul.hotmart_offer,
            'hotmart_event', ul.hotmart_event,
            'buyer_email', ul.buyer_email,
            'valid_from', ul.valid_from,
            'valid_until', ul.valid_until,
            'created_at', ul.created_at
          )
        ) FILTER (WHERE ul.id IS NOT NULL) AS licenses
      FROM tenants t
      LEFT JOIN profiles p ON p.tenant_id = t.id AND p.is_active = true
      LEFT JOIN user_licenses ul ON ul.tenant_id = t.id
      ${whereClause}
      GROUP BY t.id, t.name, t.email, t.clerk_user_id, t.plan_tier, t.max_patients, t.created_at,
               p.name, p.email, p.crp, p.crp_uf
      ORDER BY t.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `
    params.push(PER_PAGE, offset)
    const dataRes = await pool.query(dataQuery, params)

    return NextResponse.json({
      users: dataRes.rows,
      total,
      page,
      per_page: PER_PAGE,
      total_pages: Math.ceil(total / PER_PAGE),
    })
  } catch (error) {
    console.error('[ADMIN USERS]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
