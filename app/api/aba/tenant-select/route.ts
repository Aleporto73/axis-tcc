import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import pool from '@/src/database/db'

// =====================================================
// AXIS ABA - API: Seleção de Tenant (Multi-Clínica)
//
// GET  → Lista todos os tenants onde o usuário tem profile ativo
// POST → Seleciona um tenant (seta cookie axis_active_tenant)
// =====================================================

/**
 * GET /api/aba/tenant-select
 * Lista todos os tenants acessíveis pelo usuário autenticado.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar email do usuário para auto-ativar convites pendentes
    const client = await pool.connect()
    try {
      const emailCheck = await client.query(
        `SELECT email FROM profiles WHERE clerk_user_id = $1 AND is_active = true LIMIT 1`,
        [userId]
      )

      if (emailCheck.rows.length > 0 && emailCheck.rows[0].email) {
        // Auto-ativar convites pendentes
        await client.query(
          `UPDATE profiles
           SET clerk_user_id = $1, is_active = true, updated_at = NOW()
           WHERE LOWER(email) = LOWER($2)
           AND clerk_user_id LIKE 'pending_%'
           AND is_active = false`,
          [userId, emailCheck.rows[0].email]
        )
      }

      // Listar todos os tenants com profiles ativos
      const result = await client.query(
        `SELECT
          p.id AS profile_id,
          p.tenant_id,
          p.role,
          t.name AS tenant_name,
          t.plan_tier,
          (SELECT COUNT(*) FROM learners l WHERE l.tenant_id = p.tenant_id AND l.is_active = true)::int AS learner_count,
          (SELECT COUNT(*) FROM profiles pr WHERE pr.tenant_id = p.tenant_id AND pr.is_active = true)::int AS member_count
        FROM profiles p
        JOIN tenants t ON t.id = p.tenant_id
        WHERE p.clerk_user_id = $1 AND p.is_active = true
        ORDER BY p.role = 'admin' DESC, p.created_at ASC`,
        [userId]
      )

      // Verificar cookie atual
      const cookieStore = await cookies()
      const activeTenant = cookieStore.get('axis_active_tenant')?.value || null

      return NextResponse.json({
        tenants: result.rows,
        active_tenant_id: activeTenant,
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[TENANT-SELECT] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST /api/aba/tenant-select
 * Seleciona um tenant ativo. Body: { tenant_id: string }
 * Seta cookie httpOnly axis_active_tenant.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { tenant_id } = body

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id obrigatório' }, { status: 400 })
    }

    // Verificar que o usuário realmente tem profile ativo nesse tenant
    const client = await pool.connect()
    try {
      const check = await client.query(
        `SELECT p.id, p.role, t.name AS tenant_name
         FROM profiles p
         JOIN tenants t ON t.id = p.tenant_id
         WHERE p.clerk_user_id = $1 AND p.tenant_id = $2 AND p.is_active = true
         LIMIT 1`,
        [userId, tenant_id]
      )

      if (check.rows.length === 0) {
        return NextResponse.json({ error: 'Acesso negado a este tenant' }, { status: 403 })
      }

      // Setar cookie
      const cookieStore = await cookies()
      cookieStore.set('axis_active_tenant', tenant_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 ano
      })

      return NextResponse.json({
        selected: {
          tenant_id,
          tenant_name: check.rows[0].tenant_name,
          role: check.rows[0].role,
        }
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[TENANT-SELECT] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
