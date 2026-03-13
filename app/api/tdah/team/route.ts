import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdmin, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Gestão de Equipe (Multi-Terapeuta)
// Mesma lógica do ABA, contadores adaptados para TDAH
// Reutiliza tabela profiles (compartilhada)
// =====================================================

/**
 * GET /api/tdah/team
 * Lista membros da equipe do tenant com contadores TDAH.
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
          COALESCE(pc.patient_count, 0)::int AS patient_count,
          COALESCE(sc.session_count, 0)::int AS session_count
        FROM profiles p
        LEFT JOIN (
          SELECT created_by, COUNT(*) AS patient_count
          FROM tdah_patients
          WHERE tenant_id = $1 AND status = 'active'
          GROUP BY created_by
        ) pc ON pc.created_by = p.clerk_user_id
        LEFT JOIN (
          SELECT created_by, COUNT(*) AS session_count
          FROM tdah_sessions
          WHERE tenant_id = $1 AND status != 'cancelled'
          GROUP BY created_by
        ) sc ON sc.created_by = p.clerk_user_id
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
 * POST /api/tdah/team
 * Convidar novo membro. Reutiliza mesma lógica do ABA (profiles compartilhados).
 * Acesso: admin apenas.
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

      const tempClerkId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const invitedBy = ctx.profileId !== ctx.tenantId ? ctx.profileId : null

      const insert = await ctx.client.query(
        `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, crp, crp_uf, is_active, invited_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
         RETURNING id, name, email, role, is_active, created_at`,
        [ctx.tenantId, tempClerkId, role, name, email, crp || null, crp_uf || null, invitedBy]
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
          JSON.stringify({ role, email, invited_by: ctx.profileId, source: 'tdah' })
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
