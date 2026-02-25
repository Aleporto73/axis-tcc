import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdmin, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Gestão de Equipe (Multi-Terapeuta)
// Conforme AXIS ABA Bible v2.6.1
// Toda ação é auditável — axis_audit_logs
// =====================================================

/**
 * GET /api/aba/team
 * Lista membros da equipe do tenant.
 * Acesso: admin apenas.
 */
export async function GET() {
  try {
    const result = await withTenant(async ({ client, tenantId, role, profileId }) => {
      requireAdmin({ tenantId, userId: '', profileId, role, client })

      const members = await client.query(
        `SELECT
          p.id,
          p.clerk_user_id,
          p.role,
          p.name,
          p.email,
          p.crp,
          p.crp_uf,
          p.is_active,
          p.created_at,
          p.updated_at,
          COALESCE(lt.learner_count, 0)::int AS learner_count,
          COALESCE(sc.session_count, 0)::int AS session_count
        FROM profiles p
        LEFT JOIN (
          SELECT profile_id, COUNT(*) AS learner_count
          FROM learner_therapists
          WHERE tenant_id = $1
          GROUP BY profile_id
        ) lt ON lt.profile_id = p.id
        LEFT JOIN (
          SELECT therapist_id, COUNT(*) AS session_count
          FROM sessions_aba
          WHERE tenant_id = $1 AND status != 'cancelled'
          GROUP BY therapist_id
        ) sc ON sc.therapist_id = p.clerk_user_id
        WHERE p.tenant_id = $1
        ORDER BY
          CASE p.role
            WHEN 'admin' THEN 0
            WHEN 'supervisor' THEN 1
            WHEN 'terapeuta' THEN 2
          END,
          p.name`,
        [tenantId]
      )

      return members.rows
    })

    return NextResponse.json({ team: result })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * POST /api/aba/team
 * Convidar novo membro para a equipe.
 * Acesso: admin apenas.
 * Cria profile pendente (is_active = false até primeiro login do convidado).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, role, crp, crp_uf } = body

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, email, role' },
        { status: 400 }
      )
    }

    const validRoles = ['supervisor', 'terapeuta']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Role inválida. Permitidas: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)

      // Verificar se email já existe no tenant
      const existing = await ctx.client.query(
        'SELECT id FROM profiles WHERE email = $1 AND tenant_id = $2',
        [email, ctx.tenantId]
      )
      if (existing.rows.length > 0) {
        throw new Error('DUPLICATE_EMAIL')
      }

      // Criar profile pendente (sem clerk_user_id até o primeiro login)
      // clerk_user_id será preenchido quando o convidado fizer sign-up/login
      const tempClerkId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

      const insert = await ctx.client.query(
        `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, crp, crp_uf, is_active, invited_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
         RETURNING id, name, email, role, is_active, created_at`,
        [ctx.tenantId, tempClerkId, role, name, email, crp || null, crp_uf || null, ctx.profileId]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'PROFILE_CREATED', 'profile', $4, $5, NOW())`,
        [
          ctx.tenantId,
          ctx.userId,
          ctx.userId,
          insert.rows[0].id,
          JSON.stringify({ role, email, invited_by: ctx.profileId })
        ]
      )

      return insert.rows[0]
    })

    return NextResponse.json({ member: result }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'DUPLICATE_EMAIL') {
      return NextResponse.json(
        { error: 'Este email já está cadastrado nesta clínica' },
        { status: 409 }
      )
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
