import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Perfil do Usuário Logado
// Retorna role, profileId, dados do profile para o frontend.
// Usado pelo RoleProvider para decidir o que mostrar na UI.
// =====================================================

export async function GET() {
  try {
    const result = await withTenant(async (ctx) => {
      const profile = await ctx.client.query(
        `SELECT
          p.id,
          p.tenant_id,
          p.clerk_user_id,
          p.role,
          p.name,
          p.email,
          p.crp,
          p.crp_uf,
          p.is_active,
          p.created_at,
          t.name AS tenant_name,
          t.plan AS tenant_plan
        FROM profiles p
        JOIN tenants t ON t.id = p.tenant_id
        WHERE p.clerk_user_id = $1 AND p.is_active = true
        LIMIT 1`,
        [ctx.userId]
      )

      if (profile.rows.length === 0) {
        // Fallback: retornar dados do tenants para compatibilidade
        return {
          id: ctx.profileId,
          tenant_id: ctx.tenantId,
          role: ctx.role,
          name: 'Profissional',
          is_active: true,
        }
      }

      return profile.rows[0]
    })

    return NextResponse.json({ profile: result })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
